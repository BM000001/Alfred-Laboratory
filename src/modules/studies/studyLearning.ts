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

function contextName(context: StudyLearningContext): string {
  return ({ technical: 'um sistema', football: 'um time de futebol', sports: 'um treino esportivo', series: 'uma série', games: 'um jogo', daily: 'uma situação do cotidiano' })[context];
}

function analogyFor(concept: string, formalExplanation: string, context: StudyLearningContext): string {
  const key = normalize(concept);
  const specific: Partial<Record<StudyLearningContext, string>> = {};
  if (/encapsul|privad|acesso|proteg/iu.test(key + ' ' + formalExplanation)) {
    specific.football = `Pense no vestiário de um time: o público acompanha o jogo, mas só pessoas autorizadas entram e alteram o que acontece lá dentro. A ideia é proteger o funcionamento interno e oferecer apenas o acesso necessário.`;
    specific.games = `Pense no inventário de um jogo: o jogador usa os comandos permitidos, mas não altera diretamente as regras internas que calculam os itens. A interface protege o funcionamento por trás dela.`;
  } else if (/heran|base|reutil|categoria/iu.test(key + ' ' + formalExplanation)) {
    specific.football = `Pense nas categorias de base de um clube: uma equipe mais nova reaproveita fundamentos e regras do clube, mas pode acrescentar características próprias. O que já existe serve de base para uma nova estrutura.`;
    specific.games = `Pense em uma classe de personagem que herda habilidades de uma classe base e acrescenta uma habilidade própria. Você reutiliza uma base comprovada sem copiar tudo manualmente.`;
  } else if (/polimorf|forma|comport|mesma opera/iu.test(key + ' ' + formalExplanation)) {
    specific.football = `Pense no mesmo passe sendo executado por jogadores diferentes: a ação é reconhecida como passe, mas cada jogador pode realizá-la com uma técnica própria. A operação permanece, a forma de responder muda.`;
    specific.games = `Pense em um comando “atacar” usado por personagens diferentes: o mago lança magia, o arqueiro dispara e o guerreiro golpeia. O comando é o mesmo, mas o comportamento depende do personagem.`;
  }
  const tailored = specific[context];
  if (tailored) return tailored;
  const label = contextName(context);
  return `Imagine ${label} com uma regra chamada “${concept}”. Primeiro observe o papel descrito no material: ${formalExplanation} Depois, compare essa regra com o exemplo: a analogia ajuda a visualizar, mas a definição formal continua sendo a referência para responder às questões.`;
}

function bridgeFor(concept: string, formalExplanation: string, context: StudyLearningContext): string {
  return `A analogia de ${contextName(context)} serve para visualizar “${concept}”. Na prova, volte ao núcleo formal: ${formalExplanation}`;
}

function sourceExcerptFor(question: StudyQuestion | undefined, card: StudyFlashcard): string | undefined {
  if (question?.explanation?.startsWith('Trecho de origem:')) return question.explanation.slice('Trecho de origem:'.length).trim();
  return card.back;
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
  const questionBySubject = new Map(questions.filter((question) => question.subject).map((question) => [normalize(question.subject!), question]));
  const topicById = new Map(topics.map((topic) => [topic.id, topic]));
  const weak = weakestTopics(topics, questions, attempts);
  const completed = new Map(progress.map((item) => [item.lessonId, item]));
  const due = new Set(cards.filter((card) => new Date(card.nextReviewAt).getTime() <= now.getTime()).map((card) => card.id));
  const seen = new Set<string>();

  return cards
    .filter((card) => {
      const key = `${normalize(card.disciplineId)}|${normalize(card.subject ?? card.front)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((card): StudyLearningUnit => {
      const question = questionBySubject.get(normalize(card.subject ?? ''));
      const topic = card.topicId ? topicById.get(card.topicId) : undefined;
      const reason: StudyLearningUnit['reviewReason'] = topic && weak.has(topic.id) ? 'weak-topic' : due.has(card.id) ? 'due-review' : 'new';
      return {
        id: `lesson:${card.id}`,
        disciplineId: card.disciplineId,
        ...(card.topicId ? { topicId: card.topicId } : {}),
        ...(topic ? { topicTitle: topic.title } : {}),
        ...(card.sourceFileName ? { sourceFileName: card.sourceFileName } : {}),
        concept: card.subject ?? (card.front.replace(/^O que o material define como “|”\?$/giu, '').trim() || card.front),
        formalExplanation: card.back,
        ...(sourceExcerptFor(question, card) ? { sourceExcerpt: sourceExcerptFor(question, card) } : {}),
        analogy: analogyFor(card.subject ?? card.front, card.back, context),
        bridge: bridgeFor(card.subject ?? card.front, card.back, context),
        reviewReason: reason,
        completed: Boolean(completed.get(`lesson:${card.id}`)),
      };
    })
    .sort((left, right) => Number(right.reviewReason === 'weak-topic') - Number(left.reviewReason === 'weak-topic') || Number(right.reviewReason === 'due-review') - Number(left.reviewReason === 'due-review') || Number(left.completed) - Number(right.completed) || left.concept.localeCompare(right.concept, 'pt-BR'));
}

export function createLearningProgress(disciplineId: string, lessonId: string, context: StudyLearningContext, now = new Date()): StudyLearningProgress {
  return { id: `${disciplineId}:${lessonId}`, disciplineId, lessonId, completedAt: now.toISOString(), context };
}
