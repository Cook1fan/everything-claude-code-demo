const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const config = require('./config');
const { checkFFmpeg, getVideoDuration } = require('./spriteGenerator');

// Track running processes
const runningProcesses = new Map(); // taskId -> { ffmpegProc, outputDir, abortFlag, startedAt }

// Track all temp dirs for cleanup
const TEMP_DIRS = new Set();

// Timeout config (30 minutes)
const PROCESS_TIMEOUT = 30 * 60 * 1000;

// Periodic stale process cleanup
let staleProcessCheckInterval = null;

// Register temp dir for unified cleanup
function registerTempDir(tempDir) {
  TEMP_DIRS.add(tempDir);
}

// Cleanup all registered temp dirs
function cleanupAllTempDirs() {
  console.log('[FrameExtractor] Cleaning up all temp dirs...');
  for (const tempDir of TEMP_DIRS) {
    try {
      if (fs.existsSync(tempDir)) {
        cleanupTempDir(tempDir);
        console.log(`[FrameExtractor] Deleted temp dir: ${tempDir}`);
      }
    } catch (err) {
      console.error(`[FrameExtractor] Failed to delete temp dir ${tempDir}:`, err);
    }
  }
  TEMP_DIRS.clear();
}

// Cleanup stale processes
function cleanupStaleProcesses() {
  const now = Date.now();
  for (const [taskId, entry] of runningProcesses) {
    if (now - entry.startedAt > PROCESS_TIMEOUT) {
      console.warn(`[FrameExtractor] Cleaning up stale process: ${taskId}`);
      try {
        if (entry.ffmpegProc) {
          entry.ffmpegProc.kill('SIGKILL');
        }
        runningProcesses.delete(taskId);
      } catch (e) {
        console.warn(`[FrameExtractor] Failed to cleanup stale process ${taskId}:`, e);
      }
    }
  }
}

// Create temp dir in system temp folder
function createTempDir() {
  const tempDir = path.join(os.tmpdir(), `frame-extract-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  fs.mkdirSync(tempDir, { recursive: true });
  registerTempDir(tempDir);
  return tempDir;
}

// Cleanup temp dir
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
          console.warn('Failed to cleanup temp file:', fullPath, err.message);
        }
      }
      fs.rmdirSync(tempDir);
      TEMP_DIRS.delete(tempDir);
    }
  } catch (err) {
    console.warn('Failed to cleanup temp dir:', tempDir, err.message);
  }
}

// Extract frames in specified time range
function extractFramesInRange(ffmpegPath, videoPath, outputDir, params, onProgress, abortController) {
  return new Promise((resolve, reject) => {
    const { startTime, endTime, interval, quality, outputWidth, outputHeight } = params;
    const duration = endTime - startTime;

    if (duration <= 0) {
      reject(new Error('End time must be greater than start time'));
      return;
    }

    const totalFrames = Math.ceil(duration / interval);

    if (onProgress) {
      onProgress({ stage: 'extracting', percent: 0, message: `Extracting frames every ${interval}s...`, totalFrames });
    }

    console.log('Starting frame extraction, video:', videoPath);
    console.log('Time range:', startTime, '-', endTime, 's, duration:', duration, 's');
    console.log('Expected frames:', totalFrames);

    const outputPattern = path.join(outputDir, 'frame_%05d.jpg');

    // Build scale filter
    let scaleFilter = '';
    if (outputWidth > 0 && outputHeight > 0) {
      scaleFilter = `scale=${outputWidth}:${outputHeight}`;
    } else if (outputWidth > 0) {
      scaleFilter = `scale=${outputWidth}:-1`;
    } else if (outputHeight > 0) {
      scaleFilter = `scale=-1:${outputHeight}`;
    }

    const vfParts = [];
    if (scaleFilter) {
      vfParts.push(scaleFilter);
    }
    vfParts.push(`fps=1/${interval}`);

    const args = [
      '-y',
      '-ss', String(startTime),
      '-t', String(duration),
      '-err_detect', 'ignore_err',
      '-fflags', '+genpts+igndts+discardcorrupt+fastseek',
      '-i', videoPath,
      '-an',
      '-sn',
      '-vf', vfParts.join(','),
      '-fps_mode', 'vfr',
      '-q:v', String(quality),
      '-threads', String(os.cpus().length),
      '-f', 'image2',
      outputPattern
    ];

    console.log('FFmpeg args:', args.join(' '));

    let extractError = null;
    let frameCheckInterval = null;
    let lastFrameCount = 0;
    let stuckCount = 0;
    const maxStuckCount = 120;
    let aborted = false;

    const proc = execFile(ffmpegPath, args, (error, stdout, stderr) => {
      if (frameCheckInterval) {
        clearInterval(frameCheckInterval);
        frameCheckInterval = null;
      }

      if (aborted) {
        console.log('Task aborted');
        reject(new Error('Task aborted'));
        return;
      }

      if (error) {
        console.log('FFmpeg error:', error.message);
        extractError = error;
      }

      let frames = [];
      try {
        if (fs.existsSync(outputDir)) {
          frames = fs.readdirSync(outputDir)
            .filter(f => f.startsWith('frame_') && f.endsWith('.jpg'))
            .sort();
        }
      } catch (e) {
        console.log('Failed to read frame dir:', e.message);
      }

      console.log('Extracted frames:', frames.length);

      const framePaths = frames.map(f => path.join(outputDir, f));
      if (framePaths.length > 0) {
        resolve({ framePaths, totalFrames: framePaths.length });
      } else if (extractError) {
        reject(extractError);
      } else {
        resolve({ framePaths: [], totalFrames: 0 });
      }
    });

    // Track process - use videoPath + timestamp as taskId?
    // We need to generate a unique taskId for tracking
    const taskId = `extract-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    runningProcesses.set(taskId, { ffmpegProc: proc, outputDir, abortFlag: false, startedAt: Date.now() });

    frameCheckInterval = setInterval(() => {
      // Check abort flag
      const procInfo = runningProcesses.get(taskId);
      if (procInfo && procInfo.abortFlag) {
        console.log('Abort signal detected, terminating FFmpeg...');
        aborted = true;
        try {
          proc.kill();
        } catch (e) {
          console.log('Failed to kill process:', e.message);
        }
        if (frameCheckInterval) {
          clearInterval(frameCheckInterval);
          frameCheckInterval = null;
        }
        return;
      }

      try {
        let frames = [];
        if (fs.existsSync(outputDir)) {
          frames = fs.readdirSync(outputDir)
            .filter(f => f.startsWith('frame_') && f.endsWith('.jpg'));
        }

        if (frames.length === lastFrameCount) {
          stuckCount++;
          if (stuckCount >= maxStuckCount) {
            console.log('FFmpeg seems stuck, forcing termination...');
            try {
              proc.kill();
            } catch (e) {
              console.log('Failed to kill process:', e.message);
            }
          }
        } else {
          stuckCount = 0;
          lastFrameCount = frames.length;
        }

        if (onProgress && totalFrames > 0) {
          const percent = Math.min(98, Math.round((frames.length / totalFrames) * 98));
          onProgress({
            stage: 'extracting',
            percent,
            message: `Extracting frames... ${frames.length}/${totalFrames}`,
            extractedFrames: frames.length,
            totalFrames
          });
        }
      } catch (e) {
        console.log('Progress check error:', e.message);
      }
    }, 1000);

    // Return taskId for abort control
    return taskId;
  });
}

// Abort frame extraction task
function abortFrameExtract(taskId) {
  const procInfo = runningProcesses.get(taskId);
  if (!procInfo) {
    return { success: false, message: 'No running task found' };
  }

  console.log('Aborting frame extraction:', taskId);
  procInfo.abortFlag = true;

  try {
    if (procInfo.ffmpegProc) {
      procInfo.ffmpegProc.kill();
    }
  } catch (e) {
    console.log('Failed to kill FFmpeg process:', e.message);
  }

  return { success: true, message: 'Abort signal sent' };
}

// Cleanup old tasks
function cleanupOldTasks(outputBaseDir, maxAge) {
  try {
    if (!fs.existsSync(outputBaseDir)) {
      return;
    }

    const now = Date.now();
    const dirs = fs.readdirSync(outputBaseDir);

    for (const dir of dirs) {
      const fullPath = path.join(outputBaseDir, dir);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory() && now - stat.mtimeMs > maxAge) {
          console.log('[FrameExtractor] Cleaning up old task dir:', dir);
          cleanupTempDir(fullPath);
        }
      } catch (e) {
        console.warn('[FrameExtractor] Failed to cleanup old task:', dir, e.message);
      }
    }
  } catch (e) {
    console.warn('[FrameExtractor] Failed to cleanup old tasks:', e.message);
  }
}

// Main function: Extract frames directly to directory
async function extractFrames(videoPath, params, onProgress, abortController) {
  const startTime = Date.now();
  const ffmpegCheck = await checkFFmpeg();
  if (!ffmpegCheck.available) {
    throw new Error(ffmpegCheck.message || 'FFmpeg not available');
  }

  if (abortController && abortController.signal.aborted) {
    throw new Error('Task aborted');
  }

  const ffmpegPath = ffmpegCheck.path;
  const extractConfig = { ...config.frameExtract, ...params };

  // Determine output directory
  const videoDir = path.dirname(videoPath);
  const videoName = path.basename(videoPath, path.extname(videoPath));

  // Clean video name for safe filename - remove/replace special characters
  const cleanVideoName = videoName.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').replace(/\s+/g, '_');

  // Use outputDir if provided, otherwise use video directory
  let outputBaseDir;
  if (params.outputDir && params.outputDir.trim()) {
    // Create a subdirectory for this video under the output directory
    outputBaseDir = path.join(params.outputDir, cleanVideoName + '_frames');
  } else {
    // Default: create output subdirectory next to video
    outputBaseDir = path.join(videoDir, `${cleanVideoName}_frames`);
  }

  if (!fs.existsSync(outputBaseDir)) {
    fs.mkdirSync(outputBaseDir, { recursive: true });
  }

  // Create unique task dir
  const taskId = `extract-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const taskDir = path.join(outputBaseDir, taskId);
  fs.mkdirSync(taskDir, { recursive: true });
  registerTempDir(taskDir);

  if (onProgress) {
    onProgress({ stage: 'starting', percent: 0, message: 'Initializing...' });
  }

  // Setup abort listener
  let abortListener = null;
  if (abortController) {
    abortListener = () => {
      console.log('AbortController signal received for task:', taskId);
      abortFrameExtract(taskId);
    };
    abortController.signal.addEventListener('abort', abortListener);
  }

  try {
    const duration = await getVideoDuration(ffmpegPath, videoPath);
    console.log('Video duration:', duration, 's');

    // Validate time range
    if (params.endTime > duration) {
      params.endTime = duration;
    }
    if (params.startTime >= params.endTime) {
      throw new Error('Invalid time range');
    }

    if (abortController && abortController.signal.aborted) {
      throw new Error('Task aborted');
    }

    // Extract frames directly to taskDir
    if (onProgress) {
      onProgress({ stage: 'extracting', percent: 5, message: 'Starting frame extraction...' });
    }

    const { framePaths, totalFrames } = await (async () => {
      const { startTime: st, endTime: et, interval, quality, outputWidth, outputHeight, format = 'jpg' } = params;
      const duration = et - st;
      const totalFrames = Math.ceil(duration / interval);

      // Build output pattern with correct extension
      const ext = format === 'png' ? 'png' : format === 'webp' ? 'webp' : 'jpg';
      const outputPattern = path.join(taskDir, `frame_%05d.${ext}`);

      // Build scale filter
      const scaleW = outputWidth > 0 ? outputWidth : -1;
      const scaleH = outputHeight > 0 ? outputHeight : -1;

      console.log('========== Frame Extraction Params ==========');
      console.log('Video:', videoPath);
      console.log('Start time:', st);
      console.log('End time:', et);
      console.log('Duration:', duration);
      console.log('Interval:', interval);
      console.log('Quality:', quality);
      console.log('Format:', ext);
      console.log('Expected total frames:', totalFrames);
      console.log('==============================================');

      if (onProgress) {
        onProgress({ stage: 'extracting', percent: 5, message: `Extracting frames every ${interval}s over ${duration}s...`, totalFrames });
      }

      // Input seeking: -ss before -i (faster seeking, better for distant positions)
      const inputSeekArgs = [
        '-y',
        '-ss', String(st),
        '-i', videoPath,
        '-t', String(duration),
        '-an',
        '-sn',
        '-vf', `fps=1/${interval},scale=${outputWidth > 0 ? outputWidth : -1}:${outputHeight > 0 ? outputHeight : -1}`,
        '-fps_mode', 'vfr',
        '-q:v', String(quality),
        '-threads', String(os.cpus().length),
        '-f', 'image2',
        outputPattern
      ];

      console.log('FFmpeg args:', inputSeekArgs.join(' '));

      return await new Promise((resolve, reject) => {
        let frameCheckInterval = null;
        let aborted = false;

        const proc = execFile(ffmpegPath, inputSeekArgs, (error, stdout, stderr) => {
          if (frameCheckInterval) {
            clearInterval(frameCheckInterval);
            frameCheckInterval = null;
          }

          if (aborted) {
            reject(new Error('Task aborted'));
            return;
          }

          if (error) {
            console.log('FFmpeg error (non-fatal, continuing):', error.message);
          }

          let frames = [];
          try {
            if (fs.existsSync(taskDir)) {
              frames = fs.readdirSync(taskDir)
                .filter(f => f.startsWith('frame_') && f.endsWith('.' + ext))
                .sort();
            }
          } catch (e) {
            console.log('Failed to read frame dir:', e.message);
          }

          console.log('Extracted frames count:', frames.length);
          console.log('==============================================');

          const framePaths = frames.map(f => path.join(taskDir, f));
          resolve({ framePaths, totalFrames: framePaths.length });
    });

        runningProcesses.set(taskId, { ffmpegProc: proc, outputDir: taskDir, abortFlag: false, startedAt: Date.now() });

        let lastFrameCount = 0;
        let stuckCount = 0;
        const maxStuckCount = 120;

        frameCheckInterval = setInterval(() => {
          const procInfo = runningProcesses.get(taskId);
          if (procInfo && procInfo.abortFlag) {
            console.log('Abort signal detected');
            aborted = true;
            try {
              proc.kill();
            } catch (e) {
              console.log('Failed to kill process:', e.message);
            }
            return;
          }

          try {
            let frames = [];
            if (fs.existsSync(taskDir)) {
              frames = fs.readdirSync(taskDir)
                .filter(f => f.startsWith('frame_') && f.endsWith('.' + ext));
            }

            if (frames.length === lastFrameCount) {
              stuckCount++;
              if (stuckCount >= maxStuckCount) {
                console.log('FFmpeg seems stuck, forcing termination...');
                try {
                  proc.kill();
                } catch (e) {
                  console.log('Failed to kill process:', e.message);
                }
              }
            } else {
              stuckCount = 0;
              lastFrameCount = frames.length;
            }

            if (onProgress && totalFrames > 0) {
              const percent = 5 + Math.min(90, Math.round((frames.length / totalFrames) * 90));
              onProgress({
                stage: 'extracting',
                percent,
                message: `Extracting frames... ${frames.length}/${totalFrames}`,
                extractedFrames: frames.length,
                totalFrames
              });
            }
          } catch (e) {
            console.log('Progress check error:', e.message);
          }
        }, 1000);
      });
    })();

    if (abortController && abortController.signal.aborted) {
      throw new Error('Task aborted');
    }

    console.log('Extracted', framePaths.length, 'frames');
    console.log('Frame files:', framePaths.slice(0, 5).join(', '), framePaths.length > 5 ? '...' : '');

    if (framePaths.length === 0) {
      throw new Error('No frames extracted');
    }

    if (onProgress) {
      onProgress({ stage: 'complete', percent: 100, message: 'Extraction complete!', extractedFrames: framePaths.length });
    }

    const totalTime = Date.now() - startTime;
    console.log('Frame extraction complete:', taskDir);
    console.log('Total time:', (totalTime / 1000).toFixed(2), 's');

    // Don't cleanup taskDir - that's where the output is!
    TEMP_DIRS.delete(taskDir);
    runningProcesses.delete(taskId);

    return {
      success: true,
      taskId,
      outputPath: taskDir,
      frameCount: framePaths.length,
      totalTime
    };
  } catch (error) {
    console.log('Frame extraction error:', error);
    // Cleanup on error
    if (fs.existsSync(taskDir)) {
      cleanupTempDir(taskDir);
    }
    runningProcesses.delete(taskId);
    throw error;
  } finally {
    if (abortController && abortListener) {
      abortController.signal.removeEventListener('abort', abortListener);
    }
  }
}

// Process exit cleanup
process.on('exit', cleanupAllTempDirs);
process.on('SIGINT', () => {
  cleanupAllTempDirs();
  process.exit(0);
});
process.on('SIGTER', () => {
  cleanupAllTempDirs();
  process.exit(0);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  cleanupAllTempDirs();
  process.exit(1);
});

// Start periodic stale process cleanup
if (process.env.NODE_ENV !== 'test') {
  staleProcessCheckInterval = setInterval(cleanupStaleProcesses, 5 * 60 * 1000);
}

function cleanup() {
  if (staleProcessCheckInterval) {
    clearInterval(staleProcessCheckInterval);
    staleProcessCheckInterval = null;
  }
}

module.exports = {
  checkFFmpeg,
  getVideoDuration,
  extractFrames,
  extractFramesInRange,
  abortFrameExtract,
  cleanupOldTasks,
  cleanup
};
