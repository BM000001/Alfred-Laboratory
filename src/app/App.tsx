import { useEffect, useState, type ReactNode } from 'react';
import { PersonalOrganization } from '../modules/PersonalOrganization';
import { Agenda } from '../modules/Agenda';
import { Overview } from '../modules/Overview';
import { Studies } from '../modules/Studies';
import { Files } from '../modules/Files';
import { BackupSettings } from '../modules/BackupSettings';
import { Productivity } from '../modules/Productivity';
import { Assistant } from '../modules/Assistant';

type SectionId = 'inicio' | 'assistente' | 'tarefas' | 'estudos' | 'agenda' | 'projetos' | 'arquivos' | 'produtividade' | 'configuracoes';
type IconName = 'home' | 'sparkles' | 'check' | 'book' | 'calendar' | 'layers' | 'folder' | 'chart' | 'settings' | 'more';

const sections: { id: SectionId; label: string; icon: IconName }[] = [
  { id: 'inicio', label: 'Início', icon: 'home' },
  { id: 'assistente', label: 'Alfred', icon: 'sparkles' },
  { id: 'tarefas', label: 'Tarefas', icon: 'check' },
  { id: 'projetos', label: 'Projetos', icon: 'layers' },
  { id: 'agenda', label: 'Agenda', icon: 'calendar' },
  { id: 'estudos', label: 'Estudos', icon: 'book' },
  { id: 'arquivos', label: 'Arquivos', icon: 'folder' },
  { id: 'produtividade', label: 'Produtividade', icon: 'chart' },
  { id: 'configuracoes', label: 'Configurações', icon: 'settings' },
];

const mobilePrimary: SectionId[] = ['inicio', 'assistente', 'tarefas', 'agenda'];
const mobileMore: SectionId[] = ['projetos', 'estudos', 'arquivos', 'produtividade', 'configuracoes'];

const groups: { label: string; ids: SectionId[] }[] = [
  { label: 'PRINCIPAL', ids: ['inicio', 'assistente'] },
  { label: 'ORGANIZAÇÃO', ids: ['tarefas', 'projetos', 'agenda'] },
  { label: 'CONHECIMENTO', ids: ['estudos', 'arquivos'] },
];

const sectionDetails: Record<SectionId, { title: string; description: string }> = {
  inicio: { title: 'Seu dia, sob controle.', description: 'Um espaço claro para entender o que está acontecendo e decidir o próximo passo.' },
  assistente: { title: 'À sua disposição.', description: 'Converse com Alfred e consulte suas informações.' },
  tarefas: { title: 'Tarefas', description: 'Transforme suas prioridades em próximos passos claros.' },
  estudos: { title: 'Estudos', description: 'Disciplinas, conteúdos, cronogramas e avaliações ficarão organizados aqui.' },
  agenda: { title: 'Agenda', description: 'Compromissos, eventos e prazos em uma visão única.' },
  projetos: { title: 'Projetos', description: 'Acompanhe objetivos, etapas e entregas importantes.' },
  arquivos: { title: 'Arquivos', description: 'Seus documentos e materiais, organizados e fáceis de encontrar.' },
  produtividade: { title: 'Produtividade', description: 'Hábitos, foco, pausas e revisões no seu ritmo.' },
  configuracoes: { title: 'Configurações', description: 'Preferências, aparência, privacidade e controle dos seus dados.' },
};

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
    more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
  };
  return <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true" {...common}>{paths[name]}</svg>;
}

function App() {
  const [activeSection, setActiveSection] = useState<SectionId>('inicio');
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);

  useEffect(() => {
    if (!mobileMoreOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileMoreOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [mobileMoreOpen]);
  const activeDetails = sectionDetails[activeSection];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bom dia.' : hour < 18 ? 'Boa tarde.' : 'Boa noite.';
  const activeItem = sections.find((item) => item.id === activeSection)!;

  const navigate = (id: SectionId) => {
    setActiveSection(id);
    setMobileMoreOpen(false);
  };

  const renderNavItem = (section: (typeof sections)[number], compact = false) => (
    <button
      className={`nav-item ${activeSection === section.id ? 'active' : ''} ${compact ? 'mobile-nav-item' : ''}`}
      key={section.id}
      type="button"
      aria-current={activeSection === section.id ? 'page' : undefined}
      aria-label={compact ? `Abrir ${section.label}` : undefined}
      onClick={() => navigate(section.id)}
    >
      <Icon name={section.icon} />
      <span>{section.label}</span>
    </button>
  );

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/Alfred/" aria-label="Alfred, início" onClick={(event) => { event.preventDefault(); navigate('inicio'); }}>
          <span className="brand-mark" aria-hidden="true"><Icon name="sparkles" /></span>
          <span>Alfred<span className="brand-period">.</span></span>
        </a>
        <div className="topbar-meta">
          <span className="topbar-status"><span className="status-dot" /> SEU ESPAÇO PESSOAL</span>
          <span className="topbar-caption">PRIVADO POR PADRÃO</span>
        </div>
      </header>

      <div className="workspace">
        <aside className="sidebar-shell">
          <nav className="sidebar" aria-label="Navegação principal">
            {groups.map((group) => (
              <div className="nav-group" key={group.label}>
                <p className="nav-caption">{group.label}</p>
                {group.ids.map((id) => renderNavItem(sections.find((item) => item.id === id)!))}
              </div>
            ))}
            <div className="nav-bottom">
              {renderNavItem(sections.find((item) => item.id === 'produtividade')!)}
              {renderNavItem(sections.find((item) => item.id === 'configuracoes')!)}
            </div>
            <div className="sidebar-note"><span className="sidebar-note-mark"><Icon name="sparkles" /></span><span><strong>Alfred</strong><small>Discreto. Atento. Ao seu lado.</small></span></div>
          </nav>
        </aside>

        <section className="main-content" aria-live="polite">
          <div className="mobile-page-context"><span className="mobile-context-icon"><Icon name={activeItem.icon} /></span><span>{activeItem.label}</span></div>
          <section className="welcome" aria-labelledby="welcome-title">
            <p className="eyebrow">{activeSection === 'inicio' ? 'SEU DIA, SOB CONTROLE' : 'ALFRED · ESPAÇO PESSOAL'}</p>
            <h1 id="welcome-title">{activeSection === 'inicio' ? greeting : activeDetails.title}</h1>
            <p className="welcome-copy">{activeSection === 'inicio' ? 'Seu espaço está pronto. Vamos organizar o que realmente importa hoje.' : activeDetails.description}</p>
          </section>

          {activeSection === 'inicio' ? (
            <Overview onNavigate={navigate} />
          ) : activeSection === 'assistente' ? (
            <Assistant />
          ) : activeSection === 'agenda' ? (
            <Agenda />
          ) : activeSection === 'estudos' ? (
            <Studies />
          ) : activeSection === 'arquivos' ? (
            <Files />
          ) : activeSection === 'configuracoes' ? (
            <BackupSettings />
          ) : activeSection === 'produtividade' ? (
            <Productivity />
          ) : activeSection === 'tarefas' || activeSection === 'projetos' ? (
            <PersonalOrganization section={activeSection} />
          ) : null}
        </section>
      </div>

      <nav className="mobile-tabbar" aria-label="Navegação móvel">
        {mobilePrimary.map((id) => renderNavItem(sections.find((item) => item.id === id)!, true))}
        <button className={`nav-item mobile-nav-item mobile-more-trigger ${mobileMoreOpen || mobileMore.includes(activeSection) ? 'active' : ''}`} type="button" aria-expanded={mobileMoreOpen} aria-controls="mobile-more-menu" onClick={() => setMobileMoreOpen((open) => !open)}>
          <Icon name="more" /><span>Mais</span>
        </button>
        {mobileMoreOpen && (
          <div className="mobile-more-menu" id="mobile-more-menu">
            <p className="mobile-more-heading">OUTRAS ÁREAS</p>
            {mobileMore.map((id) => renderNavItem(sections.find((item) => item.id === id)!))}
          </div>
        )}
      </nav>

      <footer className="app-footer"><span>ALFRED</span><span>Discreto. Atento. Ao seu lado.</span></footer>
    </main>
  );
}

export default App;
