const process = require('process');

setInterval(() => {
  process.exit(2);
}, 10);
