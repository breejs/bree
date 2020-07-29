declare module 'combine-errors' {
  function combineErrors(errors: Error[]): Error;

  export = combineErrors;
}
