import { useEffect, useState, type FormEvent } from 'react';
import { memoryRepository } from '../storage/repositories';
import { createMemory, deleteMemory, listMemories, updateMemory } from './memory/memoryService';
import type { AssistantMemory, MemoryCategory } from './memory/types';
const labels: Record<MemoryCategory,string> = { preference:'Preferência', goal:'Objetivo', project:'Projeto', routine:'Rotina', other:'Outro' };
export function AssistantMemoryPanel() {
 const [memories,setMemories]=useState<AssistantMemory[]>([]); const [expanded,setExpanded]=useState(false);
 const [editingId,setEditingId]=useState<string|null>(null); const [title,setTitle]=useState(''); const [content,setContent]=useState('');
 const [category,setCategory]=useState<MemoryCategory>('preference'); const [busy,setBusy]=useState(false); const [error,setError]=useState(''); const [feedback,setFeedback]=useState('');
 async function refresh(){ setMemories(await listMemories(memoryRepository)); }
 useEffect(()=>{ void refresh().catch(()=>setError('Não foi possível carregar as memórias locais.')); },[]);
 function reset(){setEditingId(null);setTitle('');setContent('');setCategory('preference');}
 async function save(event:FormEvent<HTMLFormElement>){event.preventDefault();if(busy)return;setBusy(true);setError('');setFeedback('');
  try{const input={title,content,category};if(editingId)await updateMemory(memoryRepository,editingId,input);else await createMemory(memoryRepository,input);await refresh();setFeedback(editingId?'Memória atualizada.':'Memória salva neste dispositivo.');reset();}
  catch(cause){setError(cause instanceof Error?cause.message:'Não foi possível salvar a memória.');}finally{setBusy(false);}}
 async function remove(memory:AssistantMemory){if(!window.confirm(`Apagar a memória “${memory.title}” deste dispositivo?`))return;setError('');setFeedback('');
  try{await deleteMemory(memoryRepository,memory.id);await refresh();if(editingId===memory.id)reset();setFeedback('Memória apagada.');}
  catch(cause){setError(cause instanceof Error?cause.message:'Não foi possível apagar a memória.');}}
 function edit(memory:AssistantMemory){setEditingId(memory.id);setTitle(memory.title);setContent(memory.content);setCategory(memory.category);setExpanded(true);setError('');setFeedback('');}
 return <section className="assistant-memory-panel" aria-label="Memórias do Alfred">
  <button className="assistant-memory-toggle" type="button" aria-expanded={expanded} onClick={()=>setExpanded(value=>!value)}>
   <span><strong>Memórias do Alfred</strong><small>{memories.length} {memories.length===1?'registro salvo':'registros salvos'} · somente neste dispositivo</small></span><span aria-hidden="true">{expanded?'−':'+'}</span>
  </button>
  {expanded&&<div className="assistant-memory-content">
   <p>Registre manualmente preferências, objetivos, rotinas e fatos de projetos para consultar depois. Nada é aprendido ou salvo automaticamente.</p>
   <p className="assistant-memory-privacy">Não salve senhas, documentos, dados médicos ou outras informações sensíveis. As memórias ficam no IndexedDB deste dispositivo e não são enviadas a serviços externos.</p>
   <form className="assistant-memory-form" onSubmit={save}>
    <label htmlFor="memory-title">Título</label><input id="memory-title" value={title} onChange={e=>setTitle(e.target.value)} maxLength={80} required placeholder="Ex.: Como prefiro organizar meus estudos" disabled={busy}/>
    <label htmlFor="memory-category">Categoria</label><select id="memory-category" value={category} onChange={e=>setCategory(e.target.value as MemoryCategory)} disabled={busy}>{Object.entries(labels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>
    <label htmlFor="memory-content">O que Alfred deve lembrar?</label><textarea id="memory-content" value={content} onChange={e=>setContent(e.target.value)} maxLength={500} rows={3} required placeholder="Escreva apenas o que deseja guardar." disabled={busy}/>
    <div className="assistant-memory-form-footer"><small>{content.length}/500</small><div>{editingId&&<button className="secondary-action" type="button" onClick={reset} disabled={busy}>Cancelar edição</button>}<button className="primary-action" type="submit" disabled={busy||!title.trim()||!content.trim()}>{busy?'Salvando…':editingId?'Salvar alterações':'Salvar memória'}</button></div></div>
   </form>
   {memories.length?<ul className="assistant-memory-list">{memories.map(memory=><li key={memory.id}><div><span>{labels[memory.category]}</span><strong>{memory.title}</strong><p>{memory.content}</p></div><div className="assistant-memory-actions"><button type="button" onClick={()=>edit(memory)} aria-label={`Editar ${memory.title}`}>Editar</button><button type="button" onClick={()=>void remove(memory)} aria-label={`Apagar ${memory.title}`}>Apagar</button></div></li>)}</ul>:<p className="assistant-memory-empty">Nenhuma memória cadastrada.</p>}
   {error&&<p className="module-error" role="alert">{error}</p>}{feedback&&<p className="module-feedback" role="status">{feedback}</p>}
  </div>}
 </section>;
}
