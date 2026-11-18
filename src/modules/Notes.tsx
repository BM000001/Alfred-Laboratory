import { useEffect, useState, type FormEvent } from 'react';
import { disciplineRepository, fileRepository } from '../storage/repositories';
import { EditDialog } from '../components/EditDialog';
import { createNoteService, type NoteScope } from './files/noteService';
import type { StoredFile } from './files/types';
import type { Discipline } from './studies/types';

const notes = createNoteService(fileRepository);

export function NoteEditor({ scope, chooseDiscipline, note, onClose, onSaved }: {
  scope: NoteScope;
  chooseDiscipline?: boolean;
  note?: StoredFile;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(note?.name ?? '');
  const [text, setText] = useState(note?.noteText ?? '');
  const [disciplineId, setDisciplineId] = useState('');
  const [disciplines, setDisciplines] = useState<Discipline[]>();
  const [targetsError, setTargetsError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!chooseDiscipline) return;
    let active = true;
    disciplineRepository.getAll().then((items) => {
      if (active) setDisciplines(items.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')));
    }).catch(() => { if (active) setTargetsError('Não foi possível carregar as disciplinas. Você pode salvar uma nota geral.'); });
    return () => { active = false; };
  }, [chooseDiscipline]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      if (disciplineId && !await disciplineRepository.getById(disciplineId)) throw new Error('A disciplina selecionada não está mais disponível.');
      await notes.save(chooseDiscipline ? { disciplineId: disciplineId || undefined } : scope, title, text, note?.id);
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar a anotação.');
      setBusy(false);
    }
  }

  return <EditDialog title={note ? 'Editar nota' : 'Nova nota'} onClose={onClose}>
    <form className="dialog-form" onSubmit={save} data-saving={busy || undefined}>
      <label htmlFor="note-title">Título da anotação</label>
      <input id="note-title" value={title} required maxLength={120} onChange={(event) => setTitle(event.target.value)} />
      <label htmlFor="note-text">Conteúdo</label>
      <textarea id="note-text" value={text} rows={6} maxLength={100000} onChange={(event) => setText(event.target.value)} />
      {chooseDiscipline && <>
        <label htmlFor="note-destination">Destino da nota</label>
        <select id="note-destination" value={disciplineId} onChange={(event) => setDisciplineId(event.target.value)}>
          <option value="">Nota geral</option>
          {disciplines?.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
        </select>
        {targetsError && <p role="status">{targetsError}</p>}
        {disciplines?.length === 0 && <p>Nenhuma disciplina cadastrada. A nota pode ser salva como geral.</p>}
      </>}
      {error && <p className="module-error" role="alert">{error}</p>}
      <button className="primary-action" disabled={busy} type="submit">Salvar anotação</button>
    </form>
  </EditDialog>;
}

export function Notes({ projectId, disciplineId, revision = 0 }: NoteScope & { revision?: number }) {
  const [items, setItems] = useState<StoredFile[]>([]);
  const [editing, setEditing] = useState<StoredFile>();
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const general = !projectId && !disciplineId;

  useEffect(() => {
    let active = true;
    notes.list({ projectId, disciplineId }).then((result) => { if (active) setItems(result); })
      .catch(() => { if (active) setError('Não foi possível carregar as notas.'); });
    return () => { active = false; };
  }, [projectId, disciplineId, revision, version]);

  const visible = items.filter((note) => `${note.name} ${note.noteText}`.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')));
  return <section className="note-index" aria-label={general ? 'Notas gerais' : 'Anotações'}>
    <h2>{general ? 'Notas gerais' : 'Anotações'}</h2>
    {error && <p className="module-error" role="alert">{error}</p>}
    {items.length > 0 && <input aria-label="Buscar anotações" placeholder="Buscar no caderno" value={query} onChange={(event) => setQuery(event.target.value)} />}
    {visible.map((note) => <button type="button" className="note-link" key={note.id} onClick={() => setEditing(note)}>
      <strong>{note.name}</strong><small>{note.noteText?.slice(0, 100) || 'Sem conteúdo'}</small>
    </button>)}
    {!visible.length && <p>{items.length ? 'Nenhuma nota encontrada.' : 'Nenhuma nota aqui. Use + para criar.'}</p>}
    {editing && <NoteEditor scope={{ projectId, disciplineId }} note={editing} onClose={() => setEditing(undefined)} onSaved={() => {
      setEditing(undefined);
      setVersion((current) => current + 1);
    }} />}
  </section>;
}
