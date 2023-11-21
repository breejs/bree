const process = require('node:process');

setTimeout(() => {
  process.exit(2);
}, 4000);
