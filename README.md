```markdown
# useUpload

轻量且可复用的文件上传工具思路与示例（TypeScript 实现参考）。

本仓库展示了将文件选择、校验、预览、上传与进度管理封装为可复用模块的实现思路，包含 React Hook 与 Vue Composition API (composable) 的 TypeScript 示例。仓库代码以 TypeScript 为主。

语言组成: TypeScript (100%)

---

## 目标

- 提供一致且易用的上传 API（React / Vue）
- 支持：多文件、类型/大小校验、上传进度回调、上传取消/重试、上传结果回调
- 可直接复制到项目中或作为实现参考

---

## 特性

- 多文件或单文件支持
- 根据 `accept` 与 `maxSize` 做前端校验
- 上传进度回调（基于 XHR）
- 支持取消（abort）正在进行的上传
- 返回统一的文件状态集合，便于 UI 显示

---

## 安装（示例）

本仓库为示例代码库，尚未发布到 npm。如需将某个实现作为包使用，可将文件复制到项目并以 TypeScript 构建。

---

## API（TypeScript 接口说明）

下面为通用的 options 与返回值类型（示例）：

```ts
export type UploadStatus = 'ready' | 'uploading' | 'done' | 'error';

export interface UploadFile<T = any> {
  id: string | number;
  name: string;
  size: number;
  type: string;
  raw: File;
  progress: number; // 0 - 100
  status: UploadStatus;
  response?: T | string | null;
  error?: string | null;
  createdAt?: number;
}

export interface UseUploadOptions {
  multiple?: boolean;
  accept?: string; // e.g. 'image/*'
  maxSize?: number; // bytes
  uploadUrl?: string; // 必填以实际上传
  fieldName?: string; // 默认为 'file'
  // 回调
  onProgress?: (file: UploadFile, percent: number) => void;
  onSuccess?: (file: UploadFile, response: any) => void;
  onError?: (file: UploadFile, error: any) => void;
}
```

通用返回值（hook / composable）：

```ts
{
  files: UploadFile[];
  onChange: (e: Event) => void; // 绑定到 <input type="file" />
  addFiles: (fileList: FileList | File[]) => void;
  removeFile: (id: string | number) => void;
  upload: (file?: UploadFile | string | number) => void; // 指定文件或上传全部待上传
  uploadAll: () => void;
}
```

---

## 快速开始 — React（TypeScript 示例）

把下面的 hook 代码复制到你的项目（例如 `hooks/useUpload.ts`），并根据需要调整 `uploadUrl`。

示例组件（TSX）：

```tsx
import React from 'react';
import useUpload, { UploadFile } from './hooks/useUpload';

export default function UploadExample() {
  const { files, onChange, upload, uploadAll, removeFile } = useUpload({
    multiple: true,
    accept: 'image/*',
    maxSize: 5 * 1024 * 1024,
    uploadUrl: '/api/upload',
    fieldName: 'file',
    onProgress: (file, pct) => console.log(file.name, pct),
    onSuccess: (file, res) => console.log('done', res),
    onError: (file, err) => console.error(err),
  });

  return (
    <div>
      <input type="file" multiple accept="image/*" onChange={onChange} />
      <ul>
        {files.map(f => (
          <li key={f.id}>
            {f.name} — {Math.round(f.progress)}% — {f.status}
            <button onClick={() => upload(f)}>上传</button>
            <button onClick={() => removeFile(f.id)}>移除</button>
          </li>
        ))}
      </ul>
      <button onClick={uploadAll}>上传全部</button>
    </div>
  );
}
```

（说明：实现中通常使用 XHR 以支持进度回调；如果你使用 axios，记得使用 `onUploadProgress`。）

---

## 快速开始 — Vue 3（TypeScript + <script setup> 示例）

把 composable 代码复制到 `composables/useUpload.ts`，并在组件中使用。

示例组件（SFC，script setup）：

```vue
<template>
  <div>
    <input type="file" :multiple="opts.multiple" :accept="opts.accept" @change="onChange" />
    <ul>
      <li v-for="f in files" :key="f.id">
        {{ f.name }} — {{ Math.round(f.progress) }}% — {{ f.status }}
        <button @click="upload(f)">上传</button>
        <button @click="removeFile(f.id)">移除</button>
      </li>
    </ul>
    <button @click="uploadAll">上传全部</button>
  </div>
</template>

<script setup lang="ts">
import { useUpload } from '@/composables/useUpload';

const opts = {
  multiple: true,
  accept: 'image/*',
  maxSize: 5 * 1024 * 1024,
  uploadUrl: '/api/upload',
  fieldName: 'file',
};

const { files, onChange, upload, uploadAll, removeFile } = useUpload(opts);
</script>
```

---

## 实现要点（可参考并移植）

- 前端校验：在将文件加入队列时校验 `accept` 与 `maxSize`，并把不合格项拒绝或标记错误。
- 进度：使用 `XMLHttpRequest` 的 `upload.onprogress` 回调来更新进度。
- 取消：在开始上传时把当前 XHR 存储在 Map（或 Record）中，提供 abort 功能。
- 状态：为每个文件维护 `status`（ready/uploading/done/error），便于 UI 处理重试/删除等操作。
- localStorage（可选）：如果希望持久化待上传队列，可使用 localStorage 保存 `files`（但需注意 File 对象不能直接序列化；可只保存 metadata 并在页面刷新后要求用户重新选文件或实现后端 token 续传）。

---

## 本仓库的示例说明

- 仓库中示例以 TypeScript 为主（按语言组成显示为 100% TypeScript）。
- README 中包含可直接复制的 TS/TSX/Vue 示例；如需我将某个示例文件加入仓库（例如 `composables/useUpload.ts` 或 `hooks/useUpload.ts`），请告诉我文件路径与分支，我可生成提交补丁或直接推送。

---

## 开发

常见步骤（示例）：

```bash
# 克隆仓库
git clone https://github.com/hututu-yo/useUpload.git
cd useUpload

# 安装依赖（如果有 package.json）
npm install

# 本地开发 / 测试
npm run dev
```

---

## 贡献

欢迎提交 Issue 与 Pull Request。请在 PR 中包含变更说明与复现步骤，尽可能包含测试或示例。

---

## 许可证

MIT
```
