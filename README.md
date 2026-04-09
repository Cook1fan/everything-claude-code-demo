# 视频浏览器

一个本地运行的网页应用，用于浏览存储在多个移动硬盘上的视频文件。

## 功能特性

- 🎬 扫描并分析移动硬盘的目录结构
- 🖼️ 视频列表展示，配有海报/缩略图
- ▶️ 内置视频播放器（支持流式播放）
- 💾 按硬盘/目录组织浏览
- 🔍 搜索和筛选功能
- 🔄 一键重新扫描

## 技术栈

- **前端**: Vue 3 + Vite + TypeScript + Tailwind CSS
- **后端**: Express.js (轻量级 API)
- **播放器**: Plyr.js

## 快速开始

### 1. 安装依赖

```bash
npm run install:all
```

或者分别安装：

```bash
# 根目录依赖
npm install

# 前端依赖
cd frontend
npm install
```

### 2. 配置硬盘路径

编辑 `scanner/config.js`，添加你的移动硬盘路径：

```javascript
hardDrives: [
  'E:',    // Windows 示例
  'F:',
  // '/Volumes/Video1',  // macOS/Linux 示例
],
```

### 3. 首次扫描视频

```bash
npm run scan
```

### 4. 启动应用

```bash
npm run dev
```

这会同时启动后端服务器（端口 3000）和前端开发服务器（端口 5173）。

然后在浏览器中打开：http://localhost:5173

## 单独运行各组件

### 只运行后端服务器

```bash
npm run server
```

### 只运行前端

```bash
npm run frontend
```

### 只运行扫描器

```bash
npm run scan
```

## 目录结构约定

扫描器期望的目录结构：

```
移动硬盘根目录/
├── 电影分类1/
│   ├── 某部电影/
│   │   ├── video.mp4
│   │   └── poster.jpg
│   └── 另一部电影/
│       ├── movie.mkv
│       └── cover.png
└── 电影分类2/
    └── ...
```

### 海报图片命名优先级

1. `poster`
2. `cover`
3. `folder`
4. `thumb` / `thumbnail`

如果都没有找到，会使用目录下的第一张图片。

### 支持的视频格式

- .mp4, .mkv, .avi, .mov, .webm, .flv, .wmv, .m4v

### 支持的图片格式

- .jpg, .jpeg, .png, .webp, .gif

## 配置说明

编辑 `scanner/config.js` 可以自定义：

- `hardDrives`: 要扫描的硬盘路径列表
- `videoExtensions`: 视频文件扩展名
- `posterExtensions`: 图片文件扩展名
- `posterNames`: 海报文件命名优先级
- `minVideoSize`: 最小视频文件大小（字节），用于过滤小文件

## 项目结构

```
video-browser/
├── frontend/          # Vue 3 前端
│   ├── src/
│   │   ├── components/
│   │   ├── views/
│   │   ├── stores/
│   │   └── router/
│   └── package.json
├── scanner/           # 目录扫描器
│   ├── scan.js
│   └── config.js
├── server/            # Express API 服务器
│   └── index.js
├── data/              # 生成的元数据
│   └── videos.json
├── scripts/
│   └── start.js
├── package.json
└── README.md
```

## API 端点

- `GET /api/videos` - 获取视频列表
- `POST /api/scan` - 触发重新扫描
- `GET /api/scan/status` - 获取扫描状态
- `GET /api/video?path=...` - 视频文件流式服务
- `GET /api/image?path=...` - 图片文件服务

## 常见问题

### 视频无法播放？

- 确保视频格式是浏览器支持的（建议使用 MP4/H.264）
- 检查视频文件路径是否正确
- 确认硬盘已连接

### 扫描不到视频？

- 检查 `scanner/config.js` 中的路径配置
- 确认硬盘已挂载/连接
- 检查文件扩展名是否在配置列表中

### 如何更新视频列表？

点击网页右上角的 "🔄 重新扫描" 按钮，或运行 `npm run scan`。

## 许可证

MIT
