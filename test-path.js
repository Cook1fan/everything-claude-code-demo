
const path = require('path');
const config = require('./scanner/config');

// 复制我们修复后的函数
function normalizePath(p) {
  return p.replace(/\\/g, '/');
}

function getAllowedDirectories() {
  const allowed = [...config.hardDrives];
  const outputDir = path.resolve(path.dirname(config.outputPath));
  if (!allowed.includes(outputDir)) {
    allowed.push(outputDir);
  }
  return allowed;
}

function isPathAllowed(resolvedPath) {
  const normalizedPath = normalizePath(path.resolve(resolvedPath));
  const allowedDirs = getAllowedDirectories();

  console.log('检查路径:', normalizedPath);
  console.log('允许的目录:', allowedDirs);

  for (const dir of allowedDirs) {
    let normalizedDir = normalizePath(path.resolve(dir));

    // 处理 Windows 盘符情况（如 "W:" -> "W:/"）
    if (process.platform === 'win32' && /^[A-Za-z]:$/.test(normalizedDir)) {
      normalizedDir = normalizedDir + '/';
    }

    // 确保目录路径以分隔符结尾，便于前缀匹配
    const dirWithSlash = normalizedDir.endsWith('/') ? normalizedDir : normalizedDir + '/';

    console.log(`  检查目录: ${dir} -> ${normalizedDir} -> ${dirWithSlash}`);

    if (normalizedPath === normalizedDir || normalizedPath.startsWith(dirWithSlash)) {
      console.log('  ✓ 匹配成功!');
      return true;
    }
  }

  console.log('  ✗ 路径被拒绝');
  return false;
}

// 测试几个路径
console.log('========== 路径检查测试 ==========\n');

const testPaths = [
  'W:/影片/test.jpg',
  'W:/影片/其他/测试.jpg',
  'W:',
  'C:/不允许的路径/test.jpg',
];

testPaths.forEach(p => {
  console.log(`\n测试: ${p}`);
  const result = isPathAllowed(p);
  console.log(`结果: ${result ? '允许' : '拒绝'}`);
});
