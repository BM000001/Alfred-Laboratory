import { useEffect, useMemo, useState } from 'react';
import type { StudyTopic } from './types';
import type { StudyQuestion, StudyQuizAttempt } from './questionTypes';
import { summarizeStudyPerformance, type TopicPerformance, type QuestionPerformance } from './studyPerformance';
import { studyQuestionRepository, studyQuizAttemptRepository, studyFlashcardRepository } from '../../storage/repositories';
import { createFlashcardService } from './flashcardService';

const flashcards = createFlashcardService(studyFlashcardRepository);

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ');
}

export function StudyPerformance({ disciplineId, topics }: { disciplineId: string; topics: StudyTopic[] }) {
  const [questions, setQuestions] = useState<StudyQuestion[]>([]);
  const [attempts, setAttempts] = useState<StudyQuizAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([studyQuestionRepository.getAll(), studyQuizAttemptRepository.getAll()])
      .then(([allQuestions, allAttempts]) => {
        if (!active) return;
        setQuestions(allQuestions.filter(item => item.disciplineId === disciplineId));
        setAttempts(allAttempts.filter(item => item.disciplineId === disciplineId));
      })
      .catch(() => { if (active) setError('Não foi possível calcular o desempenho desta disciplina.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [disciplineId]);

  const performance = useMemo(
    () => summarizeStudyPerformance(topics.filter(topic => topic.disciplineId === disciplineId), questions, attempts),
    [topics, questions, attempts, disciplineId],
  );
  const totals = useMemo(() => ({
    answered: performance.reduce((sum, topic) => sum + topic.answered, 0),
    correct: performance.reduce((sum, topic) => sum + topic.correct, 0),
    incorrect: performance.reduce((sum, topic) => sum + topic.incorrect, 0),
  }), [performance]);

  async function createReviewCard(question: QuestionPerformance) {
    setError('');
    setFeedback('');
    try {
      const existing = await flashcards.list();
      const key = normalize(question.prompt);
      if (existing.some(card => card.disciplineId === disciplineId && normalize(card.front) === key)) {
        setFeedback('Este erro já possui um flashcard nesta disciplina.');
        return;
      }
      const front = question.prompt.length > 500 ? question.prompt.slice(0, 497) + '...' : question.prompt;
      const back = `Resposta correta: ${question.correctAnswer}${question.explanation ? `\n\nExplicação: ${question.explanation}` : ''}`;
      await flashcards.create({ disciplineId, front, back });
      setFeedback('Flashcard de revisão criado. Ele já está disponível na fila de memorização.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível criar o flashcard de revisão.');
    }
  }

  return <section className="study-performance" aria-label="Desempenho por tópico">
    <div><span className="card-label">ANÁLISE DE APRENDIZAGEM</span><h3>Seu desempenho por tópico</h3><p>Os resultados consideram todas as respostas registradas nos simulados desta disciplina.</p></div>
    {loading ? <p className="module-feedback">Calculando desempenho...</p> : <>
      <div className="study-performance-summary">
        <div><strong>{totals.answered}</strong><span>respostas</span></div>
        <div><strong>{totals.correct}</strong><span>acertos</span></div>
        <div><strong>{totals.incorrect}</strong><span>erros</span></div>
        <div><strong>{totals.answered ? Math.round(totals.correct / totals.answered * 100) : 0}%</strong><span>aproveitamento</span></div>
      </div>
      {performance.length === 0 ? <p className="study-performance-empty">Cadastre questões vinculadas aos tópicos e responda simulados. Alfred mostrará quais assuntos precisam de mais atenção.</p> : <div className="study-performance-list">
        {performance.map((topic: TopicPerformance) => <article className="study-performance-topic" key={topic.topicId}>
          <div className="study-performance-topic-header"><strong>{topic.title}</strong><span>{topic.answered ? `${topic.accuracy}% de acerto` : 'Ainda não praticado'}</span></div>
          <div className="progress-track"><span style={{ width: `${topic.accuracy}%` }} /></div>
          <div className="study-performance-meta"><span>{topic.questionCount} questão(ões)</span><span>{topic.correct} acerto(s) · {topic.incorrect} erro(s)</span></div>
          {topic.questions.filter(question => question.incorrect > 0).slice(0, 3).map(question => <div className="study-performance-error" key={question.questionId}>
            <div><strong>{question.prompt}</strong><span>{question.incorrect} erro(s) em {question.answered} resposta(s)</span></div>
            <button type="button" className="text-action" onClick={() => void createReviewCard(question)}>Revisar com flashcard</button>
          </div>)}
        </article>)}
      </div>}
    </>}
    {error && <p className="module-error" role="alert">{error}</p>}
    {feedback && <p className="module-feedback" role="status">{feedback}</p>}
  </section>;
}
