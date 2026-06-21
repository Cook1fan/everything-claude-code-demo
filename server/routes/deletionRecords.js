const express = require('express');
const path = require('path');
const fs = require('fs');
const { isPathAllowed } = require('../middleware/path');

const router = express.Router();

const RECORD_FILE_NAME = 'deleted_video_dirs.txt';
const LINE_PATTERN = /^\[(.+?)\]\s+(.+)$/;
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

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

    // 验证时间戳格式 (ISO 8601)
    if (!ISO_TIMESTAMP_PATTERN.test(match[1])) continue;

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
