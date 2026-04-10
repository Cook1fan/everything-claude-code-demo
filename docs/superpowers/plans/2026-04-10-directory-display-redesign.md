# 目录显示功能重新设计 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让目录树可以显示所有层级的目录，即使用户点击的目录下没有直接的视频文件，也能继续浏览子目录，最终找到包含视频的目录。

**Architecture:** 
1. 修改后端扫描器，在构建目录树时保留所有目录结构，不只是有视频的目录
2. 修改前端 videoStore，让 filteredVideos 可以显示选中目录及其所有子目录下的视频
3. 保持目录树组件不变，因为它已经支持显示任意深度的目录结构

**Tech Stack:** Node.js (后端扫描器), Vue 3 + Pinia (前端)

---

## 问题分析

当前实现的问题：

1. **后端 `scanner/scan.js`**: 在 `buildDirectoryTree` 函数中（第 122 行），只有当子目录有 `videoCount > 0` 或 `children.length > 0` 时才会被添加到树中。但实际上，由于递归逻辑，如果一个目录的后代有视频，它会被保留；但如果目录结构还没有被扫描到视频（或用户想浏览空目录），目录就不会显示。

2. **前端 `videoStore.ts`**: `filteredVideos` 计算属性（第 83-85 行）只过滤 `v.directory === selectedDirectory.value` 的视频，这意味着如果选中的目录本身不直接包含视频，就什么都不显示。

---

## Task 1: 修改后端扫描器 - 保留完整目录树

**Files:**
- Modify: `scanner/scan.js:83-133`

### 问题说明

当前 `buildDirectoryTree` 函数只保留有视频的目录或有子目录的目录。我们需要修改它，让它保留所有目录结构。

- [ ] **Step 1: 修改 buildDirectoryTree 函数**

找到 `scanner/scan.js` 中的 `buildDirectoryTree` 函数（第 83-133 行），修改递归添加子节点的逻辑：

**当前代码（第 120-126 行）：**
```javascript
if (stat.isDirectory() && config.recursive) {
  const childNode = buildDirectoryTree(fullPath, hardDrive, normalizePath(dirPath));
  if (childNode.videoCount > 0 || childNode.children.length > 0) {
    treeNode.children.push(childNode);
    treeNode.videoCount += childNode.videoCount;
  }
}
```

**修改为：**
```javascript
if (stat.isDirectory() && config.recursive) {
  const childNode = buildDirectoryTree(fullPath, hardDrive, normalizePath(dirPath));
  // 保留所有目录，即使没有视频
  treeNode.children.push(childNode);
  treeNode.videoCount += childNode.videoCount;
}
```

同时，修改根目录的添加逻辑（第 235-238 行）：

**当前代码：**
```javascript
const tree = buildDirectoryTree(hardDrive, hardDrive);
if (tree.videoCount > 0 || tree.children.length > 0) {
  results.directoryTree.push(tree);
}
```

**修改为：**
```javascript
const tree = buildDirectoryTree(hardDrive, hardDrive);
// 始终添加根目录
results.directoryTree.push(tree);
```

- [ ] **Step 2: 测试修改后的扫描器**

运行扫描器验证修改是否正确：
```bash
cd scanner
node scan.js
```

检查生成的 `data/videos.json`，确认目录树包含了完整的目录结构。

---

## Task 2: 修改前端 Store - 支持显示子目录视频

**Files:**
- Modify: `frontend/src/stores/videoStore.ts:79-114`

### 问题说明

当前 `filteredVideos` 只显示 `v.directory === selectedDirectory.value` 的视频。我们需要修改它，让它显示选中目录及其所有子目录下的视频。

- [ ] **Step 1: 修改 filteredVideos 计算属性**

找到 `frontend/src/stores/videoStore.ts` 中的 `filteredVideos` 计算属性（第 79-114 行）。

**当前代码（第 83-85 行）：**
```javascript
if (selectedDirectory.value) {
  result = result.filter(v => v.directory === selectedDirectory.value)
}
```

**修改为：**
```javascript
if (selectedDirectory.value) {
  // 显示选中目录及其所有子目录下的视频
  result = result.filter(v => {
    // 检查视频目录是否等于选中目录，或是选中目录的子目录
    return v.directory === selectedDirectory.value || 
           v.directory.startsWith(selectedDirectory.value + '/')
  })
}
```

- [ ] **Step 2: 验证类型安全**

确保修改后的代码 TypeScript 类型正确，没有类型错误。

---

## Task 3: 测试完整流程

**Files:**
- Test: 手动测试完整功能

- [ ] **Step 1: 重新扫描目录**

```bash
cd scanner
node scan.js
```

- [ ] **Step 2: 启动前端并测试**

启动开发服务器，测试以下场景：

1. 点击"主演名"目录 - 应该能看到该主演所有年份的所有视频
2. 点击"年份"目录 - 应该能看到该年份所有视频
3. 点击"视频目录" - 应该能看到该目录下的视频
4. 目录树应该能展开/折叠所有层级的目录

---

## 总结

这个计划修改了两个关键部分：

1. **后端扫描器**: 保留完整的目录树结构，不只是有视频的目录
2. **前端过滤逻辑**: 选中目录时显示该目录及其所有子目录下的视频

这样用户就可以像普通文件浏览器一样，逐层浏览目录结构了。
