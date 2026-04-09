# 更新说明 - v2.0

## 主要改进

### 1. 🔧 修复视频播放问题

**问题原因：**
- 所有视频都被设置为 `video/mp4` MIME 类型
- 缺少错误处理和调试信息

**修复内容：**
- 根据文件扩展名自动检测正确的 MIME 类型
- 添加详细的服务器端日志
- 前端添加播放错误提示
- 支持的格式：mp4, webm, ogg, mkv, avi, mov, wmv, flv, m4v

**提示：** 浏览器原生支持最好的格式是 MP4 (H.264)。如果其他格式无法播放，建议转换为 MP4。

---

### 2. 📁 新增目录树导航

**新功能：**
- 可展开/收起的目录树结构
- 支持多层级目录（主演 → 年份 → 视频）
- 显示每个目录的视频数量
- 面包屑导航显示当前位置
- 点击目录自动展开路径

**使用方式：**
- 点击文件夹图标或箭头来展开/收起目录
- 点击目录名称来筛选该目录下的视频
- 点击"🏠 全部视频"返回完整列表

---

## 文件变更列表

### 后端
- `server/index.js` - 修复视频流式服务，添加 MIME 类型检测和日志
- `scanner/scan.js` - 新增目录树结构生成

### 前端
- `frontend/src/types.ts` - 新增 DirectoryTreeNode 类型
- `frontend/src/stores/videoStore.ts` - 添加目录树状态管理
- `frontend/src/views/HomeView.vue` - 重写侧边栏，使用目录树
- `frontend/src/views/VideoView.vue` - 添加错误处理和重试
- `frontend/src/components/DirectoryTree.vue` - 新增目录树组件
- `frontend/src/components/TreeNode.vue` - 新增树节点组件

---

## 如何使用

### 1. 重新安装依赖（如果需要）

```bash
npm run install:all
```

### 2. 重新扫描视频

```bash
npm run scan
```

### 3. 启动应用

```bash
npm run dev
```

---

## 目录结构示例

如果你的视频按以下方式组织：

```
E:/
├── 刘德华/
│   ├── 2020/
│   │   └── 电影A/
│   │       ├── video.mp4
│   │       └── poster.jpg
│   └── 2021/
│       └── 电影B/
│           ├── video.mp4
│           └── cover.png
└── 张学友/
    └── 2019/
        └── 电影C/
            ├── video.mp4
            └── poster.jpg
```

目录树会自动识别并展示这种层级结构！
