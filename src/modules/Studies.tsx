import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { Discipline, StudyTopic } from './studies/types';
import { StudyFlashcards } from './studies/StudyFlashcards';
import { QuestionBank } from './studies/QuestionBank';
import { StudyMaterialImporter } from './studies/StudyMaterialImporter';
import { StudyPerformance } from './studies/StudyPerformance';
import { createStudyService } from './studies/studyService';
import { summarizeStudyProgress } from './studies/studyRules';
import { disciplineRepository, studyFlashcardRepository, studyQuestionRepository, studyQuizAttemptRepository, studyTopicRepository } from '../storage/repositories';

const studies = createStudyService(disciplineRepository, studyTopicRepository);

export function Studies() {
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [topics, setTopics] = useState<StudyTopic[]>([]);
  const [disciplineName, setDisciplineName] = useState('');
  const [disciplineDescription, setDisciplineDescription] = useState('');
  const [topicTitle, setTopicTitle] = useState('');
  const [topicNotes, setTopicNotes] = useState('');
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [editingDisciplineId, setEditingDisciplineId] = useState<string | null>(null);
  const [selectedDiscipline, setSelectedDiscipline] = useState('');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function refresh() {
    const [loadedDisciplines, loadedTopics] = await Promise.all([studies.listDisciplines(), studies.listTopics()]);
    setDisciplines(loadedDisciplines.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')));
    setTopics(loadedTopics);
    setSelectedDiscipline((current) => current || loadedDisciplines[0]?.id || '');
  }

  useEffect(() => {
    let active = true;
    Promise.all([studies.listDisciplines(), studies.listTopics()])
      .then(([loadedDisciplines, loadedTopics]) => {
        if (!active) return;
        setDisciplines(loadedDisciplines.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')));
        setTopics(loadedTopics);
        setSelectedDiscipline(loadedDisciplines[0]?.id ?? '');
      })
      .catch(() => { if (active) setError('Não foi possível carregar seus dados de estudo.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const progress = useMemo(() => summarizeStudyProgress(topics), [topics]);
  const visibleTopics = topics.filter((topic) =>
    (filter === 'all' || topic.status === filter) && (!selectedDiscipline || topic.disciplineId === selectedDiscipline),
  );

  async function createDiscipline(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    try {
      if (editingDisciplineId) {
        await studies.updateDiscipline(editingDisciplineId, { name: disciplineName, description: disciplineDescription });
        setSelectedDiscipline(editingDisciplineId);
      } else {
        const created = await studies.createDiscipline({ name: disciplineName, ...(disciplineDescription.trim() ? { description: disciplineDescription } : {}) });
        setSelectedDiscipline(created.id);
      }
      setDisciplineName(''); setDisciplineDescription(''); setEditingDisciplineId(null); await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível salvar a disciplina.'); }
  }

  function editDiscipline(discipline: Discipline) {
    setEditingDisciplineId(discipline.id); setDisciplineName(discipline.name); setDisciplineDescription(discipline.description ?? '');
  }

  function cancelDisciplineEdit() {
    setEditingDisciplineId(null); setDisciplineName(''); setDisciplineDescription('');
  }

  async function createTopic(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    try {
      const input = { title: topicTitle, notes: topicNotes };
      if (editingTopicId) await studies.updateTopic(editingTopicId, input);
      else await studies.createTopic({ disciplineId: selectedDiscipline, ...input });
      setTopicTitle(''); setTopicNotes(''); setEditingTopicId(null); await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível salvar o conteúdo.'); }
  }

  function editTopic(topic: StudyTopic) {
    setEditingTopicId(topic.id); setTopicTitle(topic.title); setTopicNotes(topic.notes ?? '');
  }

  async function toggleTopic(topic: StudyTopic) {
    setError('');
    try { await studies.updateTopic(topic.id, { status: topic.status === 'completed' ? 'pending' : 'completed' }); await refresh(); }
    catch { setError('Não foi possível atualizar o conteúdo.'); }
  }

  async function deleteTopic(topic: StudyTopic) {
    if (!window.confirm(`Excluir "${topic.title}"?`)) return;
    try { await studies.deleteTopic(topic.id); await refresh(); }
    catch { setError('Não foi possível excluir o conteúdo.'); }
  }

  async function deleteDiscipline(discipline: Discipline) {
    if (!window.confirm(`Excluir "${discipline.name}" e todos os conteúdos vinculados? Essa ação não pode ser desfeita.`)) return;
    try {
      const [cards, questions, attempts] = await Promise.all([studyFlashcardRepository.getAll(), studyQuestionRepository.getAll(), studyQuizAttemptRepository.getAll()]);
      await Promise.all(cards.filter((item) => item.disciplineId === discipline.id).map((item) => studyFlashcardRepository.delete(item.id)));
      await Promise.all(questions.filter((item) => item.disciplineId === discipline.id).map((item) => studyQuestionRepository.delete(item.id)));
      await Promise.all(attempts.filter((item) => item.disciplineId === discipline.id).map((item) => studyQuizAttemptRepository.delete(item.id)));
      await studies.deleteDiscipline(discipline.id); await refresh();
    }
    catch { setError('Não foi possível excluir a disciplina.'); }
  }

  if (loading) return <p className="module-feedback">Carregando seus estudos...</p>;

  return <section className="studies-module">
    {error && <p className="module-error" role="alert">{error}</p>}
    <section className="study-progress">
      <div><span className="card-label">SEU PROGRESSO</span><strong>{progress.percentage}%</strong><p>{progress.completed} de {progress.total} conteúdos concluídos · {progress.pending} pendentes</p></div>
      <div className="progress-track" role="progressbar" aria-label="Progresso geral dos estudos" aria-valuenow={progress.percentage} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${progress.percentage}%` }} /></div>
    </section>

    <form className="entry-panel study-form" onSubmit={createDiscipline}>
      <span className="card-label">ORGANIZE SUA ROTINA</span><h2>{editingDisciplineId ? "Editar disciplina" : "Adicionar disciplina"}</h2>
      <label className="field-label" htmlFor="discipline-name">Nome</label>
      <input id="discipline-name" value={disciplineName} onChange={(event) => setDisciplineName(event.target.value)} maxLength={80} placeholder="Ex.: Estrutura de Dados" required />
      <label className="field-label" htmlFor="discipline-description">Descrição <span className="optional-label">· opcional</span></label>
      <textarea id="discipline-description" value={disciplineDescription} onChange={(event) => setDisciplineDescription(event.target.value)} rows={2} placeholder="Professor, objetivo ou observações" />
      <button className="primary-action" type="submit">{editingDisciplineId ? "Salvar disciplina" : "Criar disciplina"}</button>{editingDisciplineId && <button className="text-action" type="button" onClick={cancelDisciplineEdit}>Cancelar edição</button>}
    </form>

    {disciplines.length === 0 ? <div className="empty-state"><strong>Seu espaço de estudos começa aqui.</strong><p>Cadastre uma disciplina para organizar os conteúdos e acompanhar sua evolução.</p></div> : <>
      <div className="study-layout">
        <aside className="discipline-list" aria-label="Disciplinas">
          <div className="list-heading"><div><span className="card-label">MATÉRIAS</span><h2>Disciplinas</h2></div></div>
          {disciplines.map((discipline) => {
            const summary = summarizeStudyProgress(topics.filter((topic) => topic.disciplineId === discipline.id));
            return <button type="button" key={discipline.id} className={selectedDiscipline === discipline.id ? 'discipline-option selected' : 'discipline-option'} onClick={() => setSelectedDiscipline(discipline.id)}>
              <strong>{discipline.name}</strong><span>{summary.completed}/{summary.total} conteúdos · {summary.percentage}%</span>
            </button>;
          })}
        </aside>
        <div className="study-content">
          <div className="list-heading study-content-heading"><div><span className="card-label">CONTEÚDOS</span><h2>{disciplines.find((item) => item.id === selectedDiscipline)?.name}</h2></div><div><button className="text-action" type="button" onClick={() => { const item = disciplines.find((entry) => entry.id === selectedDiscipline); if (item) editDiscipline(item); }}>Editar disciplina</button><button className="text-action" type="button" onClick={() => { const item = disciplines.find((entry) => entry.id === selectedDiscipline); if (item) void deleteDiscipline(item); }}>Excluir disciplina</button></div></div>
          <form className="entry-panel topic-form" onSubmit={createTopic}>
            <label className="field-label" htmlFor="topic-title">{editingTopicId ? "Editar conteúdo ou tópico" : "Novo conteúdo ou tópico"}</label>
            <input id="topic-title" value={topicTitle} onChange={(event) => setTopicTitle(event.target.value)} maxLength={120} placeholder="Ex.: Listas encadeadas" required />
            <label className="field-label" htmlFor="topic-notes">Anotações <span className="optional-label">· opcional</span></label>
            <textarea id="topic-notes" value={topicNotes} onChange={(event) => setTopicNotes(event.target.value)} rows={2} placeholder="O que revisar ou praticar?" />
            <button className="primary-action" type="submit">{editingTopicId ? "Salvar alterações" : "Adicionar conteúdo"}</button>{editingTopicId && <button className="text-action" type="button" onClick={() => { setEditingTopicId(null); setTopicTitle(""); setTopicNotes(""); }}>Cancelar edição</button>}
          </form>
          <div className="study-filter"><label className="field-label" htmlFor="topic-filter">Exibir</label><select id="topic-filter" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">Todos</option><option value="pending">Pendentes</option><option value="completed">Concluídos</option></select></div>
          {visibleTopics.length === 0 ? <div className="empty-state"><strong>Nenhum conteúdo nesta lista.</strong><p>Adicione um tópico ou altere o filtro para visualizar seus estudos.</p></div> : <div className="study-topic-list">{visibleTopics.map((topic) => <article className={topic.status === 'completed' ? 'study-topic completed' : 'study-topic'} key={topic.id}>
            <input type="checkbox" aria-label={`Marcar ${topic.title} como concluído`} checked={topic.status === 'completed'} onChange={() => void toggleTopic(topic)} />
            <div><strong>{topic.title}</strong>{topic.notes && <p>{topic.notes}</p>}</div>
            <div><button className="text-action" type="button" onClick={() => editTopic(topic)}>Editar</button><button className="text-action" type="button" onClick={() => void deleteTopic(topic)}>Excluir</button></div>
          </article>)}</div>}
          <StudyFlashcards disciplineId={selectedDiscipline} />
          <QuestionBank disciplineId={selectedDiscipline} topics={topics.filter((topic) => topic.disciplineId === selectedDiscipline)} />
          <StudyMaterialImporter disciplineId={selectedDiscipline} topics={topics} />
          <StudyPerformance disciplineId={selectedDiscipline} topics={topics} />
        </div>
      </div>
    </>}
  </section>;
}
