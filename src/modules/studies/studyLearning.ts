import { isConcreteConcept } from './studyMaterialGeneration';
import type { StudyFlashcard } from './flashcardTypes';
import type { StudyQuestion, StudyQuizAttempt } from './questionTypes';
import type { StudyTopic } from './types';
import type { StudyLearningContext, StudyLearningProgress, StudyLearningUnit } from './learningTypes';

type LessonInput = {
  cards: StudyFlashcard[];
  questions: StudyQuestion[];
  attempts: StudyQuizAttempt[];
  topics: StudyTopic[];
  progress: StudyLearningProgress[];
  context: StudyLearningContext;
  now?: Date;
};

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ');
}

function analogyFor(concept: string, context: StudyLearningContext): string | undefined {
  const key = normalize(concept);
  const specific: Partial<Record<StudyLearningContext, string>> = {};
  if (/^encapsulamento$/iu.test(key)) {
    specific.football = `Pense no vestiário de um time: o público acompanha o jogo, mas só pessoas autorizadas entram e alteram o que acontece lá dentro. A ideia é proteger o funcionamento interno e oferecer apenas o acesso necessário.`;
    specific.games = `Pense no inventário de um jogo: o jogador usa os comandos permitidos, mas não altera diretamente as regras internas que calculam os itens. A interface protege o funcionamento por trás dela.`;
  } else if (/^heranca$/iu.test(key)) {
    specific.football = `Pense nas categorias de base de um clube: uma equipe mais nova reaproveita fundamentos e regras do clube, mas pode acrescentar características próprias. O que já existe serve de base para uma nova estrutura.`;
    specific.games = `Pense em uma classe de personagem que herda habilidades de uma classe base e acrescenta uma habilidade própria. Você reutiliza uma base comprovada sem copiar tudo manualmente.`;
  } else if (/^polimorfismo$/iu.test(key)) {
    specific.football = `Pense no mesmo passe sendo executado por jogadores diferentes: a ação é reconhecida como passe, mas cada jogador pode realizá-la com uma técnica própria. A operação permanece, a forma de responder muda.`;
    specific.games = `Pense em um comando “atacar” usado por personagens diferentes: o mago lança magia, o arqueiro dispara e o guerreiro golpeia. O comando é o mesmo, mas o comportamento depende do personagem.`;
  }
  return specific[context];
}

function referenceLesson(concept: string, excerpt: string | undefined) {
  if (!excerpt || !/referen|objeto/u.test(normalize(concept))) return;
  const evidence = normalize(excerpt);
  if (!/mesmo objeto/.test(evidence) || !/referen|apont/.test(evidence) ||
      !/alter|modific|mutac/.test(evidence) || !/ambas|outra|compartilhad/.test(evidence) || /\bnao\b/.test(evidence)) return;
  return {
    mechanism: 'Duas variáveis podem apontar para um único objeto. Se você altera um atributo desse objeto, ambas continuam apontando para ele e podem observar o novo valor.',
    example: /\bpython\b/u.test(evidence)
      ? 'p1 = {"vida": 30}\np2 = p1\np1["vida"] = 27\n# p2["vida"] agora vale 27'
      : 'Antes: p1 → objeto com vida 30 ← p2\nOperação: altere a vida do objeto para 27 por p1.\nDepois: p1 → o mesmo objeto com vida 27 ← p2',
    application: 'Ao depurar uma alteração inesperada, confira se as duas variáveis indicam o mesmo objeto.',
    pitfall: 'Trocar qual objeto uma variável referencia é uma operação diferente de modificar o objeto compartilhado.',
    check: 'Se p2 continuar apontando para o mesmo objeto, qual é a vida observada depois da alteração?',
    answer: '27. O atributo mudou no objeto que as duas variáveis compartilham.',
  };
}

function weakestTopics(topics: StudyTopic[], questions: StudyQuestion[], attempts: StudyQuizAttempt[]): Set<string> {
  const stats = new Map<string, { answered: number; incorrect: number }>();
  const questionTopics = new Map(questions.filter((question) => question.topicId).map((question) => [question.id, question.topicId!]));
  for (const attempt of attempts) for (const answer of attempt.answers) {
    const topicId = questionTopics.get(answer.questionId) ?? answer.questionSnapshot?.topicId;
    if (!topicId) continue;
    const current = stats.get(topicId) ?? { answered: 0, incorrect: 0 };
    current.answered++;
    if (!answer.isCorrect) current.incorrect++;
    stats.set(topicId, current);
  }
  return new Set(topics.filter((topic) => {
    const stat = stats.get(topic.id);
    return Boolean(stat && stat.answered > 0 && stat.incorrect / stat.answered >= 0.5);
  }).map((topic) => topic.id));
}

export function buildStudyLearningUnits({ cards, questions, attempts, topics, progress, context, now = new Date() }: LessonInput): StudyLearningUnit[] {
  const sourceKey = (item: StudyFlashcard | StudyQuestion) =>
    JSON.stringify([item.disciplineId, item.topicId, item.sourceFileId, normalize(item.subject ?? '')]);
  const questionBySubject = new Map(questions.filter(question => question.subject && question.sourceFileId)
    .map(question => [sourceKey(question), question]));
  const topicById = new Map(topics.map((topic) => [topic.id, topic]));
  const weak = weakestTopics(topics, questions, attempts);
  const completed = new Map(progress.map((item) => [item.lessonId, item]));
  const due = new Set(cards.filter((card) => new Date(card.nextReviewAt).getTime() <= now.getTime()).map((card) => card.id));
  const seen = new Set<string>();

  return cards
    .filter((card) => {
      const key = JSON.stringify([card.disciplineId, card.topicId, normalize(card.subject ?? card.front)]);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((card): StudyLearningUnit => {
      const question = card.sourceFileId ? questionBySubject.get(sourceKey(card)) : undefined;
      const sourceExcerpt = card.sourceExcerpt ?? question?.sourceExcerpt;
      const concept = card.subject ?? card.front;
      const didactic = referenceLesson(concept, sourceExcerpt);
      const analogy = isConcreteConcept(concept) ? analogyFor(concept, context) : undefined;
      const topic = card.topicId ? topicById.get(card.topicId) : undefined;
      const reason: StudyLearningUnit['reviewReason'] = topic && weak.has(topic.id) ? 'weak-topic' : due.has(card.id) ? 'due-review' : 'new';
      return {
        id: `lesson:${card.id}`,
        disciplineId: card.disciplineId,
        ...(card.topicId ? { topicId: card.topicId } : {}),
        ...(topic ? { topicTitle: topic.title } : {}),
        ...(card.sourceFileName ? { sourceFileName: card.sourceFileName } : {}),
        concept,
        formalExplanation: card.back,
        sourceExcerpt,
        didactic,
        analogy,
        needsReview: Boolean(card.subject && !isConcreteConcept(card.subject)),
        reviewReason: reason,
        completed: Boolean(completed.get(`lesson:${card.id}`)),
      };
    })
    .sort((left, right) => Number(right.reviewReason === 'weak-topic') - Number(left.reviewReason === 'weak-topic') || Number(right.reviewReason === 'due-review') - Number(left.reviewReason === 'due-review') || Number(left.completed) - Number(right.completed) || left.concept.localeCompare(right.concept, 'pt-BR'));
}

export function createLearningProgress(disciplineId: string, lessonId: string, context: StudyLearningContext, now = new Date()): StudyLearningProgress {
  return { id: `${disciplineId}:${lessonId}`, disciplineId, lessonId, completedAt: now.toISOString(), context };
}
