# Upgrading


## Upgrading from 7.x to 8.0

* Some fields have been converted from Objects to Maps:
  * `closeWorkerAfterMs`
  * `workers`
  * `timeouts`
  * `intervals`
* `start()` will now throw an error if the job has already started
* `config.root` now defaults to `path.join(__dirname, 'jobs')` as opposed to `path.resolve('jobs')`
