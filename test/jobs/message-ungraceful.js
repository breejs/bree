const { parentPort } = require('worker_threads');

setInterval(() => {}, 10);

if (parentPort) {
  parentPort.on('message', (message) => {
    if (message === 'cancel') {
      parentPort.postMessage('ungraceful');
    }
  });
}
