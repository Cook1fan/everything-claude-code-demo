export interface Video {
  id: string;
  title: string;
  directory: string;
  hardDrive: string;
  videoPath: string;
  posterPath?: string;
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
}

export interface VideoPlaySession {
  videoId: string;
  startTime: number;
  lastUpdateTime: number;
  accumulatedTime: number;
  hasCountedPlay: boolean; // 是否已在此次页面访问中计数播放次数
}
