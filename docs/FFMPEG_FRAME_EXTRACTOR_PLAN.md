
# FFmpeg 帧提取器实现计划

## 概述

为视频浏览器项目添加一个基于网页的 FFmpeg 视频处理界面，支持在指定时间范围内按间隔提取高质量视频帧。该功能将重用现有的项目架构和 FFmpeg 集成。

## 需求

- 新增专门的帧提取页面/界面
- 支持从现有视频库中选择视频
- 参数配置：开始时间、结束时间、帧间隔、输出质量/分辨率
- 实时任务进度显示
- 批量下载提取的图片（ZIP 格式）
- 重用现有项目模式（技术栈：Vue 3 + TypeScript + Tailwind CSS 前端，Express.js 后端，FFmpeg 集成）

---

## 第一部分：数据模型和类型定义

### 1.1 TypeScript 类型 (`frontend/src/types.ts`)

在现有类型文件中添加：

```typescript
// 帧提取任务状态
export interface FrameExtractStatus {
  id: string
  videoPath?: string
  videoId?: string
  videoTitle?: string
  status: 'pending' | 'running' | 'completed' | 'error' | 'aborted'
  stage?: 'starting' | 'analyzing' | 'extracting' | 'packaging' | 'complete'
  message?: string
  percent?: number
  totalFrames?: number
  extractedFrames?: number
  error?: boolean
  errorMessage?: string
  createdAt?: number
  updatedAt?: number
  outputPath?: string
  outputFileName?: string
  frameFiles?: string[]
  params?: FrameExtractParams
  totalTime?: number
}

// 帧提取参数
export interface FrameExtractParams {
  startTime: number    // 开始时间（秒）
  endTime: number      // 结束时间（秒）
  interval: number     // 帧间隔（秒）
  quality: number      // JPEG 质量 (1-31，1=最好)
  outputWidth: number  // 输出宽度（像素，-1=保持比例）
  outputHeight: number // 输出高度（像素，-1=保持比例）
}

// 帧提取任务创建请求
export interface FrameExtractRequest {
  videoPath: string
  params: FrameExtractParams
}

// 帧提取任务创建响应
export interface FrameExtractResponse {
  success: boolean
  message: string
  taskId?: string
}

// 帧提取任务列表响应
export interface FrameExtractListResponse {
  inProgress: boolean
  tasks: FrameExtractStatus[]
}
```

### 1.2 新增配置 (`scanner/config.js`)

在配置文件中添加帧提取器配置：

```javascript
frameExtract: {
  // 默认参数
  defaultInterval: 1,       // 默认帧间隔（秒）
  defaultQuality: 3,        // 默认 JPEG 质量
  defaultOutputWidth: -1,   // 默认宽度（-1=保持比例）
  defaultOutputHeight: -1,  // 默认高度（-1=保持比例）

  // 输出目录配置
  outputDir: null,  // null=在视频同目录下创建子文件夹

  // 打包配置
  zipQuality: 5,  // ZIP 压缩级别 (0-9)

  // 任务清理
  maxTaskAge: 24 * 60 * 60 * 1000,  // 任务保留 24 小时
  maxCompletedTasks: 20,  // 最大保留已完成任务数
}
```

---

## 第二部分：后端实现

### 2.1 帧提取核心模块 (`scanner/frameExtractor.js`)

创建新模块，功能包括：

| 功能 | 说明 |
|------|------|
| `checkFFmpeg()` | 检查 FFmpeg 是否可用（复用现有） |
| `getVideoDuration()` | 获取视频时长（复用现有） |
| `extractFramesInRange()` | 在指定时间范围内提取帧 |
| `packageFramesToZip()` | 将提取的帧打包成 ZIP |
| `abortFrameExtract()` | 中止正在进行的提取任务 |
| `cleanupOldTasks()` | 清理旧任务文件 |

**关键函数设计：**

```javascript
// 提取指定时间范围内的帧
async function extractFramesInRange(
  ffmpegPath,
  videoPath,
  outputDir,
  params,
  onProgress,
  abortController
)

// 将帧打包成 ZIP
async function packageFramesToZip(frameFiles, zipPath)

// 中止任务
function abortFrameExtract(taskId)
```

### 2.2 帧提取任务管理 (`scanner/FrameTaskSemaphore.js`)

类似现有的雪碧图任务管理模式，创建任务队列管理：
- 任务队列管理
- 并发控制
- 任务状态跟踪
- 任务中止支持

### 2.3 帧提取 API 路由 (`server/routes/frameExtract.js`)

新增 API 端点：

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/frame-extract/start` | 开始帧提取任务 |
| GET | `/api/frame-extract/status` | 获取所有任务状态 |
| GET | `/api/frame-extract/status/:taskId` | 获取单个任务状态 |
| POST | `/api/frame-extract/abort` | 中止任务 |
| GET | `/api/frame-extract/download/:taskId` | 下载提取的帧 (ZIP) |
| GET | `/api/frame-extract/preview/:taskId/:frameIndex` | 预览单帧图片 |
| POST | `/api/frame-extract/clear-history` | 清除历史任务 |

### 2.4 WebSocket 事件 (`server/websocket.js`)

新增事件类型：

| 事件 | 说明 |
|------|------|
| `frameExtract:status` | 任务状态更新 |
| `frameExtract:progress` | 任务进度更新 |
| `frameExtract:completed` | 任务完成 |
| `frameExtract:error` | 任务出错 |

### 2.5 后端集成 (`server/app.js` 和 `server/index.js`)

- 注册新路由
- 在启动日志中显示新 API 端点

---

## 第三部分：前端实现

### 3.1 新增视图页面 (`frontend/src/views/FrameExtractView.vue`)

页面结构：

```
┌─────────────────────────────────────────────────────┐
│  🎬 帧提取器            [导航栏]                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌─────────────────────────────────────────────┐  │
│  │  1. 选择视频                                │  │
│  │  [视频选择器组件]                           │  │
│  └─────────────────────────────────────────────┘  │
│                                                     │
│  ┌─────────────────────────────────────────────┐  │
│  │  2. 配置参数                                │  │
│  │  [时间范围选择器]                           │  │
│  │  [帧间隔] [输出质量] [分辨率]               │  │
│  └─────────────────────────────────────────────┘  │
│                                                     │
│  [开始提取] [重置]                                  │
│                                                     │
│  ┌─────────────────────────────────────────────┐  │
│  │  3. 任务进度                                │  │
│  │  [任务列表]                                 │  │
│  └─────────────────────────────────────────────┘  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 3.2 新增组件

#### 3.2.1 `frontend/src/components/VideoSelector.vue`

视频选择组件：
- 支持从现有视频库中选择
- 显示视频缩略图和时长
- 搜索/过滤功能

#### 3.2.2 `frontend/src/components/TimeRangeSelector.vue`

时间范围选择器：
- 支持秒级精度的时间输入
- 预设范围按钮（开头 10 秒、最后 10 秒、全片等）

#### 3.2.3 `frontend/src/components/FrameExtractParamsForm.vue`

参数表单组件：
- 帧间隔输入
- 质量选择器
- 分辨率设置
- 预计输出帧数估算

#### 3.2.4 `frontend/src/components/FrameExtractTaskList.vue`

任务列表组件：
- 显示所有任务状态
- 进度条
- 中止按钮
- 下载按钮
- 预览功能（已完成的任务）

#### 3.2.5 `frontend/src/components/FrameGallery.vue`

帧预览图库：
- 网格展示提取的帧
- 点击放大查看
- 单张下载

### 3.3 路由配置 (`frontend/src/router/index.ts`)

添加新路由：

```typescript
{
  path: '/frame-extract',
  name: 'frameExtract',
  component: () =&gt; import('@/views/FrameExtractView.vue'),
}
```

### 3.4 导航栏更新 (`frontend/src/components/AppHeader.vue`)

在导航菜单中添加"帧提取器"链接：

```vue
&lt;router-link
  to="/frame-extract"
  :class="[
    'px-4 py-2 rounded-lg transition-colors flex items-center gap-2',
    isActiveRoute('/frame-extract') ? 'bg-purple-600 text-white' : 'text-slate-300 hover:bg-slate-700'
  ]"
&gt;
  📸 帧提取器
&lt;/router-link&gt;
```

### 3.5 状态管理 (`frontend/src/stores/frameExtractStore.ts`)

创建新的 Pinia store：

```typescript
export const useFrameExtractStore = defineStore('frameExtract', {
  state: () =&gt; ({
    taskStatusMap: new Map&lt;string, FrameExtractStatus&gt;(),
    ws: null as WebSocket | null,
  }),

  getters: {
    allTasks: (state): FrameExtractStatus[] =&gt; {
      // 返回排序后的任务列表
    },
    activeTasksCount: (state): number =&gt; {
      // 统计进行中的任务
    },
  },

  actions: {
    async startTask(videoPath: string, params: FrameExtractParams): Promise&lt;FrameExtractResponse&gt;,
    async abortTask(taskId: string): Promise&lt;void&gt;,
    async loadTaskStatus(): Promise&lt;void&gt;,
    async clearHistory(): Promise&lt;void&gt;,
    connectWebSocket(): void,
    disconnectWebSocket(): void,
  },
})
```

---

## 第四部分：文件结构变更

### 新增文件

```
video-browser/
├── docs/
│   └── FFMPEG_FRAME_EXTRACTOR_PLAN.md       # 本文档
├── scanner/
│   ├── frameExtractor.js                    # 帧提取核心模块
│   └── FrameTaskSemaphore.js                # 任务队列管理
├── server/
│   └── routes/
│       └── frameExtract.js                  # 帧提取 API 路由
└── frontend/
    └── src/
        ├── views/
        │   └── FrameExtractView.vue         # 帧提取页面
        ├── components/
        │   ├── VideoSelector.vue            # 视频选择器
        │   ├── TimeRangeSelector.vue        # 时间范围选择器
        │   ├── FrameExtractParamsForm.vue   # 参数表单
        │   ├── FrameExtractTaskList.vue     # 任务列表
        │   └── FrameGallery.vue             # 帧预览图库
        └── stores/
            └── frameExtractStore.ts         # 状态管理
```

### 修改文件

```
video-browser/
├── scanner/
│   └── config.js                            # 添加帧提取配置
├── server/
│   ├── app.js                               # 注册新路由
│   ├── index.js                             # 显示新 API 端点
│   └── websocket.js                         # 添加帧提取事件
└── frontend/
    └── src/
        ├── types.ts                         # 添加类型定义
        ├── router/index.ts                  # 添加新路由
        └── components/
            └── AppHeader.vue                # 添加导航链接
```

---

## 第五部分：实现阶段和步骤

### 阶段一：基础架构和类型定义

**预估复杂度：** 低 (2/10)

| 步骤 | 任务 |
|------|------|
| 1 | 在 `frontend/src/types.ts` 中添加类型定义 |
| 2 | 在 `scanner/config.js` 中添加帧提取配置 |
| 3 | 创建 `scanner/frameExtractor.js` 基础结构 |
| 4 | 创建 `scanner/FrameTaskSemaphore.js` 基础结构 |
| 5 | 创建 `server/routes/frameExtract.js` 基础路由 |
| 6 | 在 `server/app.js` 和 `server/index.js` 中集成 |

### 阶段二：后端核心功能实现

**预估复杂度：** 中高 (7/10)

| 步骤 | 任务 |
|------|------|
| 7 | 实现 `frameExtractor.js` 中的 `extractFramesInRange()` |
| 8 | 实现 `frameExtractor.js` 中的 `packageFramesToZip()` |
| 9 | 实现 `frameExtractor.js` 中的 `abortFrameExtract()` |
| 10 | 实现 `FrameTaskSemaphore.js` 完整的任务管理 |
| 11 | 实现 `frameExtract.js` API 路由的所有端点 |
| 12 | 在 `websocket.js` 中添加帧提取事件广播 |

### 阶段三：前端基础视图和路由

**预估复杂度：** 中 (4/10)

| 步骤 | 任务 |
|------|------|
| 13 | 创建 `frameExtractStore.ts` Pinia store |
| 14 | 创建 `FrameExtractView.vue` 页面骨架 |
| 15 | 在 `router/index.ts` 中添加路由 |
| 16 | 在 `AppHeader.vue` 中添加导航链接 |

### 阶段四：前端组件实现

**预估复杂度：** 中高 (6/10)

| 步骤 | 任务 |
|------|------|
| 17 | 创建 `VideoSelector.vue` 组件 |
| 18 | 创建 `TimeRangeSelector.vue` 组件 |
| 19 | 创建 `FrameExtractParamsForm.vue` 组件 |
| 20 | 创建 `FrameExtractTaskList.vue` 组件 |
| 21 | 创建 `FrameGallery.vue` 组件 |
| 22 | 在 `FrameExtractView.vue` 中集成所有组件 |

### 阶段五：集成和测试

**预估复杂度：** 中 (5/10)

| 步骤 | 任务 |
|------|------|
| 23 | 前后端集成测试 |
| 24 | WebSocket 实时更新测试 |
| 25 | ZIP 下载功能测试 |
| 26 | 任务中止测试 |
| 27 | 边界情况测试（超大视频、空时间范围等） |
| 28 | UI 响应式测试 |

---

## 第六部分：API 设计详解

### 6.1 POST `/api/frame-extract/start`

**请求：**

```json
{
  "videoPath": "D:/Videos/video.mp4",
  "params": {
    "startTime": 0,
    "endTime": 60,
    "interval": 1,
    "quality": 3,
    "outputWidth": 1920,
    "outputHeight": 1080
  }
}
```

**响应：**

```json
{
  "success": true,
  "message": "任务已开始",
  "taskId": "extract-abc123"
}
```

### 6.2 GET `/api/frame-extract/status`

**响应：**

```json
{
  "inProgress": true,
  "tasks": [
    {
      "id": "extract-abc123",
      "videoPath": "D:/Videos/video.mp4",
      "status": "running",
      "stage": "extracting",
      "percent": 45,
      "totalFrames": 60,
      "extractedFrames": 27
    }
  ]
}
```

### 6.3 GET `/api/frame-extract/download/:taskId`

- **Content-Type:** `application/zip`
- **Content-Disposition:** `attachment; filename="video_frames_20240530_123456.zip"`

### 6.4 WebSocket 事件

**`frameExtract:progress` 事件：**

```json
{
  "type": "frameExtract:progress",
  "data": {
    "taskId": "extract-abc123",
    "status": "running",
    "stage": "extracting",
    "percent": 45,
    "totalFrames": 60,
    "extractedFrames": 27,
    "message": "正在提取帧... 27/60"
  }
}
```

---

## 第七部分：FFmpeg 参数设计

### 帧提取命令

```bash
ffmpeg -y \
  -ss {startTime} \
  -t {duration} \
  -i {videoPath} \
  -vf "fps=1/{interval},scale={width}:{height}" \
  -q:v {quality} \
  {outputDir}/frame_%05d.jpg
```

**参数说明：**

| 参数 | 说明 |
|------|------|
| `-ss` | 开始时间（秒） |
| `-t` | 持续时长（秒） |
| `-i` | 输入文件 |
| `-vf "fps=1/{interval}"` | 每 {interval} 秒取一帧 |
| `-vf "scale={w}:{h}"` | 缩放到指定尺寸 |
| `-q:v` | JPEG 质量（1-31，1=最好） |

---

## 第八部分：依赖管理

### 新增依赖

需要安装 `archiver` 包用于 ZIP 打包：

```bash
npm install archiver
```

### 安装位置

- 在项目根目录安装（与现有的 `express`、`ws` 等同级）

---

## 第九部分：复用现有代码

### 可复用的现有功能

| 功能 | 来源 | 说明 |
|------|------|------|
| `checkFFmpeg()` | `scanner/spriteGenerator.js` | 检查 FFmpeg 是否可用 |
| `getVideoDuration()` | `scanner/spriteGenerator.js` | 获取视频时长 |
| 任务队列模式 | `scanner/SpriteThreadPool.js` | 用于管理并发任务 |
| WebSocket 基础设施 | `server/websocket.js` | 实时通信 |
| 路径验证中间件 | `server/middleware/path.js` | 安全检查 |
| 视频信息中间件 | `server/middleware/video-info.js` | 获取视频 ID/标题 |

---

## 第十部分：安全性考虑

### 10.1 路径验证

使用现有的 `isPathAllowed()` 中间件验证所有视频路径。

### 10.2 输入验证

验证所有参数：
- `startTime` &gt;= 0
- `endTime` &gt; `startTime`
- `interval` &gt;= 0.1
- `quality` 1-31
- `outputWidth`/`outputHeight` 合理范围

### 10.3 文件清理

- 任务完成后保留 ZIP，但清理临时文件夹
- 定时清理旧任务（24小时）
- 限制同时运行的任务数量

---

## 第十一部分：错误处理

### 11.1 错误类型

| 错误类型 | 说明 |
|----------|------|
| FFmpeg 不可用 | 提示用户配置 FFmpeg |
| 视频不存在 | 404 错误 |
| 无效参数 | 400 错误 |
| 磁盘空间不足 | 500 错误 |
| 任务中止 | 用户主动取消 |

### 11.2 用户友好的错误信息

前端应该显示：
- 错误发生在哪个阶段（分析、提取、打包）
- 可能的原因
- 建议的解决方法

---

## 第十二部分：UI/UX 设计要点

### 12.1 视觉风格

- 使用紫色系主题（与现有蓝色、青色区分）
- 保持与现有 UI 一致的卡片、按钮风格
- 动画反馈（进度条、状态变化）

### 12.2 用户体验

- **智能预设：** 提供常用的提取方案
- **实时估算：** 显示预计输出文件大小和帧数
- **预览功能：** 任务完成后可快速浏览提取的帧
- **批量操作：** 支持从视频列表中右键选择"提取帧"

### 12.3 响应式设计

- 移动端：单列布局
- 平板：双列
- 桌面：三列网格

---

## 第十三部分：测试策略

### 13.1 单元测试

- FFmpeg 参数生成逻辑
- 任务状态管理
- 参数验证

### 13.2 集成测试

- API 端点
- WebSocket 事件
- ZIP 文件生成和解压

### 13.3 E2E 测试

- 完整的用户流程：选择视频 → 配置参数 → 开始提取 → 下载结果

---

## 第十四部分：后续优化（可选）

### 14.1 增强功能

- 支持导出为 GIF/WebP
- 支持自定义命名模式
- 视频预览缩略图（用于时间范围选择）
- 保存/加载预设配置

### 14.2 性能优化

- 多线程提取（对于超长视频）
- 增量提取（从上次中断处继续）
- 预览图缓存

---

## 总结

| 指标 | 评估 |
|------|------|
| 预估总工作量 | 约 28 个步骤 |
| 新增文件数 | 11 个 |
| 修改文件数 | 7 个 |
| 代码行数（预估） | 后端 ~1000，前端 ~1500 |
| 复杂度 | 中高 |
| 风险 | 低（架构模式成熟） |
| 可测试性 | 高（模块化设计） |

---

## 附录：Quick Reference

### FFmpeg 帧提取快速参考

```bash
# 基本帧提取
ffmpeg -ss 0 -t 60 -i video.mp4 -vf "fps=1" -q:v 3 frame_%05d.jpg

# 自定义尺寸
ffmpeg -ss 0 -t 60 -i video.mp4 -vf "fps=1,scale=1280:-1" -q:v 3 frame_%05d.jpg

# 使用 archiver 创建 ZIP (Node.js)
const archiver = require('archiver');
const output = fs.createWriteStream('frames.zip');
const archive = archiver('zip', { zlib: { level: 5 } });
archive.pipe(output);
archive.directory('temp-frames/', false);
archive.finalize();
```
