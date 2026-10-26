import { DataError } from './errors';
import { DataRepository, type DataFetcher } from './repository';

const DATA_BASE_URL = `${import.meta.env.BASE_URL}data/`;

const fetchData: DataFetcher = async (path) => {
  const response = await fetch(`${DATA_BASE_URL}${path}`);
  if (!response.ok) {
    throw new DataError(`failed to load ${path}: HTTP ${String(response.status)}`);
  }
  return response.arrayBuffer();
};

/** The application's single repository instance. */
export const dataRepository = new DataRepository(fetchData);
