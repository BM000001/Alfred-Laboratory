import { useState } from 'react';
import App from '../../app/App';
import { openAlfredDatabase, STORE_NAMES } from '../../storage/database';
import { STUDIES_DEMO_BASE } from '../../storage/namespace';
import { addAuthoredBank } from './authoredBank';
import { authoredActivities } from './authoredActivities';

const disciplineId = 'demo-programacao';
const topicId = 'demo-fundamentos';

async function prepareDemo() {
  if (import.meta.env.BASE_URL !== STUDIES_DEMO_BASE) throw new Error('Ambiente de demonstração inválido.');
  const db = await openAlfredDatabase();
  const createdAt = new Date().toISOString();
  const text = authoredActivities.map(scene => '## ' + scene.title + '\n' + scene.material + '\n' + scene.steps.map(s => s.explanation).join(' ')).join('\n\n');
  const blob = new Blob([text], {type:'text/markdown'});
  const raw = { format:'md', text, characterCount:text.length, wordCount:text.split(/\s+/).length, extractedAt:createdAt };
  const rows = [
    [STORE_NAMES.files, {id:'demo-reading', disciplineId, name:'Fundamentos.md', type:blob.type, size:blob.size,
      blob, createdAt, extraction:raw, processing:{version:1,profile:'printed',status:'completed',topicId,raw,stage:'Material autoral disponível'}}],
    [STORE_NAMES.disciplines, {id:disciplineId, name:'Programação · demonstração', createdAt}],
    [STORE_NAMES.studyTopics, {id:topicId,disciplineId,title:'Fundamentos',sourceFileId:'demo-reading',sourceFileName:'Fundamentos.md',status:'pending',createdAt}],
    ...authoredActivities.map(scene => [STORE_NAMES.studyFlashcards, {
      id:'demo-card-' + scene.id, disciplineId, topicId, front:scene.steps[0].prompt + '\n' + scene.material,
      back:scene.steps[0].explanation, sourceExcerpt:scene.material, createdAt, nextReviewAt:createdAt,
      reviewCount:0, intervalDays:0,
    }] as const),
  ] as const;
  try {
    await new Promise<void>((resolve,reject) => {
      const tx = db.transaction([...new Set(rows.map(([store]) => store))], 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error);
      for (const [name,row] of rows) {
        const store = tx.objectStore(name);
        const insert = store.add(row);
        insert.onerror = event => {
          if (insert.error?.name === 'ConstraintError') { event.preventDefault(); event.stopPropagation(); }
        };
      }
    });
  } finally { db.close(); }
  await addAuthoredBank(disciplineId,topicId);
}

export default function StudiesDemoEntry() {
  const [started,setStarted] = useState(false);
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState('');
  if (started) return <App />;
  async function start() {
    setLoading(true);
    try { await prepareDemo(); setStarted(true); }
    catch { setError('O navegador não conseguiu preparar os dados locais. Você pode abrir o aplicativo sem os exemplos.'); }
    finally { setLoading(false); }
  }
  return <main className="page"><h1>Alfred Laboratory</h1>
    <p>Prévia de Estudos com uma disciplina demonstrativa, 30 questões e 10 flashcards. Use apenas materiais sintéticos. A geração remota está desativada.</p>
    <button className="primary-action" type="button" onClick={() => void start()} disabled={loading}>Abrir com exemplos de programação</button>
    <button type="button" onClick={() => setStarted(true)} disabled={loading}>Abrir dados locais desta prévia</button>
    {loading && <p role="status">Preparando os exemplos…</p>}{error && <p role="alert">{error}</p>}
  </main>;
}
