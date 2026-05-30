export interface Video {
  id: string;
  title: string;
  directory: string;
  hardDrive: string;
  videoPath: string;
  posterPath?: string;
  spritePath?: string;
  spriteVttPath?: string;
  videoExtension: string;
  posterExtension?: string;
  fileSize?: number;
  duration?: number; // 视频总时长（秒）
  createdAt: number;
  updatedAt: number;
}

export interface DirectoryTreeNode {
  name: string;
  path: string;
  parentPath: string;
  children: DirectoryTreeNode[];
  videoCount: number;
}

export interface VideoData {
  version: string;
  generatedAt: number;
  hardDrives: string[];
  directories: string[];
  directoryTree: DirectoryTreeNode[];
  videos: Video[];
}

export interface ScanStatus {
  scanning: boolean;
  lastScan: number | null;
  videoCount: number;
}

export interface VideoTimestamp {
  id: string;
  time: number; // 时间点（秒）
  label?: string; // 标签/备注
  screenshot?: string; // 截图 base64 数据
  createdAt: number;
}

export interface VideoPlayRecord {
  videoId: string;
  playCount: number;
  totalPlayTime: number; // 总播放时长（秒）
  lastPlayedAt: number;
  rating?: number; // 1-10星评分
  timestamps?: VideoTimestamp[]; // 精彩时间点
  videoDuration?: number; // 视频总时长（秒）
  isBadQuality?: boolean; // 质量是否不好
  lastPlaybackPosition?: number; // 最后播放位置（秒）
  spriteGeneratedAt?: number; // 雪碧图生成时间
  spriteGenerateTime?: number; // 雪碧图生成耗时（毫秒）
}

export interface VideoPlaySession {
  videoId: string;
  startTime: number;
  lastUpdateTime: number;
  accumulatedTime: number;
  hasCountedPlay: boolean; // 是否已在此次页面访问中计数播放次数
}

export interface SpriteFrame {
  index: number;
  time: number;
  x: number;
  y: number;
}

export interface SpriteInfo {
  version: string;
  frameCount: number;
  interval: number;
  columns: number;
  rows: number;
  thumbnailWidth: number;
  duration: number;
  frames: SpriteFrame[];
}

export interface SpriteStatus {
  id?: string; // 任务ID
  videoPath?: string;
  videoId?: string;
  videoTitle?: string;
  status?: 'pending' | 'running' | 'completed' | 'error' | 'aborted'; // 任务状态
  queuePosition?: number; // 排队中的位置
  message?: string;
  percent?: number;
  frameCount?: number;
  totalFrames?: number;
  error?: boolean;
  errorMessage?: string;
  stage?: string;
  createdAt?: number;  // 任务开始时间
  updatedAt?: number;
  success?: boolean;
  spritePath?: string;
  duration?: number;
  totalTime?: number;
}

export interface BatchSpriteStats {
  total: number;
  completed: number;
  failed: number;
  active: number;
  pending: number;
  isRunning: boolean;
  aborted: boolean;
  done?: boolean;
  currentVideo?: {
    videoPath: string;
    percent?: number;
    message?: string;
  };
}

// Frame extractor types
export interface FrameExtractStatus {
  id: string;
  videoPath?: string;
  videoId?: string;
  videoTitle?: string;
  status: 'pending' | 'running' | 'completed' | 'error' | 'aborted';
  stage?: 'starting' | 'analyzing' | 'extracting' | 'packaging' | 'complete';
  message?: string;
  percent?: number;
  totalFrames?: number;
  extractedFrames?: number;
  error?: boolean;
  errorMessage?: string;
  createdAt?: number;
  updatedAt?: number;
  outputPath?: string;
  outputFileName?: string;
  frameFiles?: string[];
  params?: FrameExtractParams;
  totalTime?: number;
}

export interface FrameExtractParams {
  startTime: number; // Start time in seconds
  endTime: number; // End time in seconds
  interval: number; // Frame interval in seconds
  quality: number; // JPEG quality (1-31, 1=best)
  outputWidth: number; // Output width in pixels (-1=keep ratio)
  outputHeight: number; // Output height in pixels (-1=keep ratio)
  format: 'jpg' | 'png' | 'webp'; // Output image format
  outputDir?: string; // Output directory (optional)
}

export interface FrameExtractRequest {
  videoPath: string;
  params: FrameExtractParams;
}

export interface FrameExtractResponse {
  success: boolean;
  message: string;
  taskId?: string;
}

export interface FrameExtractListResponse {
  inProgress: boolean;
  tasks: FrameExtractStatus[];
}
