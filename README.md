# [**@ladjs/cron**](https://github.com/ladjs/cron)

[![build status](https://img.shields.io/travis/com/ladjs/cron.svg)](https://travis-ci.com/ladjs/cron)
[![code coverage](https://img.shields.io/codecov/c/github/ladjs/cron.svg)](https://codecov.io/gh/ladjs/cron)
[![code style](https://img.shields.io/badge/code_style-XO-5ed9c7.svg)](https://github.com/sindresorhus/xo)
[![styled with prettier](https://img.shields.io/badge/styled_with-prettier-ff69b4.svg)](https://github.com/prettier/prettier)
[![made with lass](https://img.shields.io/badge/made_with-lass-95CC28.svg)](https://lass.js.org)
[![license](https://img.shields.io/github/license/ladjs/cron.svg)](LICENSE)
[![npm downloads](https://img.shields.io/npm/dt/@ladjs/cron.svg)](https://npm.im/@ladjs/cron)

> The best job scheduler for Node.js with support for cron, ms, and human-friendly strings.  Uses workers and spawns sandboxed processes.  Supports async/await, retries, throttling, concurrency, and cancelable promises (graceful shutdown).  Simple, fast, and the most lightweight tool for the job.  Made for Lad.


## Table of Contents

* [Install](#install)
* [Usage](#usage)
* [Contributors](#contributors)
* [License](#license)


## Install

[npm][]:

```sh
npm install @ladjs/cron
```

[yarn][]:

```sh
yarn add @ladjs/cron
```


## Usage

```js
const @ladjs/cron = require('@ladjs/cron');

const @ladjs/cron = new @ladjs/cron();

console.log(@ladjs/cron.renderName());
// script
```


## Contributors

| Name           | Website                    |
| -------------- | -------------------------- |
| **Nick Baugh** | <http://niftylettuce.com/> |


## License

[MIT](LICENSE) © [Nick Baugh](http://niftylettuce.com/)


## 

[npm]: https://www.npmjs.com/

[yarn]: https://yarnpkg.com/
