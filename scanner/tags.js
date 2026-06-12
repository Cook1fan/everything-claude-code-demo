/**
 * 视频标签提取工具
 * 从视频标题中提取预定义的标签
 *
 * 标签列表在 scanner/config.local.js 中配置（不会提交到 GitHub）
 */

// 尝试从本地配置读取标签
let TAGS = []
try {
  const localConfig = require('./config.local')
  TAGS = localConfig.TAGS || []
} catch (e) {
  // 如果 config.local.js 不存在，使用空数组
  // 用户需要创建此文件并定义 TAGS
  TAGS = []
}

/**
 * 从标题中提取匹配的标签
 * @param {string} title - 视频标题
 * @returns {string[]} 匹配的标签数组
 */
function extractTags(title) {
  if (!title) return [];
  return TAGS.filter(tag => title.includes(tag));
}

/**
 * 从视频列表构建全局标签计数
 * @param {Array} videos - 视频数组
 * @returns {Array<{name: string, count: number}>} 标签列表及计数，按计数降序排列
 */
function buildTagCounts(videos) {
  const counts = new Map();
  for (const video of videos) {
    for (const tag of video.tags || []) {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

module.exports = { TAGS, extractTags, buildTagCounts };