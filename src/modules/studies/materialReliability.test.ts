import { describe, expect, it } from 'vitest';
import { assessMaterial, correctMaterial, validateMaterialResources, PROCESSING_PROFILES } from './materialReliability';
const source = 'Mitose: divisão celular que mantém o número de cromossomos.';
describe('material reliability', () => {
  it('uses seven separate processing profiles', () => expect(Object.keys(PROCESSING_PROFILES)).toHaveLength(7));
  it('accepts clear source with high confidence', () => expect(validateMaterialResources(source, assessMaterial(source, 98, 95).score, 'board').flashcards).toHaveLength(1));
  it('blocks low OCR even when other signals are strong', () => expect(assessMaterial(source, 40, 100).score).toBeLessThan(65));
  it('blocks medium confidence', () => expect(validateMaterialResources(source, 72, 'board').flashcards).toEqual([]));
  it('does not treat high OCR confidence as proof', () => expect(assessMaterial('x9x � q- � x9x �', 99, 10).score).toBeLessThan(65));
  it('preserves correction provenance', () => {
    const raw = 'Mitose:\u00a0divisão celular';
    const result = correctMaterial(raw, 'file-1', 'printed');
    expect(result.corrections[0]).toMatchObject({ original: '\u00a0', corrected: ' ', sourceFileId: 'file-1', confidence: 100, region: { start: 7, end: 8 } });
    expect(raw).toContain('\u00a0');
  });
  it('does not guess truncated words', () => expect(correctMaterial('A mito-\ncondria produz energia.', 'f', 'board').corrections).toEqual([]));
  it('joins only words attested in the source', () => expect(correctMaterial('mitocondria mito-\ncondria', 'f', 'printed').corrected).toBe('mitocondria mitocondria'));
  it('blocks conflicting definitions', () => {
    const conflict = source + '\nMitose: divisão celular que reduz o número de cromossomos.';
    expect(assessMaterial(conflict, 99, 99).conflicts).toBe(true);
    expect(validateMaterialResources(conflict, 99, 'board').flashcards).toEqual([]);
  });
  it('retains evidence and confidence', () => expect(validateMaterialResources(source, 95, 'printed').flashcards[0]).toMatchObject({ sourceExcerpt: source, confidence: 95 }));
  it('does not invent resources from blank text, formulas or diagrams', () => {
    for (const text of ['', 'x = y + 2', 'célula → núcleo']) expect(validateMaterialResources(text, 100, 'diagram').flashcards).toEqual([]);
  });
  it('rejects ambiguous answers shared by distinct terms', () => {
    const text = ['Alfa', 'Beta', 'Gama', 'Delta'].map(term => `${term}: divisão celular que mantém o número de cromossomos.`).join('\n');
    expect(validateMaterialResources(text, 100, 'printed').questions).toEqual([]);
  });
});

it('never generates a truncated definition from a wrapped OCR line', () => {
  const raw = 'Mitose: divisão celular que mantém\no número de cromossomos.';
  expect(validateMaterialResources(raw, 95, 'board').flashcards).toHaveLength(0);
  const fixed = correctMaterial(raw, 'image', 'printed');
  expect(fixed.corrected).toBe('Mitose: divisão celular que mantém o número de cromossomos.');
  expect(fixed.corrections[0]).toMatchObject({ sourceFileId: 'image', confidence: 95 });
  expect(validateMaterialResources(fixed.corrected, 95, 'printed').flashcards[0].back).toBe('divisão celular que mantém o número de cromossomos.');
});

it('structures only evidence present in the source', async () => {
  const { structureMaterial } = await import('./materialReliability');
  const text = 'BIOLOGIA\n1. Preparar a lâmina\nExemplo: célula vegetal\nx = y + 2\nQual célula?';
  const blocks = structureMaterial(text);
  expect(blocks.map(block => block.kind)).toEqual(['title', 'step', 'example', 'formula', 'question']);
  for (const block of blocks) expect(text.slice(block.region.start, block.region.end)).toBe(block.text);
});
