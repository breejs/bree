const Bree = require('../../src/index.js');

const bree = new Bree({
  jobs: ['job']
});

(async () => {
  await bree.start();
})();
