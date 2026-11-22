import { describe, expect, it } from 'vitest';
import { displayStudyTitle } from './displayStudyTitle';

describe('displayStudyTitle', () => {
  it('cleans Markdown and malformed extracted titles', () => {
    expect(displayStudyTitle('**HTTP**')).toBe('HTTP');
    expect(displayStudyTitle('*Atenção à palavra “API”')).toBe('Atenção à palavra “API”');
    expect(displayStudyTitle('{ id')).toBe('id');
    expect(displayStudyTitle('## HTTPS')).toBe('HTTPS');
  });

  it('preserves meaningful syntax in code-like labels', () => {
    expect(displayStudyTitle('**kwargs')).toBe('kwargs'); // ambiguous import styling, display only
    expect(displayStudyTitle('HTTP/2')).toBe('HTTP/2');
    expect(displayStudyTitle('C++')).toBe('C++');
  });

  it('uses a neutral fallback instead of corrupt headings', () => {
    expect(displayStudyTitle(' *** ')).toBe('Título indisponível');
  });
});
