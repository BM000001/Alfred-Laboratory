import { useEffect, useMemo, useState } from 'react';
import type { StudyTopic } from './types';
import { parseStudyMaterial, type ParsedStudyMaterial } from './studyMaterialParser';
import { createFlashcardService } from './flashcardService';
import { createQuestionService } from './questionService';
import { studyFlashcardRepository, studyQuestionRepository, studyQuizAttemptRepository } from '../../storage/repositories';

const flashcards = createFlashcardService(studyFlashcardRepository);
const questions = createQuestionService(studyQuestionRepository, studyQuizAttemptRepository);

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ');
}

export function StudyMaterialImporter({ disciplineId, topics }: { disciplineId: string; topics: StudyTopic[] }) {
  const availableTopics = useMemo(() => topics.filter(topic => topic.disciplineId === disciplineId && topic.notes?.trim()), [topics, disciplineId]);
  const [selectedTopicId, setSelectedTopicId] = useState('');
  const [parsed, setParsed] = useState<ParsedStudyMaterial | null>(null);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [saving, setSaving] = useState(false);

  const selectedTopic = availableTopics.find(topic => topic.id === selectedTopicId);

  useEffect(() => {
    setSelectedTopicId('');
    setParsed(null);
    setError('');
    setFeedback('');
  }, [disciplineId]);

  function analyze() {
    setError('');
    setFeedback('');
    setParsed(null);
    if (!selectedTopic?.notes) {
      setError('Selecione um material salvo que contenha a resposta gerada.');
      return;
    }
    try { setParsed(parseStudyMaterial(selectedTopic.notes)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível interpretar o material.'); }
  }

  async function importMaterial() {
    if (!parsed || !selectedTopic) return;
    setSaving(true);
    setError('');
    setFeedback('');
    try {
      const [existingCards, existingQuestions] = await Promise.all([flashcards.list(), questions.list()]);
      const cardKeys = new Set(existingCards.filter(item => item.disciplineId === disciplineId).map(item => normalize(item.front) + '|' + normalize(item.back)));
      const questionKeys = new Set(existingQuestions.filter(item => item.disciplineId === disciplineId).map(item => normalize(item.prompt)));
      let cardsAdded = 0;
      let questionsAdded = 0;
      let duplicates = 0;
      for (const card of parsed.flashcards) {
        const key = normalize(card.front) + '|' + normalize(card.back);
        if (cardKeys.has(key)) { duplicates++; continue; }
        await flashcards.create({ disciplineId, ...card });
        cardKeys.add(key);
        cardsAdded++;
      }
      for (const question of parsed.questions) {
        const key = normalize(question.prompt);
        if (questionKeys.has(key)) { duplicates++; continue; }
        await questions.create({ disciplineId, topicId: selectedTopic.id, ...question });
        questionKeys.add(key);
        questionsAdded++;
      }
      setFeedback(`Importação concluída: ${cardsAdded} flashcard(s) e ${questionsAdded} questão(ões) adicionados. ${duplicates} duplicado(s) ignorado(s).`);
      setParsed(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível importar o material.');
    } finally {
      setSaving(false);
    }
  }

  return <section className="study-material-importer" aria-label="Importar material de estudo gerado">
    <div><span className="card-label">REAPROVEITAR CONTEÚDO</span><h3>Converter material salvo</h3><p>Leia um conteúdo gerado anteriormente e transforme a resposta estruturada em flashcards e questões desta disciplina.</p></div>
    {availableTopics.length === 0 ? <p className="study-material-import-empty">Nenhum conteúdo com anotações está disponível nesta disciplina. Salve primeiro uma resposta na Central de Estudos.</p> : <>
      <label htmlFor="study-material-source">Material salvo</label>
      <select id="study-material-source" value={selectedTopicId} onChange={event => { setSelectedTopicId(event.target.value); setParsed(null); setError(''); setFeedback(''); }}>
        <option value="">Selecione um conteúdo...</option>
        {availableTopics.map(topic => <option key={topic.id} value={topic.id}>{topic.title}</option>)}
      </select>
      <button type="button" className="secondary-action" disabled={!selectedTopicId} onClick={analyze}>Analisar conteúdo salvo</button>
    </>}
    {error && <p className="module-error" role="alert">{error}</p>}
    {feedback && <p className="module-feedback" role="status">{feedback}</p>}
    {parsed && <div className="study-material-import-preview">
      <strong>Prévia para conferência</strong>
      <p>{parsed.flashcards.length} flashcard(s) · {parsed.questions.length} questão(ões)</p>
      {parsed.flashcards.slice(0, 3).map((card, index) => <article key={index}><span>FLASHCARD {index + 1}</span><strong>{card.front}</strong><p>{card.back}</p></article>)}
      {parsed.questions.slice(0, 3).map((question, index) => <article key={index}><span>QUESTÃO {index + 1}</span><strong>{question.prompt}</strong><p>{question.options.length} alternativas · resposta {String.fromCharCode(65 + question.correctOptionIndex)}</p></article>)}
      {(parsed.flashcards.length + parsed.questions.length) > 6 && <small>Exibindo até 3 exemplos de cada tipo. Todos os itens válidos serão importados.</small>}
      <button type="button" className="primary-action" disabled={saving} onClick={() => void importMaterial()}>{saving ? 'Importando...' : 'Confirmar e importar'}</button>
    </div>}
  </section>;
}
