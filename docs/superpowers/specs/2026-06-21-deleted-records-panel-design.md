# 设计文档: 删除记录面板 (Deleted Records Panel)

**日期:** 2026-06-21
**作者:** Claude (Brainstorming session)
**状态:** 设计已批准,待实施

## 背景与目标

当用户通过应用删除视频目录时,后端会在**硬盘根目录下的第一层目录**(如 `W:/演员名/`)中创建或追加 `deleted_video_dirs.txt` 文件,记录每次删除的路径和时间戳(详见 `server/routes/files.js` 中的 `findRecordLocation` 逻辑)。

目前应用没有任何 UI 让用户查看这些历史删除记录。本次功能的目标是:

**当用户点击左侧目录树中的某个目录时,如果该目录下存在 `deleted_video_dirs.txt`,就在主内容区顶部展示一个可折叠的"删除记录面板"。**

## 范围

### 包含 (In Scope)

- 新增后端 API 端点读取 `deleted_video_dirs.txt`
- 新增前端组件在主内容区顶部展示删除记录
- 按时间戳降序展示,显示原始时间戳和被删除路径
- 面板默认折叠,显示 "N 条删除记录" 摘要

### 不包含 (Out of Scope)

- 删除记录的删除/编辑功能 (本功能只展示)
- WebSocket 实时推送删除记录变更
- 在目录树节点上显示徽章/计数
- 跨多层级合并多个 `deleted_video_dirs.txt` 文件

## 设计决策摘要

| 决策点 | 选择 | 理由 |
|---|---|---|
| 显示位置 | 主内容区顶部 (面包屑下方) | 用户已明确选择 |
| 查找范围 | 仅当前选中目录 | 用户已明确选择 |
| 深层目录行为 | 仅在第一层目录显示 | 删除记录文件只在第一层 |
| 展示形式 | 可折叠列表 (默认折叠) | 用户已明确选择 |
| 信息内容 | 路径 + 原始时间戳 | 用户已明确选择 |
| 排序 | 最新优先 (时间戳降序) | 用户已明确选择 |
| API 策略 | 按需懒加载 | 仅选中目录时加载,符合 KISS |
| 整体方案 | 方案 A: 简单懒加载 API | 简单、职责单一 |

## 架构

### 数据流

```
用户点击左侧目录树节点
    ↓
HomeView: store.selectedDirectory 变化
    ↓
DeletedRecordsPanel 组件 watch directoryPath prop
    ↓
调用 store.loadDeletionRecords(dirPath)
    ↓
GET /api/deletion-records?path=<dirPath>
    ↓
后端: 在 dirPath 下查找 deleted_video_dirs.txt
    ↓
解析每行 [ISO时间戳] 路径
    ↓
按时间戳降序返回 JSON
    ↓
前端: 显示可折叠面板
```

### 模块边界

| 模块 | 文件 | 职责 |
|---|---|---|
| 后端路由 | `server/routes/deletionRecords.js` | 读取并解析 `deleted_video_dirs.txt` |
| 前端组件 | `frontend/src/components/DeletedRecordsPanel.vue` | 展示可折叠面板 |
| 状态管理 | `frontend/src/stores/videoStore.ts` | 新增 `loadDeletionRecords` action |
| 视图集成 | `frontend/src/views/HomeView.vue` | 挂载组件到主内容区顶部 |

## 数据模型

### TypeScript 类型 (frontend/src/types.ts)

```typescript
export interface DeletionRecord {
  timestamp: string;   // ISO 格式,如 "2025-12-18T14:30:25.000Z"
  path: string;        // 被删除的目录完整路径
}

export interface DeletionRecordsResponse {
  exists: boolean;            // 文件是否存在
  records: DeletionRecord[];  // 按时间戳降序排列(仅当 exists 为 true 时有值)
}
```

## API 设计

### 端点

```
GET /api/deletion-records?path=<dirPath>
```

### 请求参数

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `path` | string | 是 | 要查询的目录绝对路径 |

### 响应

**文件存在 (200):**
```json
{
  "exists": true,
  "records": [
    { "timestamp": "2025-12-18T14:30:25.000Z", "path": "W:\\演员名\\2024\\电影名" },
    { "timestamp": "2025-11-05T09:15:10.000Z", "path": "W:\\演员名\\2023\\电影名" }
  ]
}
```

**文件不存在 (200):**
```json
{ "exists": false, "records": [] }
```

**错误响应:**
- `400` - 缺少 path 参数
- `403` - 禁止访问该路径 (不在配置允许范围内)
- `404` - 目录不存在

### 解析规则

- 按行读取文件,跳过空行
- 匹配正则 `^\[(.+?)\]\s+(.+)$` 提取时间戳和路径
- 解析失败的行被跳过(不返回,避免污染数据)
- 按时间戳降序排序

### 安全

- 必须复用 `server/middleware/path.js` 中的 `isPathAllowed` 中间件
- 文件名硬编码为 `deleted_video_dirs.txt`,不接受外部传入
- 不允许通过 `path` 参数逃逸到配置外的目录

## 前端组件设计

### DeletedRecordsPanel.vue

**Props:**
```typescript
interface Props {
  directoryPath: string;
}
```

**内部状态:**
- `records: DeletionRecord[]` - 已加载的记录
- `expanded: boolean` - 是否展开(默认 false)
- `visible: boolean` - 是否显示(根据 exists 和 records 长度决定)
- `loading: boolean` - 加载状态

**加载触发:**
```typescript
watch(() => props.directoryPath, async (newPath) => {
  // 重置状态
  records.value = []
  visible.value = false

  if (!newPath) return

  loading.value = true
  const result = await store.loadDeletionRecords(newPath)
  loading.value = false

  if (result.exists && result.records.length > 0) {
    records.value = result.records
    visible.value = true
  }
}, { immediate: true })
```

**模板结构:**
```vue
<template>
  <div v-if="visible" class="deleted-records-panel mb-4 bg-amber-900/20 border border-amber-700/50 rounded-lg overflow-hidden">
    <!-- 头部:可折叠按钮 -->
    <button
      @click="expanded = !expanded"
      class="w-full px-4 py-3 flex items-center gap-2 hover:bg-amber-900/30 transition-colors"
    >
      <span :class="['arrow text-xs', { 'rotate-90': expanded }]">▶</span>
      <span>📋</span>
      <span class="text-amber-200 font-medium">
        {{ records.length }} 条删除记录
      </span>
    </button>

    <!-- 展开内容 -->
    <ul v-if="expanded" class="border-t border-amber-700/50 px-4 py-2 max-h-64 overflow-y-auto">
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
```

### HomeView.vue 集成

在 `<main>` 内、面包屑导航 `<div>` 之下、视频网格 `<div v-else class="flex-1 flex flex-col">` 之前插入:

```vue
<!-- 删除记录面板 -->
<DeletedRecordsPanel
  v-if="store.selectedDirectory"
  :directory-path="store.selectedDirectory"
/>
```

仅在 `store.selectedDirectory` 非空时挂载,避免对"全部视频"模式触发加载。

### videoStore.ts 新增 action

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

## 后端路由设计

### server/routes/deletionRecords.js

```javascript
const express = require('express');
const path = require('path');
const fs = require('fs');
const { isPathAllowed } = require('../middleware/path');

const router = express.Router();

const RECORD_FILE_NAME = 'deleted_video_dirs.txt';
const LINE_PATTERN = /^\[(.+?)\]\s+(.+)$/;

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

  // 按时间戳降序
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

### server/app.js 修改

```javascript
const deletionRecordsRouter = require('./routes/deletionRecords');

// ... 在路由注册处新增:
app.use('/api/deletion-records', deletionRecordsRouter);
```

### server/index.js 修改

控制台输出新增一行:
```
console.log('  GET  /api/deletion-records - 获取目录删除记录');
```

## 错误处理

| 场景 | 后端行为 | 前端行为 |
|---|---|---|
| 路径不存在 | 404 | 不显示面板 |
| 路径不允许 | 403 | 不显示面板,console.error |
| 路径不是目录 | 400 | 不显示面板,console.error |
| 文件不存在 | 200 + `{exists:false}` | 不显示面板 |
| 文件解析失败行 | 跳过该行 | 不影响其他记录 |
| 网络错误 | - | 不显示面板,console.error |
| 文件读取异常 | 500 | 不显示面板,console.error |

**原则:** 任何异常情况下,前端都不显示面板,不影响主界面。

## 测试

### 后端测试 (server/routes/deletionRecords.test.js)

测试场景:
1. ✅ 有效路径 + 文件存在 → 返回按时间戳降序的记录列表
2. ✅ 有效路径 + 文件不存在 → 返回 `{exists: false}`
3. ✅ 路径不存在 → 返回 404
4. ✅ 路径不在白名单 → 返回 403
5. ✅ 路径是文件不是目录 → 返回 400
6. ✅ 文件中有空行 → 跳过空行
7. ✅ 文件中有解析失败的行 → 跳过该行,不影响其他记录
8. ✅ 时间戳格式正确解析

## 文件改动清单

### 后端 (3 个文件)

1. **新建** `server/routes/deletionRecords.js` (~70 行)
2. **修改** `server/app.js` (+2 行)
3. **修改** `server/index.js` (+1 行)

### 前端 (4 个文件)

4. **修改** `frontend/src/types.ts` (+12 行)
5. **修改** `frontend/src/stores/videoStore.ts` (+18 行)
6. **新建** `frontend/src/components/DeletedRecordsPanel.vue` (~90 行)
7. **修改** `frontend/src/views/HomeView.vue` (+5 行)

### 测试 (1 个文件)

8. **新建** `server/routes/deletionRecords.test.js` (~100 行)

**预计总代码量:** ~280 行新增, ~38 行修改

## 构建顺序

```
1. types.ts                 (类型先行)
2. server/routes/deletionRecords.js  (后端 API)
3. server/app.js            (路由注册)
4. server/index.js          (日志)
5. deletionRecords.test.js  (后端测试)
6. videoStore.ts            (前端 store)
7. DeletedRecordsPanel.vue  (前端组件)
8. HomeView.vue             (视图集成)
```

## 开放问题

无。所有关键决策已在头脑风暴阶段通过澄清问题确定。