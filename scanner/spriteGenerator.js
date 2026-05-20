const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const config = require('./config');

// 跟踪正在运行的 FFmpeg 进程
const runningProcesses = new Map(); // videoPath -> { ffmpegProc, tempDir, abortFlag, startedAt }

// 跟踪所有临时目录，用于进程退出时清理
const TEMP_DIRS = new Set();

// 超时配置（30分钟）
const PROCESS_TIMEOUT = 30 * 60 * 1000;

// 定期清理超时进程（每5分钟检查一次）
let staleProcessCheckInterval = null;

// 根据视频时长动态计算最佳帧间隔
// 表格规则：
// <30 分钟     → 5 秒
// 30分钟-1小时 → 8 秒
// 1-3 小时     → 10 秒
// 3-6 小时     → 15 秒
// 6-8 小时     → 20 秒
// >8 小时      → 20 秒 (8小时上限)
function calculateOptimalInterval(duration, configInterval = 10) {
  const minutes = duration / 60;
  const hours = minutes / 60;
  let interval;

  if (minutes < 30) {
    interval = 5;
  } else if (minutes <= 60) { // 30分钟 - 1小时
    interval = 8;
  } else if (hours <= 3) { // 1-3小时
    interval = 10;
  } else if (hours <= 6) { // 3-6小时
    interval = 15;
  } else { // 6小时以上
    interval = 20;
  }

  const estimatedFrames = Math.ceil(duration / interval);
  console.log(`视频时长 ${duration} 秒 (${minutes.toFixed(1)}分钟)，帧间隔: ${interval}s，预计 ${estimatedFrames} 帧`);
  return interval;
}

// 检查 FFmpeg 是否可用
function checkFFmpeg() {
  return new Promise((resolve) => {
    const ffmpegPath = config.ffmpeg?.path || './ffmpeg.exe';

    const projectRootPath = path.join(__dirname, '..', ffmpegPath.replace(/^\.\//, ''));
    if (fs.existsSync(projectRootPath)) {
      console.log('找到 FFmpeg:', projectRootPath);
      resolve({ available: true, path: projectRootPath });
      return;
    }

    if (fs.existsSync(ffmpegPath)) {
      console.log('找到 FFmpeg:', ffmpegPath);
      resolve({ available: true, path: ffmpegPath });
      return;
    }

    execFile('ffmpeg', ['-version'], (error) => {
      if (!error) {
        resolve({ available: true, path: 'ffmpeg' });
      } else {
        resolve({
          available: false,
          path: null,
          message: 'FFmpeg 未找到。请下载 FFmpeg 并配置路径。'
        });
      }
    });
  });
}

// 获取视频时长（使用 FFmpeg）
function getVideoDuration(ffmpegPath, videoPath) {
  return new Promise((resolve, reject) => {
    execFile(ffmpegPath, ['-i', videoPath], (error, stdout, stderr) => {
      const durationMatch = stderr.match(/Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
      if (durationMatch) {
        const hours = parseInt(durationMatch[1]);
        const minutes = parseInt(durationMatch[2]);
        const seconds = parseInt(durationMatch[3]);
        const totalSeconds = hours * 3600 + minutes * 60 + seconds;
        resolve(totalSeconds);
      } else {
        reject(new Error('无法获取视频时长'));
      }
    });
  });
}

// 注册临时目录，便于统一清理
function registerTempDir(tempDir) {
  TEMP_DIRS.add(tempDir);
}

// 清理所有已注册的临时目录
function cleanupAllTempDirs() {
  console.log('[SpriteGenerator] 清理所有临时目录...');
  for (const tempDir of TEMP_DIRS) {
    try {
      if (fs.existsSync(tempDir)) {
        cleanupTempDir(tempDir);
        console.log(`[SpriteGenerator] 已删除临时目录: ${tempDir}`);
      }
    } catch (err) {
      console.error(`[SpriteGenerator] 删除临时目录失败 ${tempDir}:`, err);
    }
  }
  TEMP_DIRS.clear();
}

// 清理超时进程
function cleanupStaleProcesses() {
  const now = Date.now();
  for (const [videoPath, entry] of runningProcesses) {
    if (now - entry.startedAt > PROCESS_TIMEOUT) {
      console.warn(`[SpriteGenerator] 清理超时进程: ${videoPath}`);
      try {
        if (entry.ffmpegProc) {
          entry.ffmpegProc.kill('SIGKILL');
        }
        // 清理临时目录
        if (entry.tempDir) {
          cleanupTempDir(entry.tempDir);
          TEMP_DIRS.delete(entry.tempDir);
        }
        runningProcesses.delete(videoPath);
      } catch (e) {
        console.warn(`[SpriteGenerator] 清理超时进程失败 ${videoPath}:`, e);
      }
    }
  }
}

// 在系统临时目录创建临时文件夹
function createTempDir() {
  const tempDir = path.join(os.tmpdir(), `sprite-gen-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  fs.mkdirSync(tempDir, { recursive: true });
  registerTempDir(tempDir);
  return tempDir;
}

// 清理临时目录（递归删除，不抛出异常掩盖原始错误）
function cleanupTempDir(tempDir) {
  try {
    if (fs.existsSync(tempDir)) {
      const files = fs.readdirSync(tempDir);
      for (const file of files) {
        const fullPath = path.join(tempDir, file);
        try {
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            cleanupTempDir(fullPath);
          } else {
            fs.unlinkSync(fullPath);
          }
        } catch (err) {
          console.warn('清理临时文件失败:', fullPath, err.message);
        }
      }
      fs.rmdirSync(tempDir);
      TEMP_DIRS.delete(tempDir);
    }
  } catch (err) {
    console.warn('清理临时目录失败:', tempDir, err.message);
  }
}

// 使用 FFmpeg 提取帧
function extractFrames(ffmpegPath, videoPath, tempDir, interval, duration, thumbnailWidth, quality = 3, onProgress) {
  return new Promise((resolve, reject) => {
    const totalFrames = Math.ceil(duration / interval);

    if (onProgress) {
      onProgress({ stage: 'extracting', percent: 0, message: `正在提取帧（每${interval}秒一帧）...`, totalFrames });
    }

    console.log('开始提取帧，源视频:', videoPath);
    console.log('视频时长:', duration, '秒, 预计帧数:', totalFrames);

    const outputPattern = path.join(tempDir, 'frame_%04d.jpg');

    const thumbnailHeight = Math.round(thumbnailWidth * 9 / 16);

    const args = [
      '-y',
      '-err_detect', 'ignore_err',
      '-fflags', '+genpts+igndts+discardcorrupt+fastseek',
      '-max_error_rate', '1.0',
      '-skip_frame', 'nokey',
      '-thread_queue_size', '1024',
      '-i', videoPath,
      '-an',
      '-sn',
      '-vf', `fps=1/${interval},scale=${thumbnailWidth}:${thumbnailHeight}`,
      '-fps_mode', 'vfr',
      '-q:v', String(quality),
      '-threads', String(os.cpus().length),
      '-f', 'image2',
      outputPattern
    ];

    console.log('FFmpeg参数:', args.join(' '));

    let extractError = null;
    let frameCheckInterval = null;
    let lastFrameCount = 0;
    let stuckCount = 0;
    const maxStuckCount = 120;
    let aborted = false;

    const proc = execFile(ffmpegPath, args, (error, stdout, stderr) => {
      // 清理进程跟踪
      runningProcesses.delete(videoPath);

      if (aborted) {
        console.log('任务已中止:', path.basename(videoPath));
        reject(new Error('任务已中止'));
        return;
      }

      if (error) {
        console.log('FFmpeg返回错误:', error.message);
        extractError = error;
      }

      if (stderr && stderr.length > 0) {
        console.log('FFmpeg stderr:', stderr.substring(Math.max(0, stderr.length - 500)));
      }

      let frames = [];
      try {
        if (fs.existsSync(tempDir)) {
          frames = fs.readdirSync(tempDir)
            .filter(f => f.startsWith('frame_') && f.endsWith('.jpg'))
            .sort();
        }
      } catch (e) {
        console.log('读取帧目录失败:', e.message);
      }

      console.log('提取到的帧数:', frames.length);

      if (frames.length > 0) {
        if (onProgress) {
          onProgress({ stage: 'extracting', percent: 99, message: '帧提取完成', frameCount: frames.length, totalFrames });
        }
        resolve({
          framePaths: frames.map(f => path.join(tempDir, f)),
          interval: interval
        });
      } else if (extractError) {
        reject(extractError);
      } else {
        resolve({
          framePaths: frames.map(f => path.join(tempDir, f)),
          interval: interval
        });
      }
    });

    // 跟踪这个进程
    runningProcesses.set(videoPath, { ffmpegProc: proc, tempDir, abortFlag: false, startedAt: Date.now() });

    frameCheckInterval = setInterval(() => {
      // 检查是否被中止
      const procInfo = runningProcesses.get(videoPath);
      if (procInfo && procInfo.abortFlag) {
        console.log('检测到中止信号，正在终止 FFmpeg...');
        aborted = true;
        try {
          proc.kill();
        } catch (e) {
          console.log('终止进程失败:', e.message);
        }
        if (frameCheckInterval) {
          clearInterval(frameCheckInterval);
          frameCheckInterval = null;
        }
        return;
      }

      try {
        let frames = [];
        if (fs.existsSync(tempDir)) {
          frames = fs.readdirSync(tempDir)
            .filter(f => f.startsWith('frame_') && f.endsWith('.jpg'));
        }

        if (frames.length === lastFrameCount) {
          stuckCount++;
          if (stuckCount >= maxStuckCount) {
            console.log('FFmpeg 似乎卡住了，强制终止...');
            try {
              proc.kill();
            } catch (e) {
              console.log('终止进程失败:', e.message);
            }
          }
        } else {
          stuckCount = 0;
          lastFrameCount = frames.length;
        }

        if (onProgress && totalFrames > 0) {
          // FFmpeg还在运行时，最大只到98%，等真正完成了再到99%
          const percent = Math.min(98, Math.round((frames.length / totalFrames) * 99));
          onProgress({
            stage: 'extracting',
            percent,
            message: `正在提取帧... ${frames.length}/${totalFrames}`,
            frameCount: frames.length,
            totalFrames
          });
        }
      } catch (e) {
        console.log('检查进度出错:', e.message);
      }
    }, 1000);

    proc.on('close', () => {
      if (frameCheckInterval) {
        clearInterval(frameCheckInterval);
        frameCheckInterval = null;
      }
    });
  });
}

// 中止单个视频的雪碧图生成
function abortSpriteGeneration(videoPath) {
  const procInfo = runningProcesses.get(videoPath);
  if (!procInfo) {
    return { success: false, message: '没有找到正在运行的任务' };
  }

  console.log('正在中止雪碧图生成:', path.basename(videoPath));
  procInfo.abortFlag = true;

  // 尝试直接终止进程
  try {
    if (procInfo.ffmpegProc) {
      procInfo.ffmpegProc.kill();
    }
  } catch (e) {
    console.log('终止 FFmpeg 进程失败:', e.message);
  }

  return { success: true, message: '已发送中止信号' };
}

// 使用 FFmpeg 合并帧为雪碧图
function createSprite(ffmpegPath, framePaths, outputPath, columns, thumbnailWidth, onProgress) {
  return new Promise((resolve, reject) => {
    if (framePaths.length === 0) {
      reject(new Error('没有帧可以合并'));
      return;
    }

    if (onProgress) {
      onProgress({ stage: 'merging', percent: 99.2, message: '正在合并雪碧图...' });
    }

    const listFile = path.join(path.dirname(outputPath), '.frames_list.txt');
    const listContent = framePaths.map(f => `file '${f.replace(/\\/g, '/')}'`).join('\n');
    fs.writeFileSync(listFile, listContent);

    const rows = Math.ceil(framePaths.length / columns);

    const args = [
      '-f', 'concat',
      '-safe', '0',
      '-i', listFile,
      '-vf', `scale=${thumbnailWidth}:-1,tile=${columns}x${rows}`,
      '-q:v', '1',
      '-qmin', '1',
      '-qmax', '1',
      '-y',
      outputPath
    ];

    execFile(ffmpegPath, args, (error) => {
      if (fs.existsSync(listFile)) {
        fs.unlinkSync(listFile);
      }

      if (error) {
        reject(error);
      } else {
        if (onProgress) {
          onProgress({ stage: 'merging', percent: 99.5, message: '正在保存信息...' });
        }
        resolve(outputPath);
      }
    });
  });
}

// 生成雪碧图信息文件（JSON）
function createSpriteInfo(outputPath, frameCount, interval, columns, thumbnailWidth, duration) {
  const infoPath = outputPath.replace(/\.(jpg|jpeg|png)$/, '.json');
  const rows = Math.ceil(frameCount / columns);
  const thumbnailHeight = Math.round(thumbnailWidth * 9 / 16);

  const info = {
    version: '1.0',
    frameCount,
    interval,
    columns,
    rows,
    thumbnailWidth,
    thumbnailHeight,
    duration,
    frames: []
  };

  for (let i = 0; i < frameCount; i++) {
    info.frames.push({
      index: i,
      time: i * interval,
      x: (i % columns) * thumbnailWidth,
      y: Math.floor(i / columns) * thumbnailHeight,
    });
  }

  fs.writeFileSync(infoPath, JSON.stringify(info, null, 2));
  return infoPath;
}

// 生成 VTT 缩略图文件
function createSpriteVTT(outputPath, frameCount, interval, columns, thumbnailWidth, duration) {
  const vttPath = outputPath.replace(/\.(jpg|jpeg|png)$/, '.vtt');
  const spriteFileName = path.basename(outputPath);
  const rows = Math.ceil(frameCount / columns);
  const thumbnailHeight = Math.round(thumbnailWidth * 9 / 16);

  // 格式化时间为 HH:MM:SS.mmm
  function formatTime(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toFixed(3).padStart(6, '0')}`;
  }

  let vttContent = 'WEBVTT\n\n';

  for (let i = 0; i < frameCount; i++) {
    const startSec = i * interval;
    const endSec = Math.min(startSec + interval, duration);
    const x = (i % columns) * thumbnailWidth;
    const y = Math.floor(i / columns) * thumbnailHeight;

    vttContent += `${formatTime(startSec)} --> ${formatTime(endSec)}\n`;
    vttContent += `${spriteFileName}#xywh=${x},${y},${thumbnailWidth},${thumbnailHeight}\n\n`;
  }

  fs.writeFileSync(vttPath, vttContent, 'utf-8');
  return vttPath;
}

// 从雪碧图 JSON 信息文件生成 VTT 文件
function createVttFromJson(spritePath) {
  const jsonPath = spritePath.replace(/\.(jpg|jpeg|png)$/, '.json');
  const vttPath = spritePath.replace(/\.(jpg|jpeg|png)$/, '.vtt');

  // 如果 VTT 已存在，不需要重新生成
  if (fs.existsSync(vttPath)) {
    return vttPath;
  }

  // 如果 JSON 不存在，无法生成
  if (!fs.existsSync(jsonPath)) {
    return null;
  }

  try {
    const info = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    return createSpriteVTT(
      spritePath,
      info.frameCount,
      info.interval,
      info.columns,
      info.thumbnailWidth,
      info.duration
    );
  } catch (err) {
    console.warn(`生成 VTT 文件失败 (${jsonPath}):`, err.message);
    return null;
  }
}

// 主函数：生成视频雪碧图
async function generateSprite(videoPath, options = {}, onProgress, abortController) {
  const startTime = Date.now();
  const ffmpegCheck = await checkFFmpeg();
  if (!ffmpegCheck.available) {
    throw new Error(ffmpegCheck.message || 'FFmpeg 不可用');
  }

  // 检查是否已被中止
  if (abortController && abortController.signal.aborted) {
    throw new Error('任务已中止');
  }

  const ffmpegPath = ffmpegCheck.path;
  const spriteConfig = { ...config.ffmpeg?.sprite, ...options };

  const {
    interval: configInterval = 10,
    columns = 5,
    thumbnailWidth = 320,
    quality = 3,
  } = spriteConfig;

  const videoDir = path.dirname(videoPath);
  const videoName = path.basename(videoPath, path.extname(videoPath));
  const outputPath = path.join(videoDir, `${videoName}_sprite.jpg`);
  const infoPath = outputPath.replace(/\.(jpg|jpeg|png)$/, '.json');

  if (options.force && fs.existsSync(outputPath)) {
    console.log('强制重新生成，删除现有雪碧图:', outputPath);
    try {
      fs.unlinkSync(outputPath);
      if (fs.existsSync(infoPath)) {
        fs.unlinkSync(infoPath);
      }
      const vttPath = outputPath.replace(/\.(jpg|jpeg|png)$/, '.vtt');
      if (fs.existsSync(vttPath)) {
        fs.unlinkSync(vttPath);
      }
    } catch (err) {
      console.warn('删除旧雪碧图失败（可能被占用），将继续:', err.message);
    }
  }

  if (fs.existsSync(outputPath)) {
    return {
      success: true,
      spritePath: outputPath,
      message: '雪碧图已存在'
    };
  }

  if (onProgress) {
    onProgress({ stage: 'starting', percent: 0, message: '正在初始化...' });
  }

  // 设置中止监听器
  let abortListener = null;
  if (abortController) {
    abortListener = () => {
      console.log('收到 AbortController 中止信号:', path.basename(videoPath));
      abortSpriteGeneration(videoPath);
    };
    abortController.signal.addEventListener('abort', abortListener);
  }

  let tempDir = null;
  try {

    const duration = await getVideoDuration(ffmpegPath, videoPath);
    console.log('视频时长:', duration, '秒');

    // 再次检查是否已被中止
    if (abortController && abortController.signal.aborted) {
      throw new Error('任务已中止');
    }

    const interval = calculateOptimalInterval(duration, configInterval);
    tempDir = createTempDir(); // 使用系统临时目录

    const extractResult = await extractFrames(
      ffmpegPath,
      videoPath,
      tempDir,
      interval,
      duration,
      thumbnailWidth,
      quality,
      onProgress
    );

    // 再次检查是否已被中止
    if (abortController && abortController.signal.aborted) {
      throw new Error('任务已中止');
    }

    const framePaths = extractResult.framePaths;
    const actualInterval = extractResult.interval;
    console.log('最终提取到', framePaths.length, '帧');

    if (framePaths.length === 0) {
      throw new Error('未能提取任何帧');
    }

    console.log('正在生成雪碧图...');
    await createSprite(ffmpegPath, framePaths, outputPath, columns, thumbnailWidth, onProgress);

    // 再次检查是否已被中止
    if (abortController && abortController.signal.aborted) {
      // 清理已生成的文件
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }
      throw new Error('任务已中止');
    }

    if (onProgress) {
      onProgress({ stage: 'saving', percent: 99.8, message: '正在保存信息文件...' });
    }
    createSpriteInfo(outputPath, framePaths.length, actualInterval, columns, thumbnailWidth, duration);
    createSpriteVTT(outputPath, framePaths.length, actualInterval, columns, thumbnailWidth, duration);

    if (onProgress) {
      onProgress({ stage: 'complete', percent: 100, message: '生成完成！' });
    }

    const totalTime = Date.now() - startTime;
    console.log('雪碧图生成完成:', outputPath);
    console.log('总用时:', (totalTime / 1000).toFixed(2), '秒');

    return {
      success: true,
      spritePath: outputPath,
      frameCount: framePaths.length,
      duration,
      totalTime: totalTime
    };
  } catch (error) {
    console.log('生成雪碧图出错:', error);
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }
    throw error;
  } finally {
    // 移除中止监听器
    if (abortController && abortListener) {
      abortController.signal.removeEventListener('abort', abortListener);
    }
    if (tempDir) {
      cleanupTempDir(tempDir);
    }
  }
}

// 进程退出时清理所有临时目录
process.on('exit', cleanupAllTempDirs);
process.on('SIGINT', () => {
  cleanupAllTempDirs();
  process.exit(0);
});
process.on('SIGTERM', () => {
  cleanupAllTempDirs();
  process.exit(0);
});
process.on('uncaughtException', (err) => {
  console.error('未捕获的异常:', err);
  cleanupAllTempDirs();
  process.exit(1);
});

// 启动定期清理超时进程（每5分钟检查一次）
if (process.env.NODE_ENV !== 'test') {
  staleProcessCheckInterval = setInterval(cleanupStaleProcesses, 5 * 60 * 1000);
}

/**
 * 清理资源（用于测试）
 */
function cleanup() {
  if (staleProcessCheckInterval) {
    clearInterval(staleProcessCheckInterval);
    staleProcessCheckInterval = null;
  }
}

module.exports = {
  checkFFmpeg,
  generateSprite,
  getVideoDuration,
  createVttFromJson,
  abortSpriteGeneration
};
