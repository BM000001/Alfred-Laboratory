import type { AssistantIntent, IntentClassification } from './intentTypes';

const rules: Array<{ intent: Exclude<AssistantIntent, 'unknown'>; terms: string[] }> = [
  { intent: 'memory', terms: ['memoria', 'memorias', 'lembra', 'lembranca', 'recorda'] },
  { intent: 'studies', terms: ['estudo', 'estudos', 'materia', 'disciplina', 'topico', 'revisao', 'progresso academico'] },
  { intent: 'agenda', terms: ['agenda', 'compromisso', 'compromissos', 'evento', 'eventos', 'reuniao', 'reunioes', 'consulta', 'consultas', 'calendario', 'calendarios', 'horario', 'horarios'] },
  { intent: 'tasks', terms: ['tarefa', 'tarefas', 'pendencia', 'pendente', 'afazer', 'prioridade', 'entrega', 'prazo'] },
];

export function normalizeIntentText(value: string): string {
  return value.toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchesTerm(normalized: string, words: ReadonlySet<string>, term: string): boolean {
  // Single words must match a complete token; multi-word terms match a phrase.
  return term.includes(' ')
    ? (' ' + normalized + ' ').includes(' ' + term + ' ')
    : words.has(term);
}

export function classifyIntent(message: string): IntentClassification {
  const clauses = message.split(/[.!?]+/).map(normalizeIntentText).filter(Boolean);
  const matchesByIntent = new Map<Exclude<AssistantIntent, 'unknown'>, Set<string>>();

  for (const normalized of clauses) {
    const words = new Set(normalized.split(' ').filter(Boolean));
    const asksAboutMemory = /\b(memoria|memorias|lembra|lembranca|recorda)\b/.test(normalized) &&
      /\bsobre\b/.test(normalized);

    for (const rule of rules) {
      if (asksAboutMemory && rule.intent !== 'memory') continue;
      const matchedTerms = rule.terms.filter((term) => matchesTerm(normalized, words, term));
      if (matchedTerms.length === 0) continue;
      const current = matchesByIntent.get(rule.intent) ?? new Set<string>();
      matchedTerms.forEach((term) => current.add(term));
      matchesByIntent.set(rule.intent, current);
    }
  }

  const matches = [...matchesByIntent.entries()]
    .map(([intent, matchedTerms]) => ({ intent, matchedTerms: [...matchedTerms] }));

  if (matches.length === 0) return { intent: 'unknown', confidence: 'low', matchedTerms: [] };

  // Preserve deterministic precedence, but surface ambiguity instead of claiming certainty.
  const selected = matches[0];
  return {
    intent: selected.intent,
    confidence: matches.length === 1 ? 'high' : 'low',
    matchedTerms: selected.matchedTerms,
  };
}
