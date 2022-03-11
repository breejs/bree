# Upgrading


## Upgrading from 7.x to 8.0

* Some fields have been converted from Objects to [Maps](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map):
  * `closeWorkerAfterMs`
  * `workers`
  * `timeouts`
  * `intervals`
  * Instead of accessing them like this `bree.workers.NAME`, you should access them like this `bree.workers.get(NAME)`
* `start()` will now throw an error if the job has already started
