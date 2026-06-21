# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

**视频浏览器** - 一个本地运行的网页应用，用于浏览存储在多个移动硬盘上的视频文件。

- **前端**: Vue 3 + Vite + TypeScript + Tailwind CSS
- **后端**: Express.js (轻量级 API)
- **视频播放器**: Plyr.js
- **缩略图雪碧图**: FFmpeg

## 常用命令

```bash
# 安装所有依赖（根 + frontend）
npm run install:all

# 同时启动后端（端口 3000）和前端（端口 5173）
# 实际由 scripts/start.js spawn 两个子进程，不会热重载后端代码
npm run dev

# 只启动后端 / 前端 / 扫描器
npm run server
npm run frontend
npm run scan  # 写 data/videos.json

# 后端测试（Jest + supertest；当前 ~80 个用例）
npm test                  # 跑一次
npm run test:watch        # watch 模式
npm run test:coverage     # 生成 coverage/ 报告

# 前端
cd frontend && npm run build                       # 生产构建
cd frontend && npx vue-tsc --noEmit                # 类型检查（无内置脚本）
```

## 架构

### 顶层结构

```
├── frontend/      Vue 3 + TS + Tailwind
├── scanner/       目录扫描 + FFmpeg（spawn worker 池）
├── server/        Express API（路由按资源拆文件）
├── data/          扫描产物 videos.json（gitignore）
├── scripts/       scripts/start.js 编排后端+前端 spawn
└── test/          Jest + supertest 用例（__mocks__/ 含 fs 模拟）
```

### 数据流

1. **扫描器** `scanner/scan.js` 遍历 `scanner/config.js` 配置的硬盘，识别视频及海报，写入 `data/videos.json`
2. **Express 服务器** `server/index.js` 挂载：
   - 视频/图片/雪碧图 VTT 流式 HTTP（range 请求）
   - 扫描、雪碧图、帧提取、目录删除等动作端点
   - **WebSocket** (`ws://localhost:3000`) 推送雪碧图/帧提取/扫描的实时进度
3. **Vue 前端** 从 IndexedDB 恢复应用状态，通过 Pinia store 调后端 API

### Scanner Worker 模型

- `scanner/scanWorker.js` - 单目录扫描子进程
- `scanner/spriteThreadPool.js` - FFmpeg 雪碧图并发池
- `scanner/spriteWorker.js` - 单文件雪碧图
- `scanner/frameExtractor.js` - 单文件帧提取 + `FrameTaskSemaphore.js` 多任务并发

**主进程守卫约定**：每个 worker 入口文件用 `if (require.main === module) setInterval(...)` 守护定时清理任务，避免被 jest 加载时持续运行（否则测试会超时）。

### 路径安全

所有接收 `path`/`videoPath` 参数的路由（videos、files、sprite、frameExtract、gif、deletionRecords）必须先过 `server/middleware/path.js` 的 `isPathAllowed()`，强制只允许访问 `scanner/config.js` 中配置的硬盘根路径下的文件。**新增接受路径的路由必须复用此中间件**，否则会出现 403/越权风险。

## 关键数据模型

### Video (`frontend/src/types.ts`)
核心元数据 + 缩略图雪碧图/VTT 路径 + 时长 + 文件大小。`directory` 用 `/` 拼接的相对路径（前端按 `/` 分层过滤）。

### VideoPlayRecord（IndexedDB，`playHistoryStore.ts`）
- 播放次数 / 总播放时长 / 续播位置
- 精彩时间点（每条带可选截图 + label）
- **评分自动从时间点数量派生**：`rating = Math.min(timestampCount, 10)`，`addTimestamp`/`removeTimestamp` 时自动更新；UI 不允许手动设置评分

### 应用状态（IndexedDB，`videoStore.saveStateToDB()`）
持久化：最近视频、目录展开节点、排序模式、当前页码、选中目录、搜索词、标签筛选。重启后 `initialize()` 自动恢复。

## 评分与排序规则

- **评分自动计算**：见上
- **目录智能排序**（`scanner/scan.js` `smartDirectorySort`）：
  - 一级目录：拉丁字母优先 → localeCompare
  - 二级目录：年份数字升序（2020 < 2021）
  - 三级目录：日期格式升序（YYYY-MM-DD 或 YYYYMMDD）

## API 端点

```
GET  /api/videos                    - 视频列表
POST /api/scan                      - 触发扫描
GET  /api/scan/status               - 扫描状态
GET  /api/video?path=...            - 视频流（range）
GET  /api/image?path=...            - 图片流
POST /api/open-video                - 用本地播放器打开
POST /api/open-directory            - 打开所在目录
POST /api/delete-directory          - 删除目录（同时写删除记录）
GET  /api/deletion-records?path=... - 某目录的删除记录

GET  /api/ffmpeg/status
POST /api/sprite/generate
GET  /api/sprite/status
GET  /api/sprite/info?path=...
POST /api/sprite/batch-generate
GET  /api/sprite/batch-status
POST /api/sprite/batch-abort
POST /api/sprite/abort              - 中止单个生成
POST /api/sprite/clear-history      - 清理已完成记录

POST /api/frame-extract/start       - 多任务帧提取
GET  /api/frame-extract/status
POST /api/frame-extract/abort
GET  /api/frame-extract/download/:taskId

POST /api/gif/make                  - 从 startTime 截 N 秒做 GIF
                                      body: { videoPath, startTime, duration:3-8, size:'small'|'medium'|'large' }
                                      response: image/gif + X-Actual-Duration header
                                      size: small=320p / medium=480p(默认) / large=720p
                                      实现：ffmpeg 双 pass（palettegen + paletteuse），12fps

WebSocket ws://localhost:3000       - 推送 spriteStatus / batchSpriteStatus / scanStatus / frameExtractStatus
```

## 关键目录

| 目录 | 用途 |
|---|---|
| `frontend/src/components/` | Vue 组件（含 `FrameExtract/` 子目录） |
| `frontend/src/views/` | HomeView, VideoView, FrameExtractView |
| `frontend/src/stores/` | videoStore, playHistoryStore, frameExtractStore |
| `frontend/src/utils/indexedDB.ts` | 本地持久化封装 |
| `scanner/` | 扫描 + FFmpeg 调用 + worker 池 |
| `scanner/tags.js` | 从标题正则提取标签 |
| `server/routes/` | 一个资源一个文件（videos, files, scan, sprite, frameExtract, gif, deletionRecords） |
| `server/middleware/path.js` | `isPathAllowed` 路径白名单 |

## 配置

- `scanner/config.js` - 提交的公共配置（硬盘路径、视频/海报扩展名、FFmpeg 参数）
- `scanner/config.local.js` - **本地配置，不提交**，覆盖 `TAGS` 等个人化字段
- `scanner/config.local.example.js` - 复制起点
- `frontend/.env` 等 Vite 变量按需

### 视频标签系统

```bash
# 首次设置
cp scanner/config.local.example.js scanner/config.local.js
# 编辑 TAGS 数组定义要识别的关键词
npm run scan  # 重新扫描以提取标签到 videos.json
```

筛选模式：侧栏 OR（任一匹配）/ AND（全部匹配），选择保存在 IndexedDB。

## 重要功能

- **雪碧图缩略图** - FFmpeg 生成 + WebVTT 悬停预览（Plyr `previewThumbnails`）
- **帧提取** - 按时间间隔抽帧，JPG/PNG/WebP，ZIP 打包下载，多任务并发
- **播放历史 + 续播** - IndexedDB 持久化，跨页面跨刷新
- **视频时间戳** - 用户标记 + 可选截图 + label，右键删除
- **GIF 制作** - 当前播放帧向后 3-8 秒，可选 320/480/720p（默认 480p），完成后自动下载
- **删除记录面板** - 展示被删目录的最后内容（含子目录/文件），可还原或彻底清除
- **批量操作** - 多视频雪碧图并发（线程池）、帧提取多任务
- **实时进度** - WebSocket 推送，无需轮询