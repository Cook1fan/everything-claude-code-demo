// 扫描器配置文件
// 请根据你的实际情况修改这里的配置

module.exports = {
  // 要扫描的硬盘路径列表
  // Windows 示例: ['E:', 'F:', 'G:', 'H:']
  // macOS/Linux 示例: ['/Volumes/Video1', '/Volumes/Video2']
  hardDrives: [
    // 在这里添加你的移动硬盘路径，例如：
    'E:',
    'F:',
    'G:',
    'W:',
  ],

  // 视频文件扩展名（不区分大小写）
  videoExtensions: ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.flv', '.wmv', '.m4v'],

  // 海报图片扩展名（不区分大小写）
  posterExtensions: ['.jpg', '.jpeg', '.png', '.webp', '.gif'],

  // 海报文件命名优先级（按顺序匹配）
  posterNames: ['poster', 'cover', 'folder', 'thumb', 'thumbnail'],

  // 输出文件路径
  outputPath: './data/videos.json',

  // 是否递归扫描子目录
  recursive: true,

  // 最小视频文件大小（字节），默认 1MB，过滤掉小文件
  minVideoSize: 1024 * 1024,
};
