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
# 安装所有依赖
npm run install:all

# 同时启动后端（端口 3000）和前端（端口 5173）
npm run dev

# 扫描配置的硬盘上的视频
npm run scan

# 只启动后端服务器
npm run server

# 只启动前端
npm run frontend
```

## 架构

### 高层结构

```
video-browser/
├── frontend/          # Vue 3 + TypeScript 前端
├── scanner/           # 目录扫描器和雪碧图生成器
├── server/            # Express API 服务器
├── data/              # 生成的元数据 (videos.json)
└── scripts/           # 启动脚本
```

### 数据流

1. **扫描器** (`scanner/scan.js`) 遍历配置的硬盘，识别视频及其海报，生成 `data/videos.json`
2. **Express 服务器** (`server/index.js`) 提供：
   - 视频、扫描状态和雪碧图生成的 API 端点
   - 通过流式传输的视频文件（范围请求）
   - 图片和雪碧图 VTT 文件
   - 用于实时雪碧图生成状态的 WebSocket
3. **Vue 前端** (`frontend/src/`) 显示视频网格，通过 Plyr 播放视频，并管理播放历史

### 关键数据模型

**Video** (`frontend/src/types.ts`):
- 核心视频元数据（标题、目录、硬盘、路径）
- 缩略图雪碧图和 VTT 路径
- 时长和文件大小

**VideoPlayRecord**:
- 播放次数和总播放时长
- 用于续播的最后播放位置
- 1-10 星评分
- 视频时间戳（精彩时间点）
- 质量标记

### API 端点

```
GET  /api/videos              - 获取视频列表
POST /api/scan                - 触发重新扫描
GET  /api/scan/status         - 获取扫描状态
GET  /api/video                - 流式传输视频文件（范围请求）
GET  /api/image                - 提供图片文件
POST /api/open-video           - 用本地播放器打开视频
POST /api/open-directory       - 打开文件所在目录
GET  /api/ffmpeg/status        - 检查 FFmpeg 可用性
POST /api/sprite/generate      - 为视频生成雪碧图
GET  /api/sprite/status        - 获取雪碧图生成状态
GET  /api/sprite/info          - 获取雪碧图元数据
POST /api/sprite/batch-generate - 批量生成雪碧图
GET  /api/sprite/batch-status  - 获取批量生成状态
POST /api/sprite/batch-abort   - 中止批量生成
POST /api/frame-extract/start  - 开始帧提取任务
GET  /api/frame-extract/status - 获取所有任务状态
POST /api/frame-extract/abort  - 中止任务
GET  /api/frame-extract/download/:taskId - 下载提取结果
WebSocket: ws://localhost:3000 - 实时状态更新
```

### 关键目录

| 目录 | 用途 |
|-----------|---------|
| `frontend/src/components/` | Vue 组件 |
| `frontend/src/components/FrameExtract/` | 帧提取功能组件 |
| `frontend/src/views/` | 页面组件 (HomeView, VideoView, FrameExtractView) |
| `frontend/src/stores/` | Pinia 存储 (videoStore, playHistoryStore, frameExtractStore) |
| `frontend/src/utils/` | 工具函数 (indexedDB 本地存储) |
| `scanner/` | 目录扫描器 + FFmpeg 雪碧图/帧提取 |
| `server/routes/` | Express 路由 (sprite.js, frameExtract.js) |

### 配置

编辑 `scanner/config.js` 可以：
- 添加/删除要扫描的硬盘路径
- 调整视频/海报扩展名
- 配置 FFmpeg 雪碧图/帧提取参数

### 重要功能

- **雪碧图缩略图**: 通过 FFmpeg 生成，使用 WebVTT 显示为悬停预览
- **帧提取**: 从视频中按时间间隔提取帧，支持 JPG/PNG/WebP 格式
- **播放历史**: 存储在本地 IndexedDB 中，包含续播位置和评分
- **视频时间戳**: 用户可以标记和标注"精彩时间点"
- **批量操作**: 多视频雪碧图生成，带线程池；多任务帧提取
- **实时更新**: 雪碧图和帧提取期间通过 WebSocket 显示进度