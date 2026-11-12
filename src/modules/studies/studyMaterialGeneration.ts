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

// Grammar and broad document words should not make unrelated definitions look
// like plausible answer choices. The local generator uses only source evidence.
const LOW_INFORMATION_WORDS = new Set((
  'a ao aos aquela aquelas aquele aqueles aquilo as ate com como da das de dela delas dele deles depois do dos e ela elas ele eles em enquanto entre era eram essa essas esse esses esta estas este estes foi foram ha isso isto ja mais mas mesmo mesma mesmos mesmas meu meus minha minhas muito muita muitos muitas na nas nem no nos nossa nossas nosso nossos o os ou para pela pelas pelo pelos por qual quando que quem se sem seu seus sua suas sobre também tem tendo ter um uma umas uns vai voce voces ' +
  'definicao conceito mecanismo processo forma tipo conjunto parte aspecto caracteristica caracteristicas exemplo exemplos material documento assunto tema texto sistema informacao informacoes elemento elementos dado dados objeto objetos classe classes'
).split(/\s+/u));

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

function informativeWords(value: string): Set<string> {
  return new Set(normalize(value)
    .replace(/[^a-z0-9\s]/gu, ' ')
    .split(/\s+/u)
    .map((word) => word.replace(/s$/u, ''))
    .filter((word) => word.length >= 4 && !LOW_INFORMATION_WORDS.has(word) && !/^\d+$/u.test(word)));
}

function relatedness(left: StudyDefinition, right: StudyDefinition): number {
  const leftWords = informativeWords(left.definition);
  const rightWords = informativeWords(right.definition);
  let shared = 0;
  for (const word of leftWords) if (rightWords.has(word)) shared++;
  return shared;
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
      if (entry.definition.length > 300) return [];
      // Require at least two shared, informative words per distractor. A single
      // common word is too weak to claim that an alternative is plausible.
      const relatedDistractors = definitions
        .filter((candidate) => normalize(candidate.term) !== normalize(entry.term))
        .map((candidate, sourceOrder) => ({ candidate, sourceOrder, score: relatedness(entry, candidate) }))
        .filter(({ score }) => score >= 2)
        .sort((left, right) => right.score - left.score || left.sourceOrder - right.sourceOrder)
        .slice(0, 3)
        .map(({ candidate }) => candidate.term);
      if (new Set(relatedDistractors.map(normalize)).size < 3) return [];
      const options = [entry.term, ...relatedDistractors];
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
