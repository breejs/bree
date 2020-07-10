const delay = require('delay');
const { parentPort } = require('worker_threads');

(async () => {
  await delay(1);

  if (parentPort) {
    parentPort.postMessage('get ready');
    parentPort.postMessage('done');
  }
})();
