# 视频浏览网页程序 - 实现计划

> 创建日期: 2026-04-09
> 技术栈: Vue 3 + Vite + TypeScript + Tailwind CSS

## 需求概述

构建一个本地运行的网页应用，用于浏览存储在多个移动硬盘上的视频文件。

### 核心功能
- 扫描并分析移动硬盘的目录结构
- 展示视频列表，每个视频配有对应的海报图片
- 内置视频播放器，支持直接在网页中播放
- 按硬盘/目录组织浏览，方便导航
- 支持手动重新扫描功能

## 技术选型

### 前端
- **Vue 3** - 渐进式 JavaScript 框架
- **Vite** - 下一代前端构建工具
- **TypeScript** - 类型安全
- **Tailwind CSS** - 原子化 CSS 框架
- **Vue Router** - 官方路由管理器
- **Pinia** - 状态管理
- **Plyr** - 现代化视频播放器

### 工具
- **Node.js fs API** - 文件系统扫描
- **chokidar** (可选) - 文件变化监控

## 架构模式：模式 A（纯前端 + 扫描器）

### 工作原理
1. 运行扫描器脚本生成 `data/videos.json`
2. Vue 前端直接读取 JSON 文件展示
3. 提供"重新扫描"按钮，触发扫描器更新数据

### 项目结构

```
video-browser/
├── frontend/                  # Vue 3 前端
│   ├── src/
│   │   ├── components/        # 组件
│   │   │   ├── VideoCard.vue
│   │   │   ├── VideoGrid.vue
│   │   │   └── VideoPlayer.vue
│   │   ├── views/             # 页面
│   │   │   ├── HomeView.vue
│   │   │   └── VideoView.vue
│   │   ├── router/            # 路由
│   │   │   └── index.ts
│   │   ├── stores/            # 状态管理
│   │   │   └── videoStore.ts
│   │   └── App.vue
│   ├── public/
│   ├── package.json
│   └── vite.config.ts
├── scanner/                   # 目录扫描器
│   ├── scan.ts                # 扫描脚本
│   └── config.ts              # 配置文件
├── data/                      # 生成的元数据
│   └── videos.json            # 视频索引
├── scripts/                   # 辅助脚本
│   └── start.js               # 启动脚本
├── package.json               # 根 package.json
└── IMPLEMENTATION_PLAN.md     # 本文档
```

## 实现阶段

### 阶段 1：项目初始化
- [ ] 创建项目根目录
- [ ] 初始化 Vue 3 + Vite 项目
- [ ] 配置 TypeScript
- [ ] 配置 Tailwind CSS
- [ ] 安装基础依赖

### 阶段 2：目录扫描器
- [ ] 创建扫描器配置文件
- [ ] 实现目录扫描功能
- [ ] 识别视频文件（mp4, mkv, avi, mov, webm 等）
- [ ] 识别海报图片（jpg, png, webp, gif 等）
- [ ] 生成 videos.json 数据文件
- [ ] 创建扫描脚本入口

### 阶段 3：前端基础架构
- [ ] 设置 Vue Router
- [ ] 设置 Pinia Store
- [ ] 创建基础布局组件
- [ ] 配置静态资源路径

### 阶段 4：视频列表页面
- [ ] 创建 VideoCard 组件
- [ ] 创建 VideoGrid 组件
- [ ] 实现视频数据加载
- [ ] 添加按目录/硬盘分组
- [ ] 添加搜索和筛选功能
- [ ] 响应式布局

### 阶段 5：视频播放器
- [ ] 集成 Plyr 播放器
- [ ] 创建 VideoView 页面
- [ ] 实现视频播放功能
- [ ] 添加上一个/下一个导航
- [ ] 全屏播放支持
- [ ] 键盘快捷键

### 阶段 6：重新扫描功能
- [ ] 创建简单的后端服务（用于触发扫描）
- [ ] 添加"重新扫描"按钮
- [ ] 实现扫描进度反馈
- [ ] 自动刷新前端数据

### 阶段 7：优化与完善
- [ ] 添加最近播放记录
- [ ] 添加收藏功能
- [ ] 优化图片加载
- [ ] 添加加载动画
- [ ] 错误处理

## 数据模型

### Video 数据结构

```typescript
interface Video {
  id: string;
  title: string;
  directory: string;
  hardDrive: string;
  videoPath: string;
  posterPath?: string;
  videoExtension: string;
  posterExtension?: string;
  fileSize?: number;
  createdAt: number;
  updatedAt: number;
}

interface VideoData {
  version: string;
  generatedAt: number;
  hardDrives: string[];
  directories: string[];
  videos: Video[];
}
```

### videos.json 示例

```json
{
  "version": "1.0.0",
  "generatedAt": 1712649600000,
  "hardDrives": ["E:", "F:", "G:", "H:"],
  "directories": [
    "E:/Movies/Action",
    "E:/Movies/Comedy",
    "F:/TV Shows/Season 1"
  ],
  "videos": [
    {
      "id": "abc123",
      "title": "Great Movie",
      "directory": "E:/Movies/Action",
      "hardDrive": "E:",
      "videoPath": "E:/Movies/Action/Great Movie/video.mp4",
      "posterPath": "E:/Movies/Action/Great Movie/poster.jpg",
      "videoExtension": "mp4",
      "posterExtension": "jpg",
      "createdAt": 1712649600000,
      "updatedAt": 1712649600000
    }
  ]
}
```

## 扫描逻辑

### 目录结构约定
```
移动硬盘根目录/
├── 分类目录1/
│   ├── 视频目录1/
│   │   ├── video.mp4
│   │   └── poster.jpg
│   └── 视频目录2/
│       ├── movie.mkv
│       └── cover.png
└── 分类目录2/
    └── ...
```

### 扫描规则
1. 遍历配置的硬盘路径
2. 查找包含视频文件的目录
3. 同一目录下的视频文件和图片文件配对
4. 图片文件命名优先：poster, cover, folder, thumb
5. 生成唯一 ID（基于路径 hash）

## API 端点（轻量后端）

### POST /api/scan
触发重新扫描

**响应:**
```json
{
  "success": true,
  "message": "Scan started"
}
```

### GET /api/scan/status
获取扫描状态

**响应:**
```json
{
  "scanning": false,
  "lastScan": 1712649600000,
  "videoCount": 150
}
```

## 依赖列表

### 前端依赖
```json
{
  "vue": "^3.4.0",
  "vue-router": "^4.2.0",
  "pinia": "^2.1.0",
  "plyr": "^3.7.0"
}
```

### 开发依赖
```json
{
  "vite": "^5.0.0",
  "@vitejs/plugin-vue": "^5.0.0",
  "typescript": "^5.3.0",
  "tailwindcss": "^3.4.0",
  "autoprefixer": "^10.4.0",
  "postcss": "^8.4.0"
}
```

### 扫描器依赖
```json
{
  "express": "^4.18.0"
}
```

## 风险与应对

| 风险 | 级别 | 应对方案 |
|------|------|----------|
| 大视频文件加载慢 | MEDIUM | 使用流式播放，不预加载整个文件 |
| 移动硬盘断开 | HIGH | 检测文件是否存在，显示离线提示 |
| 海报图片缺失 | LOW | 显示视频图标占位图 |
| 视频格式不支持 | MEDIUM | 使用 Plyr，提示用户用本地播放器 |
| 扫描耗时过长 | LOW | 显示进度提示，支持后台扫描 |

## 复杂度估计

| 阶段 | 预估时间 |
|------|----------|
| 项目初始化 | 30 分钟 |
| 目录扫描器 | 1.5 小时 |
| 前端基础架构 | 30 分钟 |
| 视频列表页面 | 2 小时 |
| 视频播放器 | 1.5 小时 |
| 重新扫描功能 | 1 小时 |
| 优化与完善 | 1 小时 |
| **总计** | **约 8 小时** |

## 后续扩展（可选）

- [ ] 自动监控文件变化
- [ ] 视频元数据提取（时长、分辨率等）
- [ ] 播放历史记录
- [ ] 视频标签系统
- [ ] 深色/浅色主题切换
- [ ] 多种视图模式（网格/列表）

---

**计划状态:** 待实现
