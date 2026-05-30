const path = require('path');
const config = require('../../scanner/config');

function normalizePath(p) {
  return p.replace(/\\/g, '/');
}

function getAllowedDirectories() {
  const allowed = [...config.hardDrives];
  const outputDir = path.resolve(path.dirname(config.outputPath));
  if (!allowed.includes(outputDir)) {
    allowed.push(outputDir);
  }
  // 添加用户 Downloads 目录到允许列表
  const downloadsDir = 'C:/Users/cook1/Downloads';
  const downloadsRoot = 'C:/Downloads';
  if (!allowed.includes(downloadsDir)) {
    allowed.push(downloadsDir);
  }
  if (!allowed.includes(downloadsRoot)) {
    allowed.push(downloadsRoot);
  }
  return allowed;
}

function isPathAllowed(resolvedPath) {
  const normalizedPath = normalizePath(path.resolve(resolvedPath));
  const allowedDirs = getAllowedDirectories();

  for (const dir of allowedDirs) {
    let normalizedDir = normalizePath(path.resolve(dir));

    if (process.platform === 'win32' && /^[A-Za-z]:$/.test(normalizedDir)) {
      normalizedDir = normalizedDir + '/';
    }

    const dirWithSlash = normalizedDir.endsWith('/') ? normalizedDir : normalizedDir + '/';

    if (normalizedPath === normalizedDir || normalizedPath.startsWith(dirWithSlash)) {
      return true;
    }
  }

  console.log('路径被拒绝:', normalizedPath, '允许的目录:', allowedDirs);
  return false;
}

module.exports = { normalizePath, isPathAllowed, getAllowedDirectories };
