/** A prepared dataset is missing, malformed or inconsistent with the manifest. */
export class DataError extends Error {
  override name = 'DataError';
}
