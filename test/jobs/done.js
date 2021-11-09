const { parentPort } = require('worker_threads');
const delay = require('delay');

(async () => {
  await delay(1);

  if (parentPort) {
    parentPort.postMessage('get ready');
    parentPort.postMessage('done');
  }
})();
