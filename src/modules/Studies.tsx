import { Files } from './Files';
import { Notes, NoteEditor } from './Notes';
import { EditDialog } from '../components/EditDialog';
import { useEffect, useLayoutEffect, useMemo, useState, type FormEvent } from 'react';
import type { Discipline, StudyTopic } from './studies/types';
import { StudyTrail } from './studies/StudyTrail';
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

export type StudyAction = { label: string; run: () => void };
export type StudyStart = { disciplineId: string; unitId: string; view?: 'materiais' | 'aprender' | 'praticar' };
export function Studies({ initialUnit, onActions }: { initialUnit?: StudyStart; onActions?: (actions: StudyAction[]) => void } = {}) {
  const [studyView, setStudyView] = useState(initialUnit?.view ?? (initialUnit ? 'materiais' : 'conteudos'));
  const [manage, setManage] = useState(false);
  const [practiceView, setPracticeView] = useState<typeof practiceViews[number][0]>('questions');
  const [showDisciplineForm, setShowDisciplineForm] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [noteRevision, setNoteRevision] = useState(0);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
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
  async function refresh() {
    const [loadedDisciplines, loadedTopics] = await Promise.all([studies.listDisciplines(), studies.listTopics()]);
    setDisciplines(loadedDisciplines.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')));
    setTopics(loadedTopics);
    setSelectedDiscipline((current) => loadedDisciplines.find((item) => item.id === current)?.id ?? '');
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
        setSelectedDiscipline(loadedDisciplines.find(({ id }) => id === initialDisciplineId)?.id ?? '');
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

  useLayoutEffect(() => {
    if (!onActions) return;
    onActions(discipline ? [
      { label: 'Nova unidade', run: () => { setFormError(''); setShowTopicForm(true); } },
      { label: 'Adicionar material', run: () => { setStudyView('materiais'); setShowUpload(true); } },
      { label: 'Criar nota vinculada', run: () => { setStudyView('notas'); setShowNote(true); } },
    ] : [{ label: 'Nova disciplina', run: () => { setFormError(''); setShowDisciplineForm(true); } }]);
  });

  const progress = useMemo(() => summarizeStudyProgress(topics), [topics]);
  const visibleTopics = topics.filter((topic) =>
    (filter === 'all' || topic.status === filter) && (!selectedDiscipline || topic.disciplineId === selectedDiscipline),
  );

  async function createDiscipline(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true); setFormError('');
    try {
      if (editingDisciplineId) {
        await studies.updateDiscipline(editingDisciplineId, { name: disciplineName, description: disciplineDescription });
        setSelectedDiscipline(editingDisciplineId);
      } else {
        const created = await studies.createDiscipline({ name: disciplineName, ...(disciplineDescription.trim() ? { description: disciplineDescription } : {}) });
        setSelectedDiscipline(created.id); setUnitId('');
      }
      setStudyView('conteudos');
      setDisciplineName(''); setDisciplineDescription(''); setEditingDisciplineId(null); setShowDisciplineForm(false); await refresh();
    } catch (cause) { setFormError(cause instanceof Error ? cause.message : 'Não foi possível salvar a disciplina.'); }
    finally { setSaving(false); }
  }

  function editDiscipline(discipline: Discipline) {
    setFormError(''); setShowDisciplineForm(true); setEditingDisciplineId(discipline.id); setDisciplineName(discipline.name); setDisciplineDescription(discipline.description ?? '');
  }

  function cancelDisciplineEdit() {
    setShowDisciplineForm(false); setEditingDisciplineId(null); setDisciplineName(''); setDisciplineDescription('');
  }

  async function createTopic(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true); setFormError('');
    try {
      const input = { title: topicTitle, notes: topicNotes };
      if (editingTopicId) await studies.updateTopic(editingTopicId, input);
      else await studies.createTopic({ disciplineId: selectedDiscipline, ...input });
      setManage(true);setStudyView('conteudos');
      setTopicTitle(''); setTopicNotes(''); setEditingTopicId(null); setShowTopicForm(false); await refresh();
    } catch (cause) { setFormError(cause instanceof Error ? cause.message : 'Não foi possível salvar o conteúdo.'); }
    finally { setSaving(false); }
  }

  function editTopic(topic: StudyTopic) {
    setFormError(''); setShowTopicForm(true); setEditingTopicId(topic.id); setTopicTitle(topic.title); setTopicNotes(topic.notes ?? '');
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
    {!discipline && <section className="study-index-heading" aria-labelledby="disciplines-title">
      <div className="section-heading">
        <h2 id="disciplines-title">Disciplinas</h2>

      </div>
      {progress.total > 0 && <div className="study-overall">
        <progress aria-label="Progresso geral dos estudos" value={progress.completed} max={progress.total} />
        <span>{progress.completed} de {progress.total} unidades concluídas</span>
      </div>}
    </section>}

    {showDisciplineForm && <EditDialog title={editingDisciplineId ? 'Editar disciplina' : 'Nova disciplina'} onClose={cancelDisciplineEdit}>
      <form className="dialog-form" onSubmit={createDiscipline} data-saving={saving || undefined}>
      <label className="field-label" htmlFor="discipline-name">Nome</label>
      <input id="discipline-name" value={disciplineName} onChange={(event) => setDisciplineName(event.target.value)} maxLength={80} placeholder="Ex.: Estrutura de Dados" required />
      <label className="field-label" htmlFor="discipline-description">Descrição <span className="optional-label">· opcional</span></label>
      <textarea id="discipline-description" value={disciplineDescription} onChange={(event) => setDisciplineDescription(event.target.value)} rows={2} placeholder="Professor, objetivo ou observações" />
        {formError && <p role="alert" className="module-error">{formError}</p>}
        <button className="primary-action" type="submit" disabled={saving}>Salvar disciplina</button>
      </form>
    </EditDialog>}
    {showTopicForm && <EditDialog title={editingTopicId ? 'Editar unidade' : 'Nova unidade'} onClose={() => {
      setShowTopicForm(false); setEditingTopicId(null); setTopicTitle(''); setTopicNotes('');
    }}>
      <form className="dialog-form" onSubmit={createTopic} data-saving={saving || undefined}>
        <label htmlFor="topic-title">Nome da unidade</label>
        <input id="topic-title" value={topicTitle} onChange={(event) => setTopicTitle(event.target.value)} maxLength={120} required />
        <label htmlFor="topic-notes">Anotações da unidade</label>
        <textarea id="topic-notes" value={topicNotes} onChange={(event) => setTopicNotes(event.target.value)} rows={3} />
        {formError && <p role="alert" className="module-error">{formError}</p>}
        <button className="primary-action" type="submit" disabled={saving}>Salvar unidade</button>
      </form>
    </EditDialog>}

    {disciplines.length === 0 ? <div className="empty-state"><strong>Seu espaço de estudos começa aqui.</strong><p>Use + para criar a primeira disciplina.</p></div> : <>
      <div className={discipline ? "study-workspace" : "study-library"}>
        {!discipline && <aside className="discipline-list" aria-label="Disciplinas">
          {disciplines.map((discipline) => {
            const summary = summarizeStudyProgress(topics.filter((topic) => topic.disciplineId === discipline.id));
            return <button type="button" key={discipline.id} className={selectedDiscipline === discipline.id ? 'discipline-option selected' : 'discipline-option'} aria-pressed={selectedDiscipline === discipline.id} onClick={() => { if (window.dispatchEvent(new Event('alfred-before-navigate', { cancelable: true }))) { setManage(false); setSelectedDiscipline(discipline.id); setUnitId(''); setStudyView('conteudos'); setPracticeView('questions'); setShowTopicForm(false); setEditingTopicId(null); setTopicTitle(''); setTopicNotes(''); } }}>
              <strong>{discipline.name}</strong>
              <span>{summary.total ? `${summary.completed}/${summary.total} unidades concluídas` : 'Sem unidades'}</span>
              {summary.total > 0 && <progress aria-hidden="true" value={summary.completed} max={summary.total} />}
            </button>;
          })}
        </aside>}
        {discipline && <div className="study-content">
          <button className="text-action" onClick={()=>{
            if (!window.dispatchEvent(new Event('alfred-before-navigate',{cancelable:true}))) return;
            if(manage || studyView !== 'conteudos'){setManage(false);setStudyView('conteudos');}
            else {setSelectedDiscipline('');setUnitId('');}
          }}>{manage || studyView !== 'conteudos' ? 'Voltar ao percurso' : 'Todas as disciplinas'}</button>
          <header className="study-content-heading">
            <div><h2>{discipline?.name}</h2>{discipline?.description && <p>{discipline.description}</p>}</div>
            <details className="interface-disclosure study-management"><summary>Gerenciar disciplina</summary>
              <button className="text-action" type="button" onClick={() => { if (discipline) editDiscipline(discipline); }}>Editar disciplina</button>
              <button className="danger-action" type="button" onClick={() => { if (discipline) void deleteDiscipline(discipline); }}>Excluir disciplina</button>
            </details>
          </header>
          <div hidden={manage || studyView !== 'conteudos'}><StudyTrail key={discipline.id} discipline={discipline} topics={disciplineTopics}
            onManage={()=>setManage(true)} onMaterials={id=>openUnit(id,'materiais')} refreshToken={studyRefreshVersion}/></div>
          {(manage || studyView !== 'conteudos') && <><nav className="view-switcher" aria-label="Conteúdo da disciplina">{studyViews.map(([key, label]) =>
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
          <h3>Unidades de estudo</h3>
          {disciplineTopics.length > 0 && <div className="study-filter"><label className="field-label" htmlFor="topic-filter">Exibir</label><select id="topic-filter" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">Todos</option><option value="pending">Pendentes</option><option value="completed">Concluídos</option></select></div>}
          {visibleTopics.length === 0 ? <div className="empty-state"><strong>Nenhum conteúdo nesta lista.</strong><p>Use + para adicionar uma unidade ou altere o filtro.</p></div> : <div className="study-topic-list">{visibleTopics.map((topic) => <article className={topic.status === 'completed' ? 'study-topic completed' : 'study-topic'} key={topic.id}>
            <input type="checkbox" aria-label={`Marcar ${topic.title} como concluído`} checked={topic.status === 'completed'} onChange={() => void toggleTopic(topic)} />
            <div><strong>{topic.title}</strong>{topic.notes && <p>{topic.notes}</p>}</div>
            <div className="study-topic-actions"><button className="text-action" type="button" aria-label={`Materiais de ${topic.title}`} onClick={() => openUnit(topic.id, 'materiais')}>Materiais</button><button className="text-action" type="button" aria-label={`Praticar ${topic.title}`} onClick={() => openUnit(topic.id, 'praticar')}>Praticar</button><button className="text-action" type="button" onClick={() => editTopic(topic)}>Editar</button><button className="text-action" type="button" onClick={() => void deleteTopic(topic)}>Excluir</button></div>
          </article>)}</div>}
          </>}
          {studyView === 'materiais' && <><StudyMaterialImporter key={`import-${selectedDiscipline}-${unit?.id ?? ""}`} disciplineId={selectedDiscipline} unit={unit} onProcessed={refreshAfterMaterialImport} uploadOpen={showUpload} onCloseUpload={() => setShowUpload(false)} /><Files key={`files-${selectedDiscipline}-${studyRefreshVersion}`} disciplineId={selectedDiscipline} sourceFileId={unit ? unit.sourceFileId ?? null : undefined} allowUpload={false} /></>}
          {studyView === 'notas' && <Notes key={selectedDiscipline} disciplineId={selectedDiscipline} revision={noteRevision} />}
          {showNote && <NoteEditor scope={{ disciplineId: selectedDiscipline }} onClose={() => setShowNote(false)} onSaved={() => {
            setShowNote(false); setNoteRevision((current) => current + 1);
          }} />}
          {studyView === 'aprender' && <StudyLearning disciplineId={selectedDiscipline} topicId={unit?.id}
            topics={unit ? [unit] : disciplineTopics} refreshToken={studyRefreshVersion + practiceVersion + cardVersion} />}
          {studyView === 'praticar' && <div className="study-practice" key={`${selectedDiscipline}:${unit?.id ?? ''}`}>
            <div className="view-switcher practice-switcher" role="group" aria-label="Atividades e resultados">
              {practiceViews.map(([key, label]) => <button type="button" key={key} aria-pressed={practiceView === key}
                onClick={() => setPracticeView(key)}>{label}</button>)}
            </div>
            <div hidden={practiceView !== 'questions'}>
              <QuestionBank key={JSON.stringify([selectedDiscipline, unit?.id])} disciplineId={selectedDiscipline} topics={disciplineTopics} unitId={unit?.id} refreshToken={studyRefreshVersion}
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
          </>}
        </div>}
      </div>
    </>}
  </section>;
}
