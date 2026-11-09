const LABORATORY_BASE_PATH = '/Alfred-Laboratory/';

export function isLaboratoryBuild(baseUrl: string): boolean {
  return baseUrl === LABORATORY_BASE_PATH;
}

export function getAlfredDatabaseName(baseUrl: string): string {
  return isLaboratoryBuild(baseUrl) ? 'alfred-laboratory' : 'alfred';
}

export function getAlfredLocalStorageKey(key: string, baseUrl = import.meta.env.BASE_URL): string {
  return isLaboratoryBuild(baseUrl) ? `alfred-laboratory:${key}` : key;
}
