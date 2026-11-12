import type { StudyQuestionDifficulty } from './questionTypes';

export interface StudyDefinition {
  term: string;
  definition: string;
  sourceExcerpt: string;
}

const GENERIC_TERMS = new Set([
  'exemplo', 'exemplos', 'observação', 'observacoes', 'nota', 'notas', 'definição', 'definicao',
  'conceito', 'conceitos', 'capítulo', 'capitulo', 'seção', 'secao', 'unidade', 'aula',
  'figura', 'tabela', 'quadro', 'fonte', 'referência', 'referencia', 'resumo', 'questão', 'questao',
  'resposta', 'atenção', 'atencao', 'importante', 'objetivo', 'introdução', 'introducao',
].map((term) => normalize(term)));

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ');
}

function isStudyTerm(term: string): boolean {
  const normalized = normalize(term).replace(/^["'“”‘’]+|["'“”‘’]+$/g, '').replace(/\s+/g, ' ');
  const words = normalized.split(' ');
  return normalized.length >= 2 && normalized.length <= 60 && words.length <= 6 &&
    !GENERIC_TERMS.has(normalized) && !/^(?:capitulo|capítulo|secao|seção|unidade|aula)\s+\d+$/u.test(normalized) &&
    !/^\d+(?:\.\d+)*$/u.test(normalized);
}

export function extractStudyDefinitions(source: string): StudyDefinition[] {
  const definitions: StudyDefinition[] = [];
  const seen = new Set<string>();
  const lines = source
    .replace(/\[Página\s+\d+\]/gi, '')
    .replace(/\r/g, '\n')
    .split(/(?<=[.!?])\s+|\n+/u)
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
    .filter(Boolean);

  for (const line of lines) {
    // Local generation is deliberately conservative: only explicit “term: definition”
    // statements and simple “term é/são ...” sentences become study resources.
    const colon = line.match(/^([^:]{2,90}):\s*(.{20,500})$/u);
    const copula = line.match(/^(.{2,90}?)\s+(?:é|são|significa|consiste em|corresponde a)\s+(.{20,500})$/iu);
    const match = colon ?? copula;
    if (!match) continue;
    const term = match[1].trim().replace(/[.,;]+$/, '').replace(/^["'“”‘’]+|["'“”‘’]+$/g, '');
    const definition = match[2].trim();
    if (!isStudyTerm(term) || definition.split(/\s+/).length < 4) continue;
    const key = `${normalize(term)}|${normalize(definition)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    definitions.push({ term, definition, sourceExcerpt: line });
  }
  return definitions;
}

export function generateStudyResources(source: string): {
  flashcards: Array<{ front: string; back: string; subject: string }>;
  questions: Array<{ prompt: string; options: string[]; correctOptionIndex: number; explanation: string; difficulty: StudyQuestionDifficulty; subject: string }>;
} {
  const definitions = extractStudyDefinitions(source);
  const flashcards = definitions.map(({ term, definition }) => ({
    front: `O que o material define como “${term}”?`,
    back: definition,
    subject: term,
  }));
  const questions = definitions.length >= 4
    ? definitions.slice(0, 30).flatMap((entry, index) => {
      // A question's choices are explicit concepts from the same source, never
      // unrelated definition paragraphs presented as arbitrary answers.
      const terms = [...new Set(definitions.map((candidate) => candidate.term))];
      const distractors = terms.filter((term) => normalize(term) !== normalize(entry.term)).slice(0, 3);
      if (entry.definition.length > 300 || distractors.length < 3) return [];
      const options = [entry.term, ...distractors];
      // Rotate the supported answer position deterministically; no content is shuffled or invented.
      const correctOptionIndex = index % options.length;
      [options[0], options[correctOptionIndex]] = [options[correctOptionIndex], options[0]];
      return [{
        prompt: `Qual conceito é definido no material como: “${entry.definition}”?`,
        options,
        correctOptionIndex,
        explanation: `Trecho de origem: ${entry.sourceExcerpt}`,
        difficulty: 'easy' as const,
        subject: entry.term,
      }];
    })
    : [];
  return { flashcards, questions };
}
