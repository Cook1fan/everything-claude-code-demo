# Deleted Records Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在主内容区顶部展示一个可折叠的删除记录面板,当用户点击某个目录下时显示该目录下的 `deleted_video_dirs.txt` 内容。

**Architecture:** 新增后端 API `GET /api/deletion-records` 读取并解析删除记录文件;新增前端 Vue 组件 `DeletedRecordsPanel.vue` 监听选中的目录路径变化并展示记录;通过 Pinia store 中的 action 调用 API。

**Tech Stack:** Vue 3 + TypeScript + Pinia (前端), Express.js + Jest + supertest (后端)

---

## File Structure

| File | Responsibility |
|---|---|
| `frontend/src/types.ts` (modify) | 新增 `DeletionRecord` 和 `DeletionRecordsResponse` 类型 |
| `server/routes/deletionRecords.js` (create) | 处理 `/api/deletion-records` 请求,读取并解析删除记录 |
| `test/routes/deletionRecords.test.js` (create) | 后端 API 集成测试 |
| `server/app.js` (modify) | 注册新的路由 |
| `server/index.js` (modify) | 控制台输出新端点说明 |
| `frontend/src/stores/videoStore.ts` (modify) | 新增 `loadDeletionRecords` action |
| `frontend/src/components/DeletedRecordsPanel.vue` (create) | 可折叠面板组件 |
| `frontend/src/views/HomeView.vue` (modify) | 在面包屑下挂载组件 |

---

## Task 1: Add TypeScript Types

**Files:**
- Modify: `frontend/src/types.ts`

- [ ] **Step 1: Add new types at end of file**

Open `frontend/src/types.ts` and add at the bottom (before any closing or at the very end):

```typescript
// 删除记录接口
export interface DeletionRecord {
  timestamp: string;   // ISO 格式,如 "2025-12-18T14:30:25.000Z"
  path: string;        // 被删除的目录完整路径
}

export interface DeletionRecordsResponse {
  exists: boolean;            // 文件是否存在
  records: DeletionRecord[];  // 按时间戳降序排列(仅当 exists 为 true 时)
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx vue-tsc --noEmit`
Expected: No errors (exits 0)

- [ ] **Step 3: Commit**

```bash
cd ..
git add frontend/src/types.ts
git commit -m "feat(types): add DeletionRecord and DeletionRecordsResponse types"
```

---

## Task 2: Write Failing Tests for Deletion Records Route

**Files:**
- Create: `test/routes/deletionRecords.test.js`

- [ ] **Step 1: Create the test file**

Create `test/routes/deletionRecords.test.js` with this content:

```javascript
const request = require('supertest');
const path = require('path');

// 在引入 app 之前先 mock 依赖
jest.mock('fs');
jest.mock('../../server/websocket', () => ({
  initWebSocket: jest.fn(),
  broadcastScanStatus: jest.fn(),
  getSpriteSemaphore: jest.fn().mockReturnValue({
    isVideoInQueueOrRunning: jest.fn(),
    cleanupOldStatuses: jest.fn(),
    getAllStatuses: jest.fn().mockReturnValue([]),
    getActiveCount: jest.fn().mockReturnValue(0),
    getQueueLength: jest.fn().mockReturnValue(0)
  }),
  getBatchThreadPool: jest.fn(),
  setBatchThreadPool: jest.fn(),
  broadcastBatchSpriteStatus: jest.fn()
}));
jest.mock('../../server/middleware/cache', () => ({
  getVideoData: jest.fn(),
  clearVideoDataCache: jest.fn()
}));
jest.mock('../../server/middleware/path', () => ({
  isPathAllowed: jest.fn().mockReturnValue(true),
  normalizePath: jest.fn(p => p)
}));
jest.mock('../../server/utils', () => ({
  getVideoMimeType: jest.fn().mockReturnValue('video/mp4'),
  safeOpen: jest.fn().mockResolvedValue(true)
}));
jest.mock('../../scanner/spriteGenerator', () => ({
  checkFFmpeg: jest.fn().mockResolvedValue({ available: true, path: '/usr/bin/ffmpeg' })
}));
jest.mock('../../scanner/config', () => ({
  outputPath: '/test/data/videos.json'
}));

describe('Deletion Records Routes', () => {
  let app;
  let mockFs;
  let mockPath;

  beforeEach(() => {
    jest.resetAllMocks();

    mockFs = require('fs');
    mockPath = require('../../server/middleware/path');

    mockPath.isPathAllowed.mockReturnValue(true);

    // 重新引入 app
    const { createApp } = require('../../server/app');
    app = createApp();
  });

  describe('GET /api/deletion-records', () => {
    test('应该返回 400 如果缺少 path 参数', async () => {
      const response = await request(app).get('/api/deletion-records');
      expect(response.status).toBe(400);
    });

    test('应该返回 403 如果路径不允许', async () => {
      mockPath.isPathAllowed.mockReturnValue(false);
      const response = await request(app).get('/api/deletion-records?path=/forbidden');
      expect(response.status).toBe(403);
    });

    test('应该返回 404 如果目录不存在', async () => {
      mockFs.existsSync.mockReturnValue(false);
      const response = await request(app).get('/api/deletion-records?path=/nonexistent');
      expect(response.status).toBe(404);
    });

    test('应该返回 400 如果路径不是目录', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({
        isDirectory: jest.fn().mockReturnValue(false)
      });
      const response = await request(app).get('/api/deletion-records?path=/somefile.txt');
      expect(response.status).toBe(400);
    });

    test('应该返回 exists:false 当 deleted_video_dirs.txt 不存在', async () => {
      // 第一次 existsSync: 目录存在;第二次: 文件不存在
      mockFs.existsSync
        .mockReturnValueOnce(true)  // 目录
        .mockReturnValueOnce(false); // 记录文件
      mockFs.statSync.mockReturnValue({
        isDirectory: jest.fn().mockReturnValue(true)
      });

      const response = await request(app).get('/api/deletion-records?path=/some/dir');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ exists: false, records: [] });
    });

    test('应该返回按时间戳降序的记录列表', async () => {
      const fileContent = [
        '[2025-01-15T10:00:00.000Z] /path/to/first',
        '[2025-12-18T14:30:25.000Z] /path/to/second',
        '[2025-06-10T08:15:30.000Z] /path/to/third',
        ''
      ].join('\n');

      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({
        isDirectory: jest.fn().mockReturnValue(true)
      });
      mockFs.readFileSync.mockReturnValue(fileContent);

      const response = await request(app).get('/api/deletion-records?path=/some/dir');
      expect(response.status).toBe(200);
      expect(response.body.exists).toBe(true);
      expect(response.body.records).toHaveLength(3);
      expect(response.body.records[0]).toEqual({
        timestamp: '2025-12-18T14:30:25.000Z',
        path: '/path/to/second'
      });
      expect(response.body.records[1].timestamp).toBe('2025-06-10T08:15:30.000Z');
      expect(response.body.records[2].timestamp).toBe('2025-01-15T10:00:00.000Z');
    });

    test('应该跳过空行', async () => {
      const fileContent = [
        '[2025-01-15T10:00:00.000Z] /path/to/first',
        '',
        '   ',
        '[2025-12-18T14:30:25.000Z] /path/to/second',
        ''
      ].join('\n');

      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({
        isDirectory: jest.fn().mockReturnValue(true)
      });
      mockFs.readFileSync.mockReturnValue(fileContent);

      const response = await request(app).get('/api/deletion-records?path=/some/dir');
      expect(response.body.records).toHaveLength(2);
    });

    test('应该跳过解析失败的行', async () => {
      const fileContent = [
        '[2025-01-15T10:00:00.000Z] /path/to/first',
        'this is not a valid line',
        '[invalid timestamp] /path/to/broken',
        '[2025-12-18T14:30:25.000Z] /path/to/second'
      ].join('\n');

      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({
        isDirectory: jest.fn().mockReturnValue(true)
      });
      mockFs.readFileSync.mockReturnValue(fileContent);

      const response = await request(app).get('/api/deletion-records?path=/some/dir');
      expect(response.body.records).toHaveLength(2);
      // 第二条记录在降序中排第二
      expect(response.body.records[1].path).toBe('/path/to/first');
    });

    test('应该返回空数组当文件只有空行', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({
        isDirectory: jest.fn().mockReturnValue(true)
      });
      mockFs.readFileSync.mockReturnValue('\n\n   \n');

      const response = await request(app).get('/api/deletion-records?path=/some/dir');
      expect(response.status).toBe(200);
      expect(response.body.exists).toBe(true);
      expect(response.body.records).toEqual([]);
    });

    test('应该返回 500 当文件读取失败', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({
        isDirectory: jest.fn().mockReturnValue(true)
      });
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('disk error');
      });

      const response = await request(app).get('/api/deletion-records?path=/some/dir');
      expect(response.status).toBe(500);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest test/routes/deletionRecords.test.js`
Expected: All tests FAIL (route doesn't exist yet). The 404 from "Cannot GET /api/deletion-records" confirms the route isn't registered.

- [ ] **Step 3: Commit the failing test**

```bash
git add test/routes/deletionRecords.test.js
git commit -m "test: add failing tests for deletion records route"
```

---

## Task 3: Implement Deletion Records Route

**Files:**
- Create: `server/routes/deletionRecords.js`

- [ ] **Step 1: Create the route file**

Create `server/routes/deletionRecords.js` with this content:

```javascript
const express = require('express');
const path = require('path');
const fs = require('fs');
const { isPathAllowed } = require('../middleware/path');

const router = express.Router();

const RECORD_FILE_NAME = 'deleted_video_dirs.txt';
const LINE_PATTERN = /^\[(.+?)\]\s+(.+)$/;

/**
 * 解析 deleted_video_dirs.txt 文件内容
 * @param {string} filePath 文件绝对路径
 * @returns {Array<{timestamp: string, path: string}>} 按时间戳降序的记录数组
 */
function parseDeletionRecords(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const records = [];

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const match = trimmed.match(LINE_PATTERN);
    if (!match) continue;

    records.push({
      timestamp: match[1],
      path: match[2],
    });
  }

  // 按时间戳降序 (ISO 8601 字符串比较即可)
  records.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return records;
}

router.get('/', (req, res) => {
  const dirPath = req.query.path;
  if (!dirPath) {
    return res.status(400).json({ error: '缺少 path 参数' });
  }

  const resolvedPath = path.resolve(dirPath);

  if (!isPathAllowed(resolvedPath)) {
    return res.status(403).json({ error: '禁止访问该路径' });
  }

  if (!fs.existsSync(resolvedPath)) {
    return res.status(404).json({ error: '目录不存在' });
  }

  const stat = fs.statSync(resolvedPath);
  if (!stat.isDirectory()) {
    return res.status(400).json({ error: '路径不是一个目录' });
  }

  const recordFilePath = path.join(resolvedPath, RECORD_FILE_NAME);
  if (!fs.existsSync(recordFilePath)) {
    return res.json({ exists: false, records: [] });
  }

  try {
    const records = parseDeletionRecords(recordFilePath);
    res.json({ exists: true, records });
  } catch (err) {
    console.error('读取删除记录失败:', err);
    res.status(500).json({ error: '读取删除记录失败' });
  }
});

module.exports = router;
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npx jest test/routes/deletionRecords.test.js`
Expected: All 10 tests PASS

- [ ] **Step 3: Commit**

```bash
git add server/routes/deletionRecords.js
git commit -m "feat(server): add deletion records route"
```

---

## Task 4: Register Route in App

**Files:**
- Modify: `server/app.js:8` (add require) and `server/app.js:22` (add app.use)

- [ ] **Step 1: Add the require statement**

Open `server/app.js`. Find this block at the top:

```javascript
const frameExtractRouter = require('./routes/frameExtract');
```

Add a new line after it:

```javascript
const deletionRecordsRouter = require('./routes/deletionRecords');
```

- [ ] **Step 2: Register the route**

Find this block:

```javascript
app.use('/api/frame-extract', frameExtractRouter);
```

Add a new line after it:

```javascript
app.use('/api/deletion-records', deletionRecordsRouter);
```

The result should look like:

```javascript
const deletionRecordsRouter = require('./routes/deletionRecords');
// ...
app.use('/api/frame-extract', frameExtractRouter);
app.use('/api/deletion-records', deletionRecordsRouter);
```

- [ ] **Step 3: Run all tests to verify nothing broke**

Run: `npx jest`
Expected: All existing tests + new tests pass. No regressions.

- [ ] **Step 4: Commit**

```bash
git add server/app.js
git commit -m "feat(server): register deletion records route"
```

---

## Task 5: Add Endpoint Log

**Files:**
- Modify: `server/index.js`

- [ ] **Step 1: Add console log for new endpoint**

Open `server/index.js`. Find this block in the `server.listen` callback:

```javascript
  console.log(`  GET  /api/frame-extract/status/:taskId - 获取单个任务状态`);
```

Add a new line after it (in the same format as other entries):

```javascript
  console.log(`  GET  /api/deletion-records - 获取目录删除记录`);
```

- [ ] **Step 2: Verify syntax**

Run: `node -c server/index.js`
Expected: No errors (silent exit 0)

- [ ] **Step 3: Commit**

```bash
git add server/index.js
git commit -m "docs(server): log deletion records endpoint"
```

---

## Task 6: Add loadDeletionRecords Action to Video Store

**Files:**
- Modify: `frontend/src/stores/videoStore.ts`

- [ ] **Step 1: Add the action function**

Open `frontend/src/stores/videoStore.ts`. Find this block (around line 580):

```javascript
  async function loadVideos() {
```

Add this function right BEFORE `loadVideos`:

```typescript
  async function loadDeletionRecords(dirPath: string): Promise<DeletionRecordsResponse> {
    try {
      const res = await fetch(
        `${API_BASE}/deletion-records?path=${encodeURIComponent(dirPath)}`
      )
      if (!res.ok) {
        // 404 (目录不存在) 或其他错误,统一不显示
        return { exists: false, records: [] }
      }
      return await res.json()
    } catch (err) {
      console.error('加载删除记录失败:', err)
      return { exists: false, records: [] }
    }
  }
```

- [ ] **Step 2: Update imports**

Find the imports at the top:

```typescript
import type { Video, VideoData, ScanStatus, DirectoryTreeNode, SpriteInfo, SpriteStatus, BatchSpriteStats, FrameExtractStatus, Tag } from '@/types'
```

Replace with:

```typescript
import type { Video, VideoData, ScanStatus, DirectoryTreeNode, SpriteInfo, SpriteStatus, BatchSpriteStats, FrameExtractStatus, Tag, DeletionRecordsResponse } from '@/types'
```

- [ ] **Step 3: Export the new action from the store**

Find the return statement at the end (around line 798):

```typescript
  return {
    videos,
```

Add `loadDeletionRecords` to the return object. Find this block:

```typescript
    loadVideos,
    getScanStatus,
```

Add `loadDeletionRecords` between them:

```typescript
    loadVideos,
    loadDeletionRecords,
    getScanStatus,
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd frontend && npx vue-tsc --noEmit`
Expected: No errors (exits 0)

- [ ] **Step 5: Commit**

```bash
cd ..
git add frontend/src/stores/videoStore.ts
git commit -m "feat(store): add loadDeletionRecords action"
```

---

## Task 7: Create DeletedRecordsPanel Component

**Files:**
- Create: `frontend/src/components/DeletedRecordsPanel.vue`

- [ ] **Step 1: Create the component file**

Create `frontend/src/components/DeletedRecordsPanel.vue` with this content:

```vue
<template>
  <div
    v-if="visible"
    class="deleted-records-panel mb-4 bg-amber-900/20 border border-amber-700/50 rounded-lg overflow-hidden"
  >
    <!-- 可折叠头部 -->
    <button
      @click="toggleExpand"
      class="w-full px-4 py-3 flex items-center gap-2 hover:bg-amber-900/30 transition-colors"
    >
      <span
        :class="[
          'inline-block text-xs text-amber-400 transition-transform',
          expanded ? 'rotate-90' : ''
        ]"
      >▶</span>
      <span class="text-base">📋</span>
      <span class="text-amber-200 font-medium text-sm">
        {{ records.length }} 条删除记录
      </span>
    </button>

    <!-- 展开内容 -->
    <ul
      v-if="expanded"
      class="border-t border-amber-700/50 px-4 py-2 max-h-64 overflow-y-auto"
    >
      <li
        v-for="(record, idx) in records"
        :key="idx"
        class="py-1.5 text-sm flex items-baseline gap-3 border-b border-amber-800/30 last:border-b-0"
      >
        <span class="text-amber-400/70 font-mono text-xs whitespace-nowrap">
          {{ record.timestamp }}
        </span>
        <span class="text-slate-300 break-all">
          {{ record.path }}
        </span>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useVideoStore } from '@/stores/videoStore'
import type { DeletionRecord } from '@/types'

const props = defineProps<{
  directoryPath: string
}>()

const store = useVideoStore()

const records = ref<DeletionRecord[]>([])
const expanded = ref(false)
const visible = ref(false)
const loading = ref(false)

function toggleExpand() {
  expanded.value = !expanded.value
}

watch(
  () => props.directoryPath,
  async (newPath) => {
    // 重置状态
    records.value = []
    visible.value = false
    expanded.value = false

    if (!newPath) return

    loading.value = true
    const result = await store.loadDeletionRecords(newPath)
    loading.value = false

    if (result.exists && result.records.length > 0) {
      records.value = result.records
      visible.value = true
    }
  },
  { immediate: true }
)
</script>

<style scoped>
.deleted-records-panel {
  position: relative;
}
</style>
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx vue-tsc --noEmit`
Expected: No errors (exits 0)

- [ ] **Step 3: Commit**

```bash
cd ..
git add frontend/src/components/DeletedRecordsPanel.vue
git commit -m "feat(ui): add DeletedRecordsPanel component"
```

---

## Task 8: Integrate Component into HomeView

**Files:**
- Modify: `frontend/src/views/HomeView.vue`

- [ ] **Step 1: Add the import**

Open `frontend/src/views/HomeView.vue`. Find the imports block (around line 252-261):

```typescript
import VideoCard from '@/components/VideoCard.vue'
import DirectoryTree from '@/components/DirectoryTree.vue'
import AppLayout from '@/components/AppLayout.vue'
import DeleteConfirmDialog from '@/components/DeleteConfirmDialog.vue'
import TagFilter from '@/components/TagFilter.vue'
import type { Video } from '@/types'
```

Add a new import after `TagFilter`:

```typescript
import DeletedRecordsPanel from '@/components/DeletedRecordsPanel.vue'
```

- [ ] **Step 2: Insert the component into the template**

Find this block in the template (around line 156, end of the breadcrumb/sort controls `<div>`):

```html
        </div>
      </div>

      <div v-if="store.loading" class="flex-1 flex items-center justify-center">
```

Insert the component between these two `<div>` elements:

```html
        </div>
      </div>

      <!-- 删除记录面板 -->
      <DeletedRecordsPanel
        v-if="store.selectedDirectory"
        :directory-path="store.selectedDirectory"
      />

      <div v-if="store.loading" class="flex-1 flex items-center justify-center">
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd frontend && npx vue-tsc --noEmit`
Expected: No errors (exits 0)

- [ ] **Step 4: Build to verify Vue compiles**

Run: `cd frontend && npm run build`
Expected: Build succeeds. No Vue compilation errors.

- [ ] **Step 5: Commit**

```bash
cd ..
git add frontend/src/views/HomeView.vue
git commit -m "feat(ui): mount DeletedRecordsPanel in HomeView"
```

---

## Task 9: Manual Smoke Test

**Files:** None (manual verification)

- [ ] **Step 1: Start the backend server**

In one terminal:
```bash
npm run server
```

Expected: Server starts, log shows `GET  /api/deletion-records - 获取目录删除记录`

- [ ] **Step 2: Start the frontend**

In another terminal:
```bash
npm run frontend
```

Expected: Vite dev server starts on port 5173.

- [ ] **Step 3: Verify panel behavior**

Open browser at `http://localhost:5173`. Test scenarios:

1. **Click "全部视频"**: No panel should appear.
2. **Click a directory without `deleted_video_dirs.txt`**: No panel should appear.
3. **Click a directory with `deleted_video_dirs.txt`**: Panel should appear showing "N 条删除记录".
4. **Click the panel header**: Should expand to show all records.
5. **Click again**: Should collapse.
6. **Switch to another directory**: Panel should update (or disappear) accordingly.

- [ ] **Step 4: Test API directly (optional)**

Run: `curl "http://localhost:3000/api/deletion-records?path=<your_test_dir>"`
Expected: Returns JSON with `exists` and `records` fields.

---

## Final Verification

- [ ] **Run all backend tests**

```bash
npx jest
```

Expected: All tests pass, including the new `deletionRecords.test.js`.

- [ ] **Run frontend type check**

```bash
cd frontend && npx vue-tsc --noEmit
```

Expected: No errors.

- [ ] **Review final diff**

```bash
git log --oneline -10
git diff HEAD~8 --stat
```

Expected: 9 commits (8 task commits + 1 spec commit), changes only in the planned files.