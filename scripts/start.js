const { spawn } = require('child_process');
const path = require('path');

console.log('启动视频浏览器...');

// 启动后端服务器
const server = spawn('node', ['server/index.js'], {
  cwd: __dirname + '/..',
  stdio: 'inherit',
  shell: true
});

// 等待一下让服务器启动，然后启动前端
setTimeout(() => {
  const frontend = spawn('npm', ['run', 'dev'], {
    cwd: path.join(__dirname, '..', 'frontend'),
    stdio: 'inherit',
    shell: true
  });

  frontend.on('close', (code) => {
    console.log(`前端进程退出，代码: ${code}`);
    server.kill();
  });
}, 2000);

server.on('close', (code) => {
  console.log(`服务器进程退出，代码: ${code}`);
  process.exit(code);
});

// 优雅退出
process.on('SIGINT', () => {
  console.log('\n正在关闭...');
  server.kill();
  process.exit();
});
