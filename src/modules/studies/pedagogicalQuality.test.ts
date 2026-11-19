import { describe, expect, it } from 'vitest';
import corpus from './__fixtures__/pedagogicalCorpus.json';
import { assessMaterial, definitionDifferences, relevantAmbiguities, validateMaterialResources } from './materialReliability';

function evaluate(text: string) {
  return validateMaterialResources(text, assessMaterial(text).score, 'printed');
}

describe('qualidade pedagógica com corpus sintético', () => {
  it('preserva recordação conceitual, listas e perguntas de compreensão com evidência literal', () => {
    const definitions = evaluate(corpus.definicoes);
    expect(definitions.flashcards).toHaveLength(4);
    expect(definitions.questions).toHaveLength(4);
    expect(evaluate(corpus.lista).flashcards).toHaveLength(1);
    expect(evaluate(corpus.referencias).flashcards).toHaveLength(1);
    expect(evaluate(corpus.narrativa).flashcards[0]?.front).toMatch(/^Por que/);
    for (const text of Object.values(corpus)) {
      const { flashcards, questions } = evaluate(text);
      for (const item of [...flashcards, ...questions]) expect(text).toContain(item.sourceExcerpt);
    }
  });

  it('rejeita instruções, enunciados dependentes de contexto e duplicatas', () => {
    for (const text of [corpus.instrucao, corpus.estados, corpus.codigo, corpus.pouco_contexto]) {
      expect(evaluate(text).flashcards).toHaveLength(0);
    }
    expect(evaluate(corpus.instrucao).reasons).toHaveProperty('context', 1);
    expect(evaluate(corpus.duplicados)).toMatchObject({ reasons: { duplicate: 1 } });
    expect(evaluate(corpus.duplicados).flashcards).toHaveLength(1);
  });

  it('distingue estados e versões de trechos opostos no mesmo contexto', () => {
    for (const text of [corpus.estados, corpus.complementares, corpus.versoes]) {
      expect(relevantAmbiguities(text)).toHaveLength(0);
    }
    expect(definitionDifferences(corpus.complementares)).toHaveLength(1);
    expect(definitionDifferences(corpus.versoes)).toHaveLength(1);
    expect(relevantAmbiguities(corpus.oposicao)).toHaveLength(1);
    expect(evaluate(corpus.oposicao).flashcards).toHaveLength(0);
  });
});
