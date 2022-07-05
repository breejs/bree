# Upgrading


## Upgrading from v8 to v9

**There are three major breaking changes:**

1. The usage of `bree.start()` and `bree.run()` methods must be changed to `await bree.start()` or `await bree.run()` (see the example below).
2. The usage of `bree.add()` must be changed to `await bree.add()` (since we now have asynchronous job validation and loading).
3. We have opted for `util.debuglog` as opposed to the userland `debug` package for debug logging.  This means you must run `NODE_DEBUG=bree node app.js` as opposed to `DEBUG=bree node app.js`.

Here is a complete list of the underlying changes made:

* The method `start()` is now a Promise and you should either call `await bree.start()` or additionally call `await bree.init()` (an internal private method called by Bree) before attempting to start or use your Bree instance.

  > CJS:

  ```diff
  // if you're using CJS and you run such as `node app.js`
  -bree.start();

  +// async/await iif style
  +(async () => {
  +  await bree.start();
  +})();
  ```

  > ESM:

  ```diff
  -bree.start();

  +// leverage top-level await support (requires Node v14.8+)
  +await bree.start();
  ```

* ESM module support has been added (per [#180](https://github.com/breejs/bree/issues/180)) by using dynamic imports to load the job Array (CJS is still supported).
  * For a majority of users, you do not need to make any changes to your code for v9 to work when you upgrade from v8 (**with the exception of now having to do `await bree.start()`**).
  * Top-level await support is added in Node v14.8+ (without requiring any Node flags), and therefore you can call `await bree.start();` (e.g. if your `package.json` has `"type": "module"` and/or the file extension you're running with Node is `.mjs`).  Note that Bree still works in Node v12.17+
  * The major difference is that Bree no longer initializes `this.config.jobs` in the constructor.
  * However we have dummy-proofed this new approach, and `bree.init()` will be invoked (if and only if it has not yet been invoked successfully) when you call `bree.start()` (or any similar method that accesses `this.config.jobs` internally).
  * Internal methods such as `validate` exported by `src/job-validator.js` are now asynchronous and return Promises (you do not need to worry about this unless you're doing something custom with these functions).

* The default `root` option will now attempt to resolve an absolute file path for an index since we are using dynamic imports.  If you are using `index.mjs` (as opposed to `index.js` then you will need to set a value for the option `defaultRootIndex`).  See <https://nodejs.org/api/esm.html#esm_mandatory_file_extensions> for more insight.

* The method `add()` is now a Promise (you should call `await bree.add(jobs)`.

* Several methods are now Promises in order to dummy-proof Bree for users that may not wish to call `await bree.init()` before calling `await bree.start()` (as per above).
  * The method `run()` is now a Promise (**but you do not need to `await` it** if you already called `await bree.start()` or `await bree.init()` or any of the methods listed below).
  * The method `stop()` is now a Promise (**but you do not need to `await` it** if you already called `await bree.start()` or `await bree.init()` or `await bree.run()` nor any of the methods listed below).

* We've also refactored synchronous methods such as `fs.statSync` to `fs.promises.stat` and made job validation asynchronous.

* Plugins that extend `bree.init()` may need rewritten, as `bree.init()` is now a Promise.

* If you are on Node version <= v12.20.0, please upgrade to the latest Node v12, but preferably please upgrade to the latest Node LTS (at the time of this writing it is Node v16, but if you can't upgrade to Node v16, at least upgrade to Node v14).  Node v12 is EOL as of April 2022.

* Plugins will need to now `return init()` if you override the `init` function, for example (this is the change we had to make in `@breejs/ts-worker`):

```diff
// define accepted extensions
-Bree.prototype.init = function () {
+Bree.prototype.init = async function () {
  if (!this.config.acceptedExtensions.includes('.ts'))
    this.config.acceptedExtensions.push('.ts');

-  oldInit.bind(this)();
+  return oldInit.call(this);
};
```


## Upgrading from v7 to v8

* Some fields have been converted from Objects to [Maps](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map):
  * `closeWorkerAfterMs`
  * `workers`
  * `timeouts`
  * `intervals`
  * Instead of accessing them via `bree.workers.NAME`, you should access them with `.get` (e.g. `bree.workers.get(NAME);`).
* The method `start()` will now throw an error if the job has already started.
