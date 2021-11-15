# Working with TypeScript

This is the most basic bree example that shows a basic workflow for working with bree and typescript.

## Using the root option

It is generally best to set the `bree` `root` option when using any tool that may be tranpiling your code. Generally it makes the most sense to set it to `path.join(__dirname, 'jobs')`. If you are compiling to ESModules, you should set it to `path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs')` as the global `__dirname` variable will be unavailable.

## Using TS Node

[TS Node](https://github.com/TypeStrong/ts-node) is a project that uses hooks to compile typescript on the fly for fast and convenient TypeScript development. In order to use `bree` successfully with TS Node and to be able to write your jobs in TypeScript - one needs to run it in such a way that allows TS Node to transpile child process and worker scripts on the fly.

We do this by implementing a `dev` script in our `package.json` as is outlined in the [TS Node docs.](https://github.com/TypeStrong/ts-node#other).

`"dev": "TS_NODE=true NODE_OPTIONS=\"-r ts-node/register\" node ."`

We further add a TS_NODE env var, as when in a TS Node environment, we need to append ts file extensions to our worker paths instead of the default JS. However, when we compile the code for production with the TypeScript compiler (running `tsc`), we need to keep the default js extensions on our worker paths.

## Compiling to ESModules

To compile to ESModules first set `"type": "module"` in your package.json. Ensure your compiler options are set to compile to ESModules output. After that, we need to change our `dev` script in our `package.json` so TS Node [properly compiles workers](https://github.com/TypeStrong/ts-node#other) to ESModules as well.

`"dev": "TS_NODE=true NODE_OPTIONS=\"--loader ts-node/esm\" node ."`
