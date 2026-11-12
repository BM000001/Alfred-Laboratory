import { useEffect, useState, type FormEvent } from 'react';
import { fileRepository } from '../storage/repositories';
import { createNoteService, type NoteScope } from './files/noteService';
import type { StoredFile } from './files/types';
const notes = createNoteService(fileRepository);
export function Notes(scope: NoteScope) {
  const [items, setItems] = useState<StoredFile[]>([]);
  const [id, setId] = useState<string>();
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { let active = true; notes.list(scope).then(items => { if (active) setItems(items); }).catch(() => { if (active) setError('Não foi possível carregar as anotações.'); }); return () => { active = false; }; }, [scope.projectId, scope.disciplineId]);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); };
    const guard = (event: Event) => { if (dirty && !window.confirm('Descartar as alterações não salvas desta anotação?')) event.preventDefault(); };
    window.addEventListener('alfred-before-navigate', guard);
    window.addEventListener('beforeunload', beforeUnload);
    return () => { window.removeEventListener('beforeunload', beforeUnload); window.removeEventListener('alfred-before-navigate', guard); };
  }, [dirty]);
  function open(note?: StoredFile) {
    if (dirty && !window.confirm('Descartar as alterações não salvas desta anotação?')) return;
    setId(note?.id); setTitle(note?.name || ''); setText(note?.noteText || ''); setDirty(false); setStatus('');
  }
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try { const note = await notes.save(scope, title, text, id); setId(note.id); setDirty(false); setItems(await notes.list(scope)); setStatus('Anotação salva neste dispositivo.'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível salvar.'); }
    finally { setBusy(false); }
  }
  return <section className="notes-workspace" aria-label="Anotações">
    <aside className="note-index"><h3>Seu caderno</h3><input aria-label="Buscar anotações" placeholder="Buscar no caderno" value={query} onChange={event => setQuery(event.target.value)} /><button className="text-action" type="button" onClick={() => open()}>+ Nova anotação</button>
      {items.filter(item => `${item.name} ${item.noteText}`.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR'))).map(note => <button type="button" className="note-link" aria-pressed={id === note.id} key={note.id} onClick={() => open(note)}><strong>{note.name}</strong><small>{note.noteText?.slice(0, 65) || 'Sem conteúdo'}</small></button>)}
      {items.length === 0 && <p>Nenhuma anotação. Registre suas ideias ao lado.</p>}
    </aside>
    <form className="note-editor entry-panel" onSubmit={save}><label className="field-label" htmlFor="note-title">Título da anotação</label><input id="note-title" required maxLength={120} value={title} onChange={event => { setTitle(event.target.value); setDirty(true); }} /><label className="field-label" htmlFor="note-text">Conteúdo</label><textarea id="note-text" rows={12} maxLength={100000} value={text} onChange={event => { setText(event.target.value); setDirty(true); }} placeholder="Ideias, decisões e próximos passos…" /><p>{text.length} caracteres · {dirty ? 'Alterações não salvas' : 'Pronto para editar'}</p><button className="primary-action" disabled={busy} type="submit">{busy ? 'Salvando…' : 'Salvar anotação'}</button>{error && <p role="alert">{error}</p>}{status && <p role="status">{status}</p>}</form>
  </section>;
}
