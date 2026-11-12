import { describe, expect, it } from 'vitest';
import { extractStudyDefinitions, generateStudyResources } from './studyMaterialGeneration';

describe('studyMaterialGeneration', () => {
  it('creates flashcards from explicit source definitions and avoids duplicate statements', () => {
    const text = 'Encapsulamento: mecanismo que protege os dados internos de um objeto.\nEncapsulamento: mecanismo que protege os dados internos de um objeto.';
    expect(extractStudyDefinitions(text)).toHaveLength(1);
    expect(generateStudyResources(text).flashcards[0]).toMatchObject({ subject: 'Encapsulamento', back: 'mecanismo que protege os dados internos de um objeto.' });
    expect(generateStudyResources(text).questions).toEqual([]);
  });

  it('asks which source concept matches the extracted definition and uses related source concepts as choices', () => {
    const text = [
      'Encapsulamento: técnica que protege componentes e estruturas internas dos programas contra acessos indevidos.',
      'Herança: relação que permite reutilizar componentes e estruturas já definidas por outros programas.',
      'Polimorfismo: capacidade de alterar comportamentos de componentes e estruturas durante a execução dos programas.',
      'Abstração: representação que simplifica componentes e estruturas para facilitar a análise dos programas.',
    ].join('\n');
    const result = generateStudyResources(text);
    expect(result.flashcards).toHaveLength(4);
    expect(result.questions).toHaveLength(4);
    const sourceTerms = ['Encapsulamento', 'Herança', 'Polimorfismo', 'Abstração'];
    expect(result.questions).toHaveLength(4);
    expect(result.questions.every((question) => question.options.length === 4 && sourceTerms.includes(question.options[question.correctOptionIndex]) && question.prompt.startsWith('Qual conceito é definido no material como:') && question.explanation.startsWith('Trecho de origem:') && question.difficulty === 'easy')).toBe(true);
    expect(result.questions[0].prompt).toContain('protege componentes e estruturas internas');
    expect(result.questions[0].options).not.toContain('técnica que protege componentes e estruturas internas dos programas contra acessos indevidos.');
    expect(result.questions.every((question) => question.options.slice(1).every((option) => sourceTerms.includes(option)))).toBe(true);
  });

  it('does not pad a quiz with unrelated concepts when source definitions lack plausible distractors', () => {
    const text = [
      'Fotossíntese: processo pelo qual plantas convertem luz solar em energia química.',
      'Mitocôndria: organela celular responsável pela produção de ATP durante a respiração.',
      'Evaporação: mudança física em que um líquido passa ao estado gasoso pela temperatura.',
      'Democracia: sistema político no qual cidadãos participam da escolha dos representantes.',
    ].join('\n');
    const generated = generateStudyResources(text);
    expect(generated.flashcards).toHaveLength(4);
    expect(generated.questions).toEqual([]);
  });

  it('ignores generic section labels instead of turning them into study concepts', () => {
    const text = [
      'Capítulo 1: Este texto apresenta uma introdução geral ao tema principal.',
      'Exemplo: Este texto demonstra uma situação que não representa um conceito importante.',
      'Herança: relação que permite reutilizar características definidas em outra classe.',
    ].join('\n');
    expect(extractStudyDefinitions(text).map((item) => item.term)).toEqual(['Herança']);
    expect(generateStudyResources(text).questions).toEqual([]);
  });

  it('does not invent resources from ordinary prose without explicit definitions', () => {
    expect(generateStudyResources('Hoje estudamos exemplos importantes e fizemos vários exercícios.')).toEqual({ flashcards: [], questions: [] });
  });
});
