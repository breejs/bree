const process = require('node:process');

setInterval(() => {
  process.exit(2);
}, 10);
