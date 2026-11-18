import mascotImage from '../assets/alfred.png';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { PersonalOrganization } from '../modules/PersonalOrganization';
import { Agenda } from '../modules/Agenda';
import { Overview } from '../modules/Overview';
import { Studies } from '../modules/Studies';
import { BackupSettings } from '../modules/BackupSettings';
import { Productivity } from '../modules/Productivity';
import { ProjectWorkspace } from '../modules/ProjectWorkspace';
import { Assistant } from '../modules/Assistant';
import { Notes } from '../modules/Notes';
import { Files } from '../modules/Files';
import { getAlfredLocalStorageKey } from '../storage/namespace';

type OrganizationTab = 'agenda' | 'tarefas' | 'projetos' | 'notas' | 'arquivos' | 'produtividade';
type Page = 'inicio' | 'estudos' | 'organizacao' | 'assistente' | 'configuracoes';
type IconName = 'home' | 'sparkles' | 'check' | 'book' | 'calendar' | 'layers' | 'folder' | 'chart' | 'settings' | 'plus';
type Theme = 'system' | 'light' | 'dark';

const appearanceKey = getAlfredLocalStorageKey('appearance');
const mascotKey = getAlfredLocalStorageKey('mascot-hidden');
const tabs: [OrganizationTab, string][] = [
  ['agenda', 'Calendário'], ['tarefas', 'Tarefas'], ['projetos', 'Projetos'],
  ['notas', 'Notas'], ['arquivos', 'Arquivos'], ['produtividade', 'Foco'],
];
const navigation = [
  { id: 'inicio', label: 'Hoje', icon: 'home' },
  { id: 'estudos', label: 'Aprender', icon: 'book' },
  { id: 'create', label: 'Criar', icon: 'plus' },
  { id: 'organizacao', label: 'Organização', icon: 'layers' },
  { id: 'assistente', label: 'Alfred', icon: 'sparkles' },
] as const;
const pages: Record<Exclude<Page, 'inicio'>, [string, string]> = {
  estudos: ['Aprender', 'Disciplinas, materiais e prática por unidade.'],
  organizacao: ['Organização', 'Compromissos, eventos e prazos no calendário.'],
  assistente: ['Alfred', 'Converse com seu assistente pessoal.'],
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
  const [organizationTab, setOrganizationTab] = useState<OrganizationTab>('agenda');
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = readPreference(appearanceKey);
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
    const legacy = readPreference('alfred-appearance');
    return legacy === 'technical' ? 'dark' : legacy === 'daily' ? 'light' : 'system';
  });
  const [mascotHidden, setMascotHidden] = useState(() => readPreference(mascotKey) === 'true');
  const [preferenceError, setPreferenceError] = useState('');
  const [quick, setQuick] = useState<{ tab: OrganizationTab; sequence: number }>();
  const dialog = useRef<HTMLDialogElement>(null);
  const createButton = useRef<HTMLButtonElement>(null);
  const closingForNavigation = useRef(false);
  const quickSequence = useRef(0);
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

  useEffect(() => {
    const main = content.current;
    if (!main || !quick || page !== 'organizacao' || organizationTab !== quick.tab) return;
    const selectors: Partial<Record<OrganizationTab, string>> = {
      tarefas: '#task-title', notas: '#note-title', projetos: '#project-name', agenda: '#appointment-title',
    };
    const selector = selectors[quick.tab];
    if (!selector) return;
    function focusField() {
      const field = main?.querySelector<HTMLElement>(selector!);
      field?.focus();
      return Boolean(field);
    }
    if (focusField()) return;
    const observer = new MutationObserver(() => { if (focusField()) observer.disconnect(); });
    observer.observe(main, { subtree: true, childList: true });
    return () => observer.disconnect();
  }, [organizationTab, page, quick]);

  function remember(key: string, value: string) {
    try { localStorage.setItem(key, value); setPreferenceError(''); }
    catch { setPreferenceError('A preferência foi aplicada nesta sessão.'); }
  }

  function navigate(target: Page | OrganizationTab, create = false) {
    if (!window.dispatchEvent(new Event('alfred-before-navigate', { cancelable: true }))) return;
    const tab = tabs.find(([id]) => id === target)?.[0];
    if (tab) {
      setOrganizationTab(tab);
      setPage('organizacao');
    } else {
      if (target === 'organizacao' && page !== 'organizacao') setOrganizationTab('agenda');
      setPage(target as Page);
    }
    setQuick(create && tab ? { tab, sequence: ++quickSequence.current } : undefined);
    if (dialog.current?.open) {
      closingForNavigation.current = true;
      dialog.current.close();
    }
    content.current?.focus({ preventScroll: true });
    document.documentElement.scrollTop = 0;
  }

  const build = document.querySelector<HTMLMetaElement>('meta[name=alfred-build]')?.content;
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Bom dia.' : hour < 18 ? 'Boa tarde.' : 'Boa noite.';
  return <div className="alfred-shell">
    <a className="skip-link" href="#main-content">Ir ao conteúdo</a>
    <header className="masthead">
      <a className="wordmark" href={import.meta.env.BASE_URL} aria-label="Alfred, início"
        onClick={(event) => { event.preventDefault(); navigate('inicio'); }}>
        <img src={`${import.meta.env.BASE_URL}brand/alfred-mark.svg`} alt="" /><span>alfred</span>
      </a>
      <nav className="primary-navigation" aria-label="Navegação principal">
        {navigation.map(({ id, label, icon }) => id === 'create'
          ? <button key={id} ref={createButton} type="button" className="create-launcher" aria-label="Criar"
              aria-haspopup="dialog" onClick={() => dialog.current?.showModal()}><Icon name={icon} /><span className="create-label">{label}</span></button>
          : <button key={id} type="button" aria-current={page === id ? 'page' : undefined}
              onClick={() => navigate(id)}><Icon name={icon} /><span>{label}</span></button>)}
      </nav>
      <button type="button" className="settings-launcher" aria-label="Configurações"
        aria-current={page === 'configuracoes' ? 'page' : undefined} onClick={() => navigate('configuracoes')}><Icon name="settings" /></button>
    </header>
    <main id="main-content" className={`page page-${page}`} tabIndex={-1} ref={content}>
      {page === 'inicio' ? <>
        <section className="day-hero" aria-labelledby="day-title">
          <div className="day-copy">
            <p className="day-date">{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full' }).format(now)}</p>
            <h1 id="day-title">{greeting}</h1>
            <p>Veja o que merece sua atenção hoje.</p>
            <button className="primary-action" type="button" onClick={() => navigate('assistente')}><Icon name="sparkles" /> Conversar com Alfred</button>
          </div>
          {!mascotHidden && <button className="day-mascot" type="button" aria-label="Abrir assistente Alfred" onClick={() => navigate('assistente')}><img src={mascotImage} alt="" /></button>}
        </section>
        <Overview onNavigate={navigate} />
      </> : <>
        <header className="page-heading"><h1>{pages[page][0]}</h1><p>{pages[page][1]}</p></header>
        {page === 'estudos' && <Studies />}
        {page === 'assistente' && <Assistant showMascot={!mascotHidden} />}
        {page === 'organizacao' && <>
          <nav className="workspace-tabs organization-tabs" aria-label="Ferramentas de organização">
            {tabs.map(([id, label]) => <button key={id} type="button" aria-current={organizationTab === id ? 'page' : undefined}
              onClick={() => navigate(id)}>{label}</button>)}
          </nav>
          {organizationTab === 'agenda' && <Agenda key={quick?.tab === 'agenda' ? quick.sequence : 0} creationRequest={quick?.tab === 'agenda' ? quick.sequence : 0} />}
          {organizationTab === 'tarefas' && <PersonalOrganization key={quick?.tab === 'tarefas' ? quick.sequence : 0} section="tarefas" />}
          {organizationTab === 'projetos' && <ProjectWorkspace key={quick?.tab === 'projetos' ? quick.sequence : 0} />}
          {organizationTab === 'notas' && <Notes key={quick?.tab === 'notas' ? quick.sequence : 0} />}
          {organizationTab === 'arquivos' && <Files />}
          {organizationTab === 'produtividade' && <Productivity />}
        </>}
        {page === 'configuracoes' && <>
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
          <BackupSettings />
          {build && <p className="build-details">Versão <code>{build}</code></p>}
        </>}
      </>}
    </main>
    <dialog className="quick-dialog" ref={dialog} aria-labelledby="quick-title" onClose={() => { if (!closingForNavigation.current) createButton.current?.focus(); closingForNavigation.current = false; }}>
      <header><h2 id="quick-title">Criar</h2><button type="button" aria-label="Fechar criação rápida" onClick={() => dialog.current?.close()}>×</button></header>
      <div className="quick-actions">
        {([['tarefas', 'Nova tarefa', 'check'], ['agenda', 'Novo compromisso', 'calendar'],
          ['notas', 'Nova nota', 'book'], ['projetos', 'Novo projeto', 'folder']] as const).map(([id, label, icon]) =>
          <button key={id} type="button" onClick={() => navigate(id, true)}><Icon name={icon} />{label}</button>)}
      </div>
    </dialog>
  </div>;
}

export default App;
