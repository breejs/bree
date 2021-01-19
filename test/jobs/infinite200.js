setInterval(() => {
  console.log('hello from infinite200 job');
  // eslint-disable-next-line unicorn/no-process-exit
  return process.exit(0);
}, 200);
