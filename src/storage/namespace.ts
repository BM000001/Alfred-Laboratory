const LABORATORY_BASE_PATH = '/Alfred-Laboratory/';

export const STUDIES_DEMO_BASE = '/Alfred-Laboratory/studies-app/';

export function isLaboratoryBuild(baseUrl: string): boolean {
  return baseUrl === LABORATORY_BASE_PATH;
}

export function getAlfredDatabaseName(baseUrl: string): string {
  if (baseUrl === STUDIES_DEMO_BASE) return 'alfred-studies-demo';
  return isLaboratoryBuild(baseUrl) ? 'alfred-laboratory' : 'alfred';
}

export function getAlfredLocalStorageKey(key: string, baseUrl = import.meta.env.BASE_URL): string {
  if (baseUrl === STUDIES_DEMO_BASE) return `alfred-studies-demo:${key}`;
  return isLaboratoryBuild(baseUrl) ? `alfred-laboratory:${key}` : key;
}
