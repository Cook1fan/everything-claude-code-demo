# FFmpeg 配置指南

本项目使用 FFmpeg 来生成视频雪碧图。

## 为什么不使用 npm install ffmpeg？

npm 的 `ffmpeg` 包经常安装失败，特别是在 Windows 上。我们推荐直接下载 FFmpeg 二进制文件，更稳定可靠。

## Windows 配置步骤

### 方法 1：下载 FFmpeg 到项目目录（推荐）

1. **下载 FFmpeg**
   - 访问：https://www.gyan.dev/ffmpeg/builds/
   - 下载：`ffmpeg-release-essentials.zip`
   - 或者直接链接：https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip

2. **解压文件**
   - 解压下载的 zip 文件
   - 找到 `bin` 文件夹中的 `ffmpeg.exe`

3. **放置文件**
   - 将 `ffmpeg.exe` 复制到项目根目录：
     ```
     everything-claude-code-demo/
     ├── ffmpeg.exe        ← 放在这里
     ├── package.json
     ├── scanner/
     ├── server/
     └── ...
     ```

4. **完成！**
   - 重启应用
   - 进入视频播放页面
   - 点击"生成雪碧图"按钮

### 方法 2：使用系统已安装的 FFmpeg

如果你已经安装了 FFmpeg 并添加到系统 PATH：

1. 编辑 `scanner/config.js`
2. 修改 `ffmpeg.path` 为 `'ffmpeg'`：
   ```javascript
   ffmpeg: {
     path: 'ffmpeg',  // 使用系统 PATH 中的 ffmpeg
     // ...
   }
   ```

### 方法 3：指定自定义路径

如果你想把 FFmpeg 放在其他位置：

1. 编辑 `scanner/config.js`
2. 修改 `ffmpeg.path` 为你的完整路径：
   ```javascript
   ffmpeg: {
     path: 'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe',
     // 或使用正斜杠：
     // path: 'C:/Program Files/ffmpeg/bin/ffmpeg.exe',
     // ...
   }
   ```

## 验证配置

1. 启动应用：`npm run dev`
2. 打开任意视频
3. 查看右侧面板
   - 如果看到"🗂️ 雪碧图"部分，说明 FFmpeg 已配置
   - 如果看到"⚠️ FFmpeg 未配置"，请按上述步骤配置

## 雪碧图说明

### 什么是雪碧图？

雪碧图是从视频中按时间间隔提取的关键帧，合并成的一张大图。

### 有什么用？

- 快速预览视频内容
- 可以用于进度条悬停预览（未来功能）
- 不需要播放视频就能了解大概内容

### 默认配置

在 `scanner/config.js` 中可以调整：

```javascript
ffmpeg: {
  sprite: {
    interval: 10,        // 每 10 秒提取一帧
    columns: 5,          // 每行显示 5 帧
    thumbnailWidth: 160, // 每帧宽度 160px
    quality: 2,          // JPEG 质量 (0-31，越小越好)
  }
}
```

### 生成的文件

雪碧图会保存在视频同级目录：

```
视频目录/
├── my_video.mp4
├── my_video_sprite.jpg   ← 雪碧图
└── my_video_sprite.json  ← 雪碧图信息
```

## 常见问题

### Q: 生成雪碧图需要多长时间？

A: 取决于视频长度和性能。通常：
- 短视频（<10分钟）：几秒到几十秒
- 长视频（1-2小时）：1-3分钟

### Q: 可以取消生成吗？

A: 目前还不支持，但刷新页面会重置状态。

### Q: 生成的文件太大怎么办？

A: 可以在 `scanner/config.js` 中：
- 增大 `interval`（减少帧数）
- 减小 `thumbnailWidth`（缩小每帧尺寸）
- 增大 `quality`（降低图片质量，0-31）

### Q: 可以删除已生成的雪碧图吗？

A: 可以！直接删除视频目录下的 `_sprite.jpg` 和 `_sprite.json` 文件即可。
