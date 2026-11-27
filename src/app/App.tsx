import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Agenda } from '../modules/Agenda';
import { AgendaEditor } from '../modules/AgendaEditor';
import { TodayWeather } from '../modules/TodayWeather';
import { hasGoogleCalendarSession } from '../modules/GoogleCalendarOAuthPanel';
import { Overview } from '../modules/Overview';
import { Studies, type StudyAction, type StudyStart } from '../modules/Studies';
import { BackupSettings } from '../modules/BackupSettings';
import { StageEditor } from '../modules/ProjectWorkspace';
import { AlfredWorkspace, type ProjectCreation } from '../modules/AlfredWorkspace';
import { Notes, NoteEditor } from '../modules/Notes';
import { Files } from '../modules/Files';
import { AssistantMemoryPanel } from '../modules/AssistantMemoryPanel';
import { ManualExportPanel } from '../modules/ManualExportPanel';
import { EditDialog } from '../components/EditDialog';
import { ProjectEditor, TaskEditor } from '../modules/RecordEditors';
import { isSameOriginAIAvailable } from '../modules/studies/studyRemoteQuestions';
import { getAlfredLocalStorageKey } from '../storage/namespace';

type Page = 'inicio' | 'estudos' | 'organizacao' | 'assistente' | 'projetos' | 'notas' | 'arquivos' | 'ia' | 'configuracoes';
type Editor = { kind: ProjectCreation | 'appointment' | 'account'; projectId?: string };
type IconName = 'home' | 'sparkles' | 'check' | 'book' | 'calendar' | 'layers' | 'folder' | 'chart' | 'settings' | 'plus';
type Theme = 'system' | 'light' | 'dark';

const appearanceKey = getAlfredLocalStorageKey('appearance');
const mascotKey = getAlfredLocalStorageKey('mascot-hidden');
const googleInviteKey = getAlfredLocalStorageKey('google-calendar-invite-dismissed');
const nameKey = getAlfredLocalStorageKey('account-name');
const navigation = [
  { id: 'inicio', label: 'Hoje', icon: 'home' },
  { id: 'estudos', label: 'Aprender', icon: 'book' },
  { id: 'organizacao', label: 'Organização', icon: 'layers' },
  { id: 'assistente', label: 'Alfred', icon: 'sparkles' },
  { id: 'projetos', label: 'Projetos', icon: 'folder' },
] as const;
const pages: Record<Exclude<Page, 'inicio' | 'assistente' | 'projetos'>, [string, string]> = {
  estudos: ['Aprender', 'Disciplinas, materiais e prática por unidade.'],
  organizacao: ['Organização', ''],
  notas: ['Notas', ''],
  arquivos: ['Arquivos', ''],
  ia: ['Central de IA', ''],
  configuracoes: ['Configurações', 'Aparência, privacidade e seus dados.'],
};

function readPreference(key: string) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function Icon({ name }: { name: IconName }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const paths: Record<IconName, ReactNode> = {
    home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9M9 20v-6h6v6" /></>,
    sparkles: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" /><path d="m19 14 .9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14Z" /></>,
    check: <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16.5 9" /></>,
    book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 1 4 17.5v-12Z" /><path d="M4 16.5A2.5 2.5 0 0 1 6.5 14H20M8 7h8" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
    layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5M3 16l9 5 9-5" /></>,
    folder: <><path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H10l2 2h7.5A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5v-11Z" /></>,
    chart: <><path d="M4 19V5M4 19h17" /><path d="m7 15 4-4 3 2 5-6" /><path d="M16 7h3v3" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.6a8 8 0 0 1-1.6.9l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.6-.9l-1.7.6-1.4-2.4 1.4-1.1a7 7 0 0 1 0-1.9l-1.4-1.1 1.4-2.4 1.7.6a8 8 0 0 1 1.6-.9l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.6.9l1.7-.6 1.4 2.4-1.4 1.1a7 7 0 0 1 0 1.8Z" transform="translate(-1 -1) scale(1.08)" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
  };
  return <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true" {...common}>{paths[name]}</svg>;
}


function App() {
  const [page, setPage] = useState<Page>('inicio');
  const [studyStart, setStudyStart] = useState<StudyStart>();
  const [studyDisciplineOpen, setStudyDisciplineOpen] = useState(false);
  const [editor, setEditor] = useState<Editor>();
  const [more, setMore] = useState(false);
  const [menu, setMenu] = useState<StudyAction[]>();
  const [revision, setRevision] = useState(0);
  const [status, setStatus] = useState('');
  const [calendarStart, setCalendarStart] = useState<string>();
  const [selectedDate, setSelectedDate] = useState<string>();
  const [calendarSetup, setCalendarSetup] = useState(false);
  const [settingsTarget, setSettingsTarget] = useState<'google' | 'weather'>();
  const [inviteDismissed, setInviteDismissed] = useState(() => readPreference(googleInviteKey) === 'true');
  const weatherHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (settingsTarget === 'weather') weatherHeading.current?.focus(); }, [settingsTarget]);
  const [name, setName] = useState(() => readPreference(nameKey) ?? '');
  const [nameDraft, setNameDraft] = useState('');
  const studyActions = useRef<StudyAction[]>([]);
  const assistantActions = useRef<StudyAction[]>([]);
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = readPreference(appearanceKey);
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
    const legacy = readPreference('alfred-appearance');
    return legacy === 'technical' ? 'dark' : legacy === 'daily' ? 'light' : 'system';
  });
  const [mascotHidden, setMascotHidden] = useState(() => readPreference(mascotKey) === 'true');
  const [preferenceError, setPreferenceError] = useState('');
  const content = useRef<HTMLElement>(null);

  useEffect(() => {
    const system = window.matchMedia?.('(prefers-color-scheme: dark)');
    const apply = () => { document.documentElement.dataset.theme = theme === 'system' ? system?.matches ? 'dark' : 'light' : theme; };
    apply();
    if (theme === 'system') system?.addEventListener?.('change', apply);
    return () => {
      if (theme === 'system') system?.removeEventListener?.('change', apply);
      delete document.documentElement.dataset.theme;
    };
  }, [theme]);

  function remember(key: string, value: string) {
    try { localStorage.setItem(key, value); setPreferenceError(''); }
    catch { setPreferenceError('A preferência foi aplicada nesta sessão.'); }
  }

  function navigate(target: Page, context?: { study?: StudyStart; calendarDate?: string; settings?: 'google' | 'weather' }) {
    setPage(target);
    if (target !== 'estudos') setStudyDisciplineOpen(false);
    setStudyStart(context?.study);
    setCalendarStart(context?.calendarDate);
    setSettingsTarget(context?.settings);
    setCalendarSetup(context?.settings === 'google');
    setStatus('');
    setMenu(undefined);
    setMore(false);
    content.current?.focus({ preventScroll: true });
    document.documentElement.scrollTop = 0;
  }

  function createMenu() {
    setStatus('');
    if (page === 'estudos') setMenu(studyActions.current);
    else if (page === 'assistente' || page === 'projetos') setMenu(assistantActions.current);
    else if (page === 'notas') setEditor({ kind: 'note' });
    else if (page === 'arquivos') setEditor({ kind: 'file' });
    else if (page === 'inicio' || page === 'organizacao') {
      const task = { label: 'Nova tarefa', run: () => setEditor({ kind: 'task' }) };
      const appointment = { label: 'Novo compromisso', run: () => setEditor({ kind: 'appointment' }) };
      const note = { label: 'Nova nota', run: () => setEditor({ kind: 'note' }) };
      setMenu(page === 'inicio' ? [task, appointment, note] : [appointment, task, note]);
    }
  }

  const close = () => setEditor(undefined);
  function saved() {
    close();
    setRevision((value) => value + 1);
    setStatus(editor?.kind === 'note' ? 'Nota salva.' : 'Alterações salvas.');
  }
  const contextualDate = page === 'organizacao' ? selectedDate : undefined;

  const build = document.querySelector<HTMLMetaElement>('meta[name=alfred-build]')?.content;
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  return <div className="alfred-shell">
    <a className="skip-link" href="#main-content">Ir ao conteúdo</a>
    <header className="masthead">
      <a className="wordmark" href={import.meta.env.BASE_URL} aria-label="Alfred, início"
        onClick={(event) => { event.preventDefault(); navigate('inicio'); }}>
        <img src={`${import.meta.env.BASE_URL}brand/alfred-mark.svg`} alt="" /><span>alfred</span>
      </a>
      <nav className="primary-navigation" aria-label="Navegação principal">
        {navigation.map(({ id, label, icon }) => <button key={id} type="button" aria-current={page === id ? 'page' : undefined}
          onClick={() => navigate(id)}><Icon name={icon} /><span>{label}</span></button>)}
      </nav>
      <div className="shell-actions">
        <button type="button" className="create-launcher" aria-label="Criar" aria-haspopup="dialog"
          disabled={page === 'configuracoes' || page === 'ia'} onClick={createMenu}><Icon name="plus" /></button>
        <button type="button" aria-haspopup="dialog" onClick={() => setMore(true)}>Mais</button>
      </div>
    </header>
    <main id="main-content" className={`page page-${page}`} tabIndex={-1} ref={content}>
      {status && <p className="save-notice" role="status">{status}</p>}
      {page === 'inicio' && <Overview greeting={greeting + (name ? ', ' + name : '') + '.'}
        onCalendar={(calendarDate) => navigate('organizacao', { calendarDate })} onAssistant={() => navigate('assistente')}
        onResumeStudy={(study) => navigate('estudos', { study })}
        onWeatherSettings={() => navigate('configuracoes', { settings: 'weather' })}
        googleInvite={inviteDismissed || hasGoogleCalendarSession() ? undefined : {
          connect: () => navigate('configuracoes', { settings: 'google' }),
          dismiss: () => { setInviteDismissed(true); remember(googleInviteKey, 'true'); },
        }} revision={revision} />}
      {page !== 'inicio' && page !== 'assistente' && page !== 'projetos' && !(page === 'estudos' && studyDisciplineOpen) && <header className="page-heading">
        <h1>{pages[page][0]}</h1>{pages[page][1] && <p>{pages[page][1]}</p>}
      </header>}
      {page === 'estudos' && <Studies initialUnit={studyStart} onActions={(list) => { studyActions.current = list; }} onDisciplineOpenChange={setStudyDisciplineOpen} />}
      {page === 'notas' && <Notes revision={revision} />}
      {page === 'ia' && <section className="entry-panel" aria-labelledby="studies-ai-title">
        <h2 id="studies-ai-title">Preparação de Estudos</h2>
        <p>{isSameOriginAIAvailable(import.meta.env.VITE_STUDIES_AI_ORIGIN, window.location.origin)
          ? 'Origem configurada. A preparação depende da sessão de acesso e do serviço de IA.'
          : 'A geração remota requer a prévia HTTPS autenticada de Estudos.'}</p>
        <p>Após sua autorização, o Alfred envia apenas os trechos selecionados no importador.</p>
        <button type="button" onClick={() => navigate('estudos')}>Abrir Estudos</button>
      </section>}
      {page === 'arquivos' && <Files key={revision} />}
      {(page === 'assistente' || page === 'projetos') && <AlfredWorkspace mode={page === 'assistente' ? 'chat' : 'projects'} showMascot={!mascotHidden} revision={revision}
        onActions={(list) => { assistantActions.current = list; }}
        onCreate={(kind, projectId) => setEditor({ kind, projectId })} />}
      {page === 'organizacao' && <div className="calendar-workbench">
        <Agenda initialDate={calendarStart} revision={revision} onDateChanged={setSelectedDate} />
        <details className="interface-disclosure calendar-general-notes"><summary>Notas gerais</summary><Notes revision={revision} /></details>
      </div>}
      {page === 'configuracoes' && <div className="settings-workbench">
          <section className="entry-panel" aria-label="Conta">
            <h2>Conta</h2>
            <p>{name || 'Nome de exibição ainda não definido neste dispositivo.'}</p>
            <button type="button" onClick={() => { setNameDraft(name); setEditor({ kind: 'account' }); }}>Editar nome</button>
          </section>
          <section className="entry-panel settings-appearance">
            <h2>Aparência</h2>
            <div className="workspace-tabs" role="group" aria-label="Aparência">
              {([['system', 'Automático'], ['light', 'Claro'], ['dark', 'Escuro']] as const).map(([value, label]) =>
                <button key={value} type="button" aria-pressed={theme === value} onClick={() => {
                  setTheme(value); remember(appearanceKey, value);
                }}>{label}</button>)}
            </div>
            <label className="check-label"><input type="checkbox" checked={!mascotHidden} onChange={(event) => {
              const hidden = !event.target.checked; setMascotHidden(hidden); remember(mascotKey, String(hidden));
            }} /> Mostrar mascote Alfred</label>
            {preferenceError && <p role="status">{preferenceError}</p>}
          </section>
          <section className="entry-panel" aria-labelledby="settings-weather-title">
            <h2 id="settings-weather-title" ref={weatherHeading} tabIndex={-1}>Previsão do tempo</h2>
            <TodayWeather settings />
          </section>
          <section className={calendarSetup ? "entry-panel settings-integrations expanded" : "entry-panel settings-integrations"}><h2>Integrações</h2>
            <button type="button" aria-expanded={calendarSetup} onClick={() => setCalendarSetup(!calendarSetup)}>Conexões de calendário</button>
            {calendarSetup && <Agenda integrationsOnly focusGoogle={settingsTarget === 'google'} />}
          </section>
          <details className="interface-disclosure"><summary>Memória e exportação do Alfred</summary>
            <AssistantMemoryPanel /><ManualExportPanel />
          </details>
          <BackupSettings />
          {build && <p className="build-details">Versão <code>{build}</code></p>}
        </div>}
    </main>
    {more && <EditDialog title="Mais" protect={false} onClose={() => setMore(false)}>
      <div className="quick-actions">
        {(['notas', 'arquivos', 'ia', 'configuracoes'] as const).map(id =>
          <button key={id} type="button" onClick={() => navigate(id)}>{pages[id][0]}</button>)}
      </div>
    </EditDialog>}
    {menu && <EditDialog title="Criar" protect={false} onClose={() => setMenu(undefined)}>
      <div className="quick-actions">
        {menu.map(({ label, run }) => <button key={label} type="button" onClick={() => { setMenu(undefined); run(); }}>{label}</button>)}
      </div>
    </EditDialog>}
    {editor?.kind === 'task' && <TaskEditor date={contextualDate} scopedProjectId={editor.projectId} onClose={close} onSaved={saved} />}
    {editor?.kind === 'appointment' && <AgendaEditor date={contextualDate} onClose={close} onSaved={saved} />}
    {editor?.kind === 'project' && <ProjectEditor onClose={close} onSaved={saved} />}
    {editor?.kind === 'note' && <NoteEditor scope={{ projectId: editor.projectId }} chooseDiscipline={page === 'inicio'} onClose={close} onSaved={saved} />}
    {editor?.kind === 'stage' && editor.projectId && <StageEditor projectId={editor.projectId} onClose={close} onSaved={saved} />}
    {editor?.kind === 'file' && <EditDialog title="Adicionar arquivo" onClose={close}>
      <Files projectId={editor.projectId} uploadOnly onUploaded={saved} />
    </EditDialog>}
    {editor?.kind === 'account' && <EditDialog title="Editar nome" onClose={close}>
      <form className="dialog-form" onSubmit={(event) => {
        event.preventDefault();
        const value = nameDraft.trim();
        setName(value); remember(nameKey, value); close();
      }}>
        <label htmlFor="profile-name">Nome de exibição</label>
        <input id="profile-name" maxLength={80} autoComplete="name" value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} />
        <button className="primary-action" type="submit">Salvar</button>
      </form>
    </EditDialog>}
  </div>;
}

export default App;
