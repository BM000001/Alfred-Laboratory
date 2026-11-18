import { Files } from './Files';
import { Notes } from './Notes';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { Discipline, StudyTopic } from './studies/types';
import { StudyLearning } from './studies/StudyLearning';
import { StudyFlashcards } from './studies/StudyFlashcards';
import { QuestionBank } from './studies/QuestionBank';
import { StudyMaterialImporter } from './studies/StudyMaterialImporter';
import { StudyPerformance } from './studies/StudyPerformance';
import { createStudyService } from './studies/studyService';
import { summarizeStudyProgress } from './studies/studyRules';
import { disciplineRepository, studyFlashcardRepository, studyQuestionRepository, studyQuizAttemptRepository, studyTopicRepository } from '../storage/repositories';

const studies = createStudyService(disciplineRepository, studyTopicRepository);

const studyViews = [
  ['conteudos', 'Unidades'], ['materiais', 'Materiais'], ['aprender', 'Revisar'], ['praticar', 'Praticar'], ['notas', 'Anotações'],
] as const;

const practiceViews = [
  ['questions', 'Simulados'], ['cards', 'Revisar flashcards'], ['performance', 'Desempenho'],
] as const;

export function Studies({ initialUnit }: { initialUnit?: { disciplineId: string; unitId: string } } = {}) {
  const [studyView, setStudyView] = useState(initialUnit ? 'materiais' : 'conteudos');
  const [practiceView, setPracticeView] = useState<typeof practiceViews[number][0]>('questions');
  const [showDisciplineForm, setShowDisciplineForm] = useState(false);
  const [showTopicForm, setShowTopicForm] = useState(false);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [topics, setTopics] = useState<StudyTopic[]>([]);
  const [disciplineName, setDisciplineName] = useState('');
  const [disciplineDescription, setDisciplineDescription] = useState('');
  const [topicTitle, setTopicTitle] = useState('');
  const [topicNotes, setTopicNotes] = useState('');
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [editingDisciplineId, setEditingDisciplineId] = useState<string | null>(null);
  const [selectedDiscipline, setSelectedDiscipline] = useState('');
  const [unitId, setUnitId] = useState(initialUnit?.unitId ?? '');
  const initialDisciplineId = initialUnit?.disciplineId;
  const [practiceVersion, setPracticeVersion] = useState(0);
  const [cardVersion, setCardVersion] = useState(0);
  const [studyRefreshVersion, setStudyRefreshVersion] = useState(0);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const disciplineNameField = useRef<HTMLInputElement>(null);
  const topicTitleField = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showDisciplineForm) disciplineNameField.current?.focus();
  }, [showDisciplineForm, editingDisciplineId]);

  useEffect(() => {
    if (showTopicForm) topicTitleField.current?.focus();
  }, [showTopicForm, editingTopicId]);

  async function refresh() {
    const [loadedDisciplines, loadedTopics] = await Promise.all([studies.listDisciplines(), studies.listTopics()]);
    setDisciplines(loadedDisciplines.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')));
    setTopics(loadedTopics);
    setSelectedDiscipline((current) => loadedDisciplines.find((item) => item.id === current)?.id || loadedDisciplines[0]?.id || '');
  }

  async function refreshAfterMaterialImport() {
    await refresh();
    setStudyRefreshVersion((version) => version + 1);
  }

  useEffect(() => {
    let active = true;
    Promise.all([studies.listDisciplines(), studies.listTopics()])
      .then(([loadedDisciplines, loadedTopics]) => {
        if (!active) return;
        setDisciplines(loadedDisciplines.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')));
        setTopics(loadedTopics);
        setSelectedDiscipline(loadedDisciplines.find(({ id }) => id === initialDisciplineId)?.id ?? loadedDisciplines[0]?.id ?? '');
      })
      .catch(() => { if (active) setError('Não foi possível carregar seus dados de estudo.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [initialDisciplineId]);

  const disciplineTopics = topics.filter((topic) => topic.disciplineId === selectedDiscipline);
  const discipline = disciplines.find((item) => item.id === selectedDiscipline);
  const unit = disciplineTopics.find((topic) => topic.id === unitId);
  function openUnit(id: string, view = studyView) {
    if (!window.dispatchEvent(new Event('alfred-before-navigate', { cancelable: true }))) return;
    setUnitId(id);
    setStudyView(view);
  }

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
        setSelectedDiscipline(created.id); setUnitId('');
      }
      setDisciplineName(''); setDisciplineDescription(''); setEditingDisciplineId(null); setShowDisciplineForm(false); await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível salvar a disciplina.'); }
  }

  function editDiscipline(discipline: Discipline) {
    setShowDisciplineForm(true); setEditingDisciplineId(discipline.id); setDisciplineName(discipline.name); setDisciplineDescription(discipline.description ?? '');
  }

  function cancelDisciplineEdit() {
    setShowDisciplineForm(false); setEditingDisciplineId(null); setDisciplineName(''); setDisciplineDescription('');
  }

  async function createTopic(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    try {
      const input = { title: topicTitle, notes: topicNotes };
      if (editingTopicId) await studies.updateTopic(editingTopicId, input);
      else await studies.createTopic({ disciplineId: selectedDiscipline, ...input });
      setTopicTitle(''); setTopicNotes(''); setEditingTopicId(null); setShowTopicForm(false); await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível salvar o conteúdo.'); }
  }

  function editTopic(topic: StudyTopic) {
    setShowTopicForm(true); setEditingTopicId(topic.id); setTopicTitle(topic.title); setTopicNotes(topic.notes ?? '');
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
    <section className="study-index-heading" aria-labelledby="disciplines-title">
      <div className="section-heading">
        <h2 id="disciplines-title">Disciplinas</h2>
        {disciplines.length > 0 && <button className="secondary-action" type="button" aria-expanded={showDisciplineForm}
          onClick={() => showDisciplineForm ? cancelDisciplineEdit() : setShowDisciplineForm(true)}>Nova disciplina</button>}
      </div>
      {progress.total > 0 && <div className="study-overall">
        <progress aria-label="Progresso geral dos estudos" value={progress.completed} max={progress.total} />
        <span>{progress.completed} de {progress.total} unidades concluídas</span>
      </div>}
    </section>

    {(!disciplines.length || showDisciplineForm) && <form className="entry-panel study-form" onSubmit={createDiscipline}>
      <span className="card-label">ORGANIZE SUA ROTINA</span><h2>{editingDisciplineId ? "Editar disciplina" : "Adicionar disciplina"}</h2>
      <label className="field-label" htmlFor="discipline-name">Nome</label>
      <input ref={disciplineNameField} id="discipline-name" value={disciplineName} onChange={(event) => setDisciplineName(event.target.value)} maxLength={80} placeholder="Ex.: Estrutura de Dados" required />
      <label className="field-label" htmlFor="discipline-description">Descrição <span className="optional-label">· opcional</span></label>
      <textarea id="discipline-description" value={disciplineDescription} onChange={(event) => setDisciplineDescription(event.target.value)} rows={2} placeholder="Professor, objetivo ou observações" />
      <button className="primary-action" type="submit">{editingDisciplineId ? "Salvar disciplina" : "Criar disciplina"}</button>{editingDisciplineId && <button className="text-action" type="button" onClick={cancelDisciplineEdit}>Cancelar edição</button>}
    </form>}

    {disciplines.length === 0 ? <div className="empty-state"><strong>Seu espaço de estudos começa aqui.</strong><p>Cadastre uma disciplina para organizar os conteúdos e acompanhar sua evolução.</p></div> : <>
      <div className="study-layout">
        <aside className="discipline-list" aria-label="Disciplinas">
          {disciplines.map((discipline) => {
            const summary = summarizeStudyProgress(topics.filter((topic) => topic.disciplineId === discipline.id));
            return <button type="button" key={discipline.id} className={selectedDiscipline === discipline.id ? 'discipline-option selected' : 'discipline-option'} aria-pressed={selectedDiscipline === discipline.id} onClick={() => { if (window.dispatchEvent(new Event('alfred-before-navigate', { cancelable: true }))) { setSelectedDiscipline(discipline.id); setUnitId(''); setStudyView('conteudos'); setPracticeView('questions'); setShowTopicForm(false); setEditingTopicId(null); setTopicTitle(''); setTopicNotes(''); } }}>
              <strong>{discipline.name}</strong>
              <span>{summary.total ? `${summary.completed}/${summary.total} unidades concluídas` : 'Sem unidades'}</span>
              {summary.total > 0 && <progress aria-hidden="true" value={summary.completed} max={summary.total} />}
            </button>;
          })}
        </aside>
        <div className="study-content">
          <header className="study-content-heading">
            <div><h2>{discipline?.name}</h2>{discipline?.description && <p>{discipline.description}</p>}</div>
            <details className="interface-disclosure study-management"><summary>Gerenciar disciplina</summary>
              <button className="text-action" type="button" onClick={() => { if (discipline) editDiscipline(discipline); }}>Editar disciplina</button>
              <button className="danger-action" type="button" onClick={() => { if (discipline) void deleteDiscipline(discipline); }}>Excluir disciplina</button>
            </details>
          </header>
          <nav className="view-switcher" aria-label="Conteúdo da disciplina">{studyViews.map(([key, label]) =>
            <button type="button" key={key} aria-current={studyView === key ? 'page' : undefined} onClick={() => openUnit(unitId, key)}>{label}</button>
          )}</nav>
          {(studyView === 'materiais' || studyView === 'praticar' || studyView === 'aprender') && <div className="study-filter">
            <label className="field-label" htmlFor="study-unit">Unidade de estudo</label>
            <select id="study-unit" value={unit?.id ?? ''} onChange={(event) => openUnit(event.target.value)}>
              <option value="">Toda a disciplina</option>
              {disciplineTopics.map((topic) => <option key={topic.id} value={topic.id}>{topic.title}</option>)}
            </select>
          </div>}
          {studyView === 'conteudos' && <>
          <div className="section-heading study-unit-heading">
            <h3>Unidades de estudo</h3>
            {disciplineTopics.length > 0 && <button type="button" className="secondary-action" aria-expanded={showTopicForm} onClick={() => {
              setShowTopicForm(!showTopicForm); setEditingTopicId(null); setTopicTitle(''); setTopicNotes('');
            }}>Nova unidade</button>}
          </div>
          {(disciplineTopics.length === 0 || showTopicForm) && <form className="entry-panel topic-form" onSubmit={createTopic}>
            <label className="field-label" htmlFor="topic-title">{editingTopicId ? "Editar conteúdo ou tópico" : "Novo conteúdo ou tópico"}</label>
            <input ref={topicTitleField} id="topic-title" value={topicTitle} onChange={(event) => setTopicTitle(event.target.value)} maxLength={120} placeholder="Ex.: Listas encadeadas" required />
            <label className="field-label" htmlFor="topic-notes">Anotações <span className="optional-label">· opcional</span></label>
            <textarea id="topic-notes" value={topicNotes} onChange={(event) => setTopicNotes(event.target.value)} rows={2} placeholder="O que revisar ou praticar?" />
            <button className="primary-action" type="submit">{editingTopicId ? "Salvar alterações" : "Adicionar conteúdo"}</button>{editingTopicId && <button className="text-action" type="button" onClick={() => { setShowTopicForm(false); setEditingTopicId(null); setTopicTitle(""); setTopicNotes(""); }}>Cancelar edição</button>}
          </form>}
          {disciplineTopics.length > 0 && <div className="study-filter"><label className="field-label" htmlFor="topic-filter">Exibir</label><select id="topic-filter" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">Todos</option><option value="pending">Pendentes</option><option value="completed">Concluídos</option></select></div>}
          {visibleTopics.length === 0 ? <div className="empty-state"><strong>Nenhum conteúdo nesta lista.</strong><p>Adicione um tópico ou altere o filtro para visualizar seus estudos.</p></div> : <div className="study-topic-list">{visibleTopics.map((topic) => <article className={topic.status === 'completed' ? 'study-topic completed' : 'study-topic'} key={topic.id}>
            <input type="checkbox" aria-label={`Marcar ${topic.title} como concluído`} checked={topic.status === 'completed'} onChange={() => void toggleTopic(topic)} />
            <div><strong>{topic.title}</strong>{topic.notes && <p>{topic.notes}</p>}</div>
            <div className="study-topic-actions"><button className="text-action" type="button" aria-label={`Materiais de ${topic.title}`} onClick={() => openUnit(topic.id, 'materiais')}>Materiais</button><button className="text-action" type="button" aria-label={`Praticar ${topic.title}`} onClick={() => openUnit(topic.id, 'praticar')}>Praticar</button><button className="text-action" type="button" onClick={() => editTopic(topic)}>Editar</button><button className="text-action" type="button" onClick={() => void deleteTopic(topic)}>Excluir</button></div>
          </article>)}</div>}
          </>}
          {studyView === 'materiais' && <><StudyMaterialImporter key={`import-${selectedDiscipline}-${unit?.id ?? ""}`} disciplineId={selectedDiscipline} unit={unit} onProcessed={refreshAfterMaterialImport} /><Files key={`files-${selectedDiscipline}-${studyRefreshVersion}`} disciplineId={selectedDiscipline} sourceFileId={unit ? unit.sourceFileId ?? null : undefined} allowUpload={false} /></>}
          {studyView === 'notas' && <Notes key={selectedDiscipline} disciplineId={selectedDiscipline} />}
          {studyView === 'aprender' && <StudyLearning disciplineId={selectedDiscipline} topicId={unit?.id}
            topics={unit ? [unit] : disciplineTopics} refreshToken={studyRefreshVersion + practiceVersion + cardVersion} />}
          {studyView === 'praticar' && <div className="study-practice" key={`${selectedDiscipline}:${unit?.id ?? ''}`}>
            <div className="view-switcher practice-switcher" role="group" aria-label="Atividades e resultados">
              {practiceViews.map(([key, label]) => <button type="button" key={key} aria-pressed={practiceView === key}
                onClick={() => setPracticeView(key)}>{label}</button>)}
            </div>
            <div hidden={practiceView !== 'questions'}>
              <QuestionBank disciplineId={selectedDiscipline} topics={disciplineTopics} unitId={unit?.id} refreshToken={studyRefreshVersion}
                onChanged={() => setPracticeVersion((version) => version + 1)} />
            </div>
            <div hidden={practiceView !== 'cards'}>
              <StudyFlashcards disciplineId={selectedDiscipline} topicId={unit?.id} refreshToken={studyRefreshVersion + cardVersion} />
            </div>
            <div hidden={practiceView !== 'performance'}>
              <StudyPerformance disciplineId={selectedDiscipline} topics={unit ? [unit] : disciplineTopics} unitId={unit?.id}
                refreshToken={studyRefreshVersion + practiceVersion} onCardCreated={() => setCardVersion((version) => version + 1)} />
            </div>
          </div>}
        </div>
      </div>
    </>}
  </section>;
}
