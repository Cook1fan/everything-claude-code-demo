const { parentPort } = require('worker_threads');
const { scan } = require('./scan');

try {
  const result = scan();
  parentPort.postMessage({ type: 'success', result });
} catch (err) {
  parentPort.postMessage({ type: 'error', error: err.message });
}
