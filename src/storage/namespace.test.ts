import { describe, expect, it } from 'vitest';
import { getAlfredDatabaseName, getAlfredLocalStorageKey, isLaboratoryBuild } from './namespace';

describe('namespace de armazenamento por build', () => {
  it('isola o banco IndexedDB da build do Laboratório', () => {
    expect(getAlfredDatabaseName('/Alfred-Laboratory/')).toBe('alfred-laboratory');
    expect(getAlfredDatabaseName('/Alfred/')).toBe('alfred');
    expect(getAlfredDatabaseName('/')).toBe('alfred');
  });

  it('separa as preferências locais do Laboratório sem alterar as chaves do Alfred principal', () => {
    expect(getAlfredLocalStorageKey('alfred-weather-city', '/Alfred-Laboratory/'))
      .toBe('alfred-laboratory:alfred-weather-city');
    expect(getAlfredLocalStorageKey('alfred-weather-city', '/Alfred/'))
      .toBe('alfred-weather-city');
  });

  it('reconhece apenas o caminho configurado para o Laboratório', () => {
    expect(isLaboratoryBuild('/Alfred-Laboratory/')).toBe(true);
    expect(isLaboratoryBuild('/Alfred-Laboratory-preview/')).toBe(false);
  });
});
