import { ref } from "vue";
import axios, { Canceler } from "axios";
import SparkMD5 from "spark-md5";

interface UploadOptions {
  chunkSize?: number; // 分片大小
  concurrent?: number; // 并发数
}

interface ChunkTask {
  index: number;
  blob: Blob;
}

export function useUpload(options: UploadOptions = {}) {
  const chunkSize = options.chunkSize || 5 * 1024 * 1024;
  const concurrent = options.concurrent || 3;

  const progress = ref(0);
  const uploading = ref(false);
  const uploadedChunks = ref<number[]>([]);
  const paused = ref(false);

  let cancelTokens: Canceler[] = [];
  let fileHash = "";
  let fileName = ""; // 文件名
  let totalChunks = 0;

  /** 切片 */
  function createChunks(file: File): ChunkTask[] {
    const chunks: ChunkTask[] = [];
    let start = 0;
    let index = 0;
    while (start < file.size) {
      const end = Math.min(start + chunkSize, file.size);
      chunks.push({ index, blob: file.slice(start, end) });
      start = end;
      index++;
    }
    return chunks;
  }

  /** 计算文件 hash */
  async function calcFileHash(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const spark = new SparkMD5.ArrayBuffer();
      const reader = new FileReader();
      reader.readAsArrayBuffer(file);
      reader.onload = (e) => {
        if (e.target?.result) {
          spark.append(e.target.result as ArrayBuffer);
          resolve(spark.end());
        } else {
          reject("读取文件失败");
        }
      };
      reader.onerror = reject;
    });
  }

  /** 上传分片 */
  async function uploadChunk(task: ChunkTask) {
    if (paused.value) return;

    const form = new FormData();
    form.append("fileHash", fileHash);
    form.append("filename", fileName);
    form.append("chunk", task.blob);
    form.append("chunkIndex", String(task.index));
    form.append("totalChunks", String(totalChunks));

    const source = axios.CancelToken.source();
    cancelTokens.push(source.cancel);

    await axios.post("/upload/chunk", form, {
      cancelToken: source.token,
      onUploadProgress: (e) => {
        if (e.total) {
          const percent = (e.loaded / e.total) * (100 / totalChunks);
          progress.value = Math.min(100, progress.value + percent);
        }
      },
    });

    uploadedChunks.value.push(task.index);
    localStorage.setItem(
      `upload_${fileHash}`,
      JSON.stringify(uploadedChunks.value)
    );
  }

  /** 上传主流程 */
  async function uploadFile(file: File) {
    uploading.value = true;
    paused.value = false;
    progress.value = 0;

    fileHash = await calcFileHash(file);
    fileName = file.name;
    const chunks = createChunks(file);
    totalChunks = chunks.length;

    // 读取本地已上传分片
    const saved = localStorage.getItem(`upload_${fileHash}`);
    if (saved) {
      uploadedChunks.value = JSON.parse(saved);
    }

    // 向后端确认已上传分片
    const { data: { uploaded = [] } = {} } = await axios.post("/upload/check", {
      fileHash,
      filename: fileName,
    });
    uploadedChunks.value = Array.from(
      new Set([...uploadedChunks.value, ...uploaded])
    );

    // 过滤待上传
    const tasks = chunks.filter((c) => !uploadedChunks.value.includes(c.index));

    let i = 0;
    async function worker() {
      while (i < tasks.length && !paused.value) {
        const current = tasks[i++];
        await uploadChunk(current);
      }
    }

    await Promise.all(Array.from({ length: concurrent }, worker));

    if (!paused.value) {
      // 通知后端合并
      await axios.post("/upload/merge", {
        fileHash,
        filename: fileName,
        totalChunks,
      });
      uploading.value = false;
      progress.value = 100;
      localStorage.removeItem(`upload_${fileHash}`); // 清理记录
    }
  }

  /** 暂停上传 */
  function pauseUpload() {
    paused.value = true;
    cancelTokens.forEach((cancel) => cancel("pause"));
    cancelTokens = [];
  }

  /** 恢复上传 */
  async function resumeUpload(file: File) {
    if (!paused.value) return;
    paused.value = false;
    await uploadFile(file);
  }

  return {
    progress,
    uploading,
    paused,
    uploadedChunks,
    uploadFile,
    pauseUpload,
    resumeUpload,
  };
}
