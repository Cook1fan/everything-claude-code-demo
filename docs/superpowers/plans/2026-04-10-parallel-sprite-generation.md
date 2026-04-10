# Parallel Sprite Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Accelerate sprite sheet generation by using 3 parallel FFmpeg processes to extract frames from different time segments, then merging the results.

**Architecture:** Split the video duration into 3 equal segments, run 3 parallel FFmpeg processes to extract frames from each segment, collect all frames in order, then generate the final sprite sheet.

**Tech Stack:** Node.js, child_process (execFile), FFmpeg

---

## Current Implementation Analysis

The current implementation uses `extractFramesFallback()` which extracts frames sequentially one by one using `-ss` (seek) for each frame. This is slow for long videos because:
- Each frame requires a separate FFmpeg invocation
- No parallelism
- Seeking from the start for each frame is inefficient

## Feasibility Discussion

### ✅ **Yes, this is feasible and recommended**

**Why it will work:**
1. FFmpeg can efficiently seek to a specific time point with `-ss`
2. We can split the video into N segments and run parallel processes
3. Frame ordering can be maintained by naming frames with segment prefixes
4. Node.js can easily manage multiple child processes in parallel

**Key considerations:**
1. **I/O Bound**: FFmpeg is primarily I/O bound, parallelizing will help (up to disk/CPU limits)
2. **Memory**: 3 FFmpeg processes won't use excessive memory
3. **Frame Order**: Critical to maintain correct temporal order when merging
4. **Progress Tracking**: Need to aggregate progress from all 3 segments

---

## Implementation Approach

### Phase 1: Create Parallel Frame Extractor
Create a new function that splits the video into segments and extracts frames in parallel.

### Phase 2: Update Main Generate Function
Integrate the parallel extractor into the main `generateSprite()` function.

### Phase 3: Test and Verify
Test with various video lengths to ensure correctness and performance improvement.

---

## File Structure

| File | Action | Responsibility |
|------|--------|-----------------|
| `scanner/spriteGenerator.js` | Modify | Add parallel extraction functions, update main flow |

---

### Task 1: Add Parallel Frame Extraction Function

**Files:**
- Modify: `scanner/spriteGenerator.js`

Add a new function `extractFramesParallel()` that:
1. Splits the video duration into 3 segments
2. Runs 3 FFmpeg processes in parallel
3. Collects all frames with proper ordering

- [ ] **Step 1: Add the parallel extraction function**

Add after `extractFramesFallback()` (line 353):

```javascript
// 并行提取帧：将视频分成3个时间段，并行提取
function extractFramesParallel(ffmpegPath, videoPath, tempDir, interval, duration, onProgress) {
  return new Promise(async (resolve, reject) => {
    console.log('使用并行方法提取帧（3个线程）...');
    const totalFrames = Math.ceil(duration / interval);
    
    // 分成3个时间段
    const segmentCount = 3;
    const segmentDuration = duration / segmentCount;
    const segments = [];
    
    for (let i = 0; i < segmentCount; i++) {
      const startTime = i * segmentDuration;
      const endTime = Math.min((i + 1) * segmentDuration, duration);
      const startFrame = Math.floor(startTime / interval);
      const endFrame = Math.ceil(endTime / interval);
      segments.push({
        index: i,
        startTime,
        endTime,
        startFrame,
        endFrame,
        frameCount: endFrame - startFrame
      });
    }
    
    console.log('分段信息:', segments);
    
    if (onProgress) {
      onProgress({ 
        stage: 'extracting', 
        percent: 0, 
        message: `正在并行提取帧（3个线程，每${interval}秒一帧）...`, 
        totalFrames 
      });
    }
    
    // 为每个分段创建独立的临时子目录
    const segmentDirs = segments.map(s => path.join(tempDir, `seg_${s.index}`));
    for (const dir of segmentDirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
    
    // 跟踪每个分段的进度
    const segmentProgress = new Array(segmentCount).fill(0);
    let progressCheckInterval = null;
    
    try {
      // 并行运行所有分段的提取
      const segmentPromises = segments.map(async (segment) => {
        const segmentDir = segmentDirs[segment.index];
        const framePaths = [];
        
        for (let i = segment.startFrame; i < segment.endFrame; i++) {
          const time = i * interval;
          // 使用 segX_frameYYYY 格式确保排序正确
          const outputPath = path.join(segmentDir, `seg${segment.index}_frame${String(i + 1).padStart(4, '0')}.jpg`);
          
          try {
            await new Promise((res, rej) => {
              const args = [
                '-ss', time.toString(),
                '-i', videoPath,
                '-vframes', '1',
                '-q:v', '3',
                '-y',
                outputPath
              ];
              
              execFile(ffmpegPath, args, (error) => {
                if (error && !fs.existsSync(outputPath)) {
                  console.log(`分段${segment.index} 提取第 ${i} 帧失败:`, error.message);
                }
                res();
              });
            });
            
            if (fs.existsSync(outputPath)) {
              framePaths.push(outputPath);
            }
            
            // 更新进度
            segmentProgress[segment.index] = (i - segment.startFrame + 1) / segment.frameCount;
            
          } catch (e) {
            console.log(`分段${segment.index} 提取第 ${i} 帧出错:`, e);
          }
        }
        
        return framePaths;
      });
      
      // 定期更新总进度
      progressCheckInterval = setInterval(() => {
        const avgProgress = segmentProgress.reduce((a, b) => a + b, 0) / segmentCount;
        const completedFrames = Math.round(avgProgress * totalFrames);
        
        if (onProgress && totalFrames > 0) {
          const percent = Math.min(90, Math.round(avgProgress * 90));
          onProgress({
            stage: 'extracting',
            percent,
            message: `正在并行提取帧... ${completedFrames}/${totalFrames}`,
            frameCount: completedFrames,
            totalFrames
          });
        }
      }, 500);
      
      // 等待所有分段完成
      const allSegmentFrames = await Promise.all(segmentPromises);
      
      // 合并所有帧并按文件名排序（确保时间顺序正确）
      const allFramePaths = allSegmentFrames.flat().sort((a, b) => {
        return path.basename(a).localeCompare(path.basename(b));
      });
      
      if (progressCheckInterval) {
        clearInterval(progressCheckInterval);
      }
      
      console.log('并行提取完成，共', allFramePaths.length, '帧');
      
      if (allFramePaths.length > 0) {
        if (onProgress) {
          onProgress({ 
            stage: 'extracting', 
            percent: 100, 
            message: '帧提取完成（并行）', 
            frameCount: allFramePaths.length, 
            totalFrames 
          });
        }
        resolve({
          framePaths: allFramePaths,
          interval: interval
        });
      } else {
        reject(new Error('并行方法未能提取任何帧'));
      }
      
    } catch (error) {
      if (progressCheckInterval) {
        clearInterval(progressCheckInterval);
      }
      reject(error);
    }
  });
}
```

---

### Task 2: Update Main Generate Function to Use Parallel Extraction

**Files:**
- Modify: `scanner/spriteGenerator.js:492-494`

Update the main `generateSprite()` function to use the parallel extractor instead of the serial fallback.

- [ ] **Step 1: Replace the extractor call**

Find lines 492-494:
```javascript
    // 直接使用备用方法（逐个时间点提取），更稳定不会卡住
    console.log('使用备用方法提取帧（逐个时间点）...');
    extractResult = await extractFramesFallback(ffmpegPath, sourceVideoPath, tempDir, interval, duration, onProgress);
```

Replace with:
```javascript
    // 使用并行方法提取帧（3个线程）
    console.log('使用并行方法提取帧（3个线程）...');
    extractResult = await extractFramesParallel(ffmpegPath, sourceVideoPath, tempDir, interval, duration, onProgress);
```

- [ ] **Step 2: Add the new function to exports**

Find the exports at the end of the file (line 540-544):
```javascript
module.exports = {
  checkFFmpeg,
  generateSprite,
  getVideoDuration
};
```

No changes needed here - the new function is internal only.

---

### Task 3: (Optional) Add Configuration Option for Parallelism

**Files:**
- Modify: `scanner/spriteGenerator.js`

Add an option to control the number of parallel processes.

- [ ] **Step 1: Make segment count configurable**

Modify the `extractFramesParallel` function signature to accept `segmentCount`:

```javascript
function extractFramesParallel(ffmpegPath, videoPath, tempDir, interval, duration, onProgress, segmentCount = 3) {
```

And update line 364:
```javascript
    const segmentCount = options.segmentCount || 3;
```

---

### Task 4: Test the Implementation

**Files:**
- Test: Run with an actual video file

- [ ] **Step 1: Test with a short video (< 10 minutes)**

Verify:
- Frames are extracted in correct order
- Sprite sheet is generated correctly
- JSON info file has correct timing

- [ ] **Step 2: Test with a long video (> 1 hour)**

Verify:
- Performance improvement (should be ~2.5x faster)
- No memory issues
- Progress reporting works correctly

---

## Expected Performance Improvement

| Video Length | Serial (current) | Parallel (3 segments) | Improvement |
|--------------|-----------------|---------------------|-------------|
| 30 min | ~2 min | ~45 sec | ~2.7x |
| 60 min | ~4 min | ~1.5 min | ~2.7x |
| 120 min | ~8 min | ~3 min | ~2.7x |

**Note:** Actual speedup depends on disk I/O performance. If the video is on an SSD, you'll see closer to 3x speedup. On HDD, it may be less due to seek overhead.

---

## Rollback Plan

If issues are found, easily revert by changing Task 2 back to use `extractFramesFallback()` instead of `extractFramesParallel()`.

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|-----------|
| Frame ordering incorrect | LOW | HIGH | Frame filenames include segment index and frame number, sorted lexicographically |
| Too much I/O contention | MEDIUM | LOW | 3 processes is reasonable for modern systems |
| Memory usage too high | LOW | LOW | Each FFmpeg process uses ~50-100MB |
| Progress tracking broken | LOW | MEDIUM | Aggregate progress from all segments |
