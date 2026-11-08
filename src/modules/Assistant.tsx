import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { ActionProposal, ApprovalDecision, AssistantMessage, ToolDefinition } from './assistant/contracts';
import './assistant/assistant.css';
import { ActionApprovalError, executeApprovedProposal } from './assistant/actionApproval';
import { prepareTaskCompletion } from './assistant/actionProposals';
import { prepareTaskCreation } from './assistant/taskCreationProposals';
import { prepareTaskPriorityUpdate } from './assistant/taskUpdateProposals';
import { prepareTaskDueDateUpdate } from './assistant/taskDueDateProposals';
import { prepareTaskDescriptionUpdate } from './assistant/taskDescriptionProposals';
import type { Task, TaskPriority } from './tasks/types';
import { LocalAssistantProvider } from './assistant/localAssistant';
import { Brain } from './brain';
import { AssistantMemoryPanel } from './AssistantMemoryPanel';
import { ManualExportPanel } from './ManualExportPanel';
import { appointmentRepository, assistantMessageRepository, memoryRepository, studyTopicRepository, taskRepository } from '../storage/repositories';

function createMessage(role: AssistantMessage['role'], content: string): AssistantMessage {
  return { id: crypto.randomUUID(), role, content, createdAt: new Date().toISOString() };
}

type PendingTaskProposal =
  | { action: 'complete'; task: Task; proposal: ActionProposal }
  | { action: 'create'; taskId: string; taskTitle: string; priority: TaskPriority; proposal: ActionProposal }
  | { action: 'priority'; task: Task; priority: TaskPriority; proposal: ActionProposal }
  | { action: 'due-date'; task: Task; dueDate: string; proposal: ActionProposal }
  | { action: 'description'; task: Task; description: string; proposal: ActionProposal };

export function Assistant() {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [historyReady, setHistoryReady] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [approving, setApproving] = useState(false);
  const [pendingProposal, setPendingProposal] = useState<PendingTaskProposal | null>(null);
  const [error, setError] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const recentTaskIdRef = useRef<string | null>(null);
  const persistenceQueueRef = useRef<Promise<void>>(Promise.resolve());

  const welcomeMessage = 'À sua disposição. Posso consultar suas tarefas pendentes, próximos compromissos e progresso dos estudos, além de preparar propostas para criar, concluir, ajustar prioridades, definir prazos e editar descrições de tarefas. Nenhuma alteração será feita sem sua confirmação explícita.';

  useEffect(() => {
    let active = true;
    assistantMessageRepository.getAll().then(async (saved) => {
      if (!active) return;
      const ordered = saved.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const retained = ordered.slice(-200);
      const expired = ordered.slice(0, Math.max(0, ordered.length - retained.length));
      await Promise.all(expired.map((message) => assistantMessageRepository.delete(message.id)));
      if (!active) return;
      setMessages(retained.length ? [
        ...retained,
        createMessage('assistant', 'Conversa anterior recuperada. Propostas de alteração que estavam aguardando confirmação não são retomadas após recarregar a página; se necessário, solicite-as novamente.'),
      ] : [createMessage('assistant', welcomeMessage)]);
      setHistoryReady(true);
    }).catch(() => {
      if (!active) return;
      setMessages([createMessage('assistant', welcomeMessage)]);
      setHistoryReady(true);
      setError('Não foi possível recuperar o histórico local. Você pode continuar, mas a conversa desta sessão talvez não seja salva.');
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!historyReady || messages.length === 0) return;
    const retained = messages.slice(-200);
    persistenceQueueRef.current = persistenceQueueRef.current
      .then(async () => { await Promise.all(retained.map((message) => assistantMessageRepository.save(message))); })
      .catch(() => setError('Não foi possível salvar o histórico da conversa neste dispositivo.'));
  }, [messages, historyReady]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages, loading, pendingProposal]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = input.trim();
    if (!content || !historyReady || loading || approving) return;
    const userMessage = createMessage('user', content);
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);
    setError('');
    try {
      const [tasks, appointments, topics, memories] = await Promise.all([
        taskRepository.getAll(), appointmentRepository.getAll(), studyTopicRepository.getAll(), memoryRepository.getAll(),
      ]);
      const priorityUpdate = prepareTaskPriorityUpdate(content, tasks, { referenceTaskId: recentTaskIdRef.current });
      if (priorityUpdate.kind === 'proposal') {
        setPendingProposal({ action: 'priority', task: priorityUpdate.task, priority: priorityUpdate.priority, proposal: priorityUpdate.proposal });
        setMessages((current) => [...current, createMessage('assistant', 'Preparei uma proposta para alterar a prioridade. Confira os detalhes e confirme se deseja salvar.')]);
        return;
      }
      if (priorityUpdate.kind === 'not-found') {
        setMessages((current) => [...current, createMessage('assistant', 'Não encontrei “' + priorityUpdate.taskTitle + '”. Não alterei nenhuma tarefa.')]);
        return;
      }
      if (priorityUpdate.kind === 'ambiguous') {
        setMessages((current) => [...current, createMessage('assistant', 'Encontrei ' + priorityUpdate.matches + ' tarefas chamadas “' + priorityUpdate.taskTitle + '”. Não vou escolher uma delas automaticamente.')]);
        return;
      }
      if (priorityUpdate.kind === 'already-set') {
        setMessages((current) => [...current, createMessage('assistant', 'A tarefa “' + priorityUpdate.task.title + '” já está com essa prioridade.')]);
        return;
      }

      const descriptionUpdate = prepareTaskDescriptionUpdate(content, tasks, { referenceTaskId: recentTaskIdRef.current });
      if (descriptionUpdate.kind === 'proposal') {
        setPendingProposal({ action: 'description', task: descriptionUpdate.task, description: descriptionUpdate.description, proposal: descriptionUpdate.proposal });
        setMessages((current) => [...current, createMessage('assistant', 'Preparei uma proposta para atualizar a descrição. Confira o texto e confirme se deseja salvar.')]);
        return;
      }
      if (descriptionUpdate.kind === 'not-found') {
        setMessages((current) => [...current, createMessage('assistant', 'Não encontrei “' + descriptionUpdate.taskTitle + '”. Não alterei nenhuma tarefa.')]);
        return;
      }
      if (descriptionUpdate.kind === 'ambiguous') {
        setMessages((current) => [...current, createMessage('assistant', 'Encontrei ' + descriptionUpdate.matches + ' tarefas chamadas “' + descriptionUpdate.taskTitle + '”. Não vou escolher uma delas automaticamente.')]);
        return;
      }
      if (descriptionUpdate.kind === 'already-set') {
        setMessages((current) => [...current, createMessage('assistant', 'A tarefa “' + descriptionUpdate.task.title + '” já possui essa descrição.')]);
        return;
      }
      if (descriptionUpdate.kind === 'invalid-description') {
        setMessages((current) => [...current, createMessage('assistant', 'A descrição precisa conter entre 1 e 500 caracteres.')]);
        return;
      }

      const dueDateUpdate = prepareTaskDueDateUpdate(content, tasks, { referenceTaskId: recentTaskIdRef.current });
      if (dueDateUpdate.kind === 'proposal') {
        setPendingProposal({ action: 'due-date', task: dueDateUpdate.task, dueDate: dueDateUpdate.dueDate, proposal: dueDateUpdate.proposal });
        setMessages((current) => [...current, createMessage('assistant', 'Preparei uma proposta para definir o prazo. Confira a data e confirme se deseja salvar.')]);
        return;
      }
      if (dueDateUpdate.kind === 'not-found') {
        setMessages((current) => [...current, createMessage('assistant', 'Não encontrei “' + dueDateUpdate.taskTitle + '”. Não alterei nenhuma tarefa.')]);
        return;
      }
      if (dueDateUpdate.kind === 'ambiguous') {
        setMessages((current) => [...current, createMessage('assistant', 'Encontrei ' + dueDateUpdate.matches + ' tarefas chamadas “' + dueDateUpdate.taskTitle + '”. Não vou escolher uma delas automaticamente.')]);
        return;
      }
      if (dueDateUpdate.kind === 'already-set') {
        setMessages((current) => [...current, createMessage('assistant', 'A tarefa “' + dueDateUpdate.task.title + '” já possui esse prazo.')]);
        return;
      }
      if (dueDateUpdate.kind === 'invalid-date') {
        setMessages((current) => [...current, createMessage('assistant', 'Não consegui interpretar essa data com segurança. Informe uma data válida, como 10/11/2026.')]);
        return;
      }

      const preparation = prepareTaskCompletion(content, tasks, { referenceTaskId: recentTaskIdRef.current });
      if (preparation.kind === 'proposal') {
        setPendingProposal({ action: 'complete', task: preparation.task, proposal: preparation.proposal });
        setMessages((current) => [...current, createMessage('assistant', 'Preparei uma proposta. Revise os detalhes abaixo e confirme somente se quiser executar a alteração.')]);
        return;
      }
      if (preparation.kind === 'not-found') {
        setMessages((current) => [...current, createMessage('assistant', `Não encontrei uma tarefa com o título exato “${preparation.taskTitle}”. Para evitar alterar a tarefa errada, não criei uma proposta.`)]);
        return;
      }
      if (preparation.kind === 'ambiguous') {
        setMessages((current) => [...current, createMessage('assistant', `Encontrei ${preparation.matches} tarefas chamadas “${preparation.taskTitle}”. Renomeie uma delas para diferenciá-las; não vou escolher por conta própria.`)]);
        return;
      }
      if (preparation.kind === 'already-completed') {
        setMessages((current) => [...current, createMessage('assistant', `A tarefa “${preparation.task.title}” já está concluída. Nenhuma alteração foi feita.`)]);
        return;
      }

      const creation = prepareTaskCreation(content, tasks);
      if (creation.kind === 'proposal') {
        setPendingProposal({
          action: 'create', taskId: creation.taskId, taskTitle: creation.taskTitle,
          priority: creation.priority, proposal: creation.proposal,
        });
        setMessages((current) => [...current, createMessage('assistant', 'Preparei uma proposta para criar a tarefa. Confira o título e a prioridade antes de confirmar.')]);
        return;
      }
      if (creation.kind === 'already-exists') {
        setMessages((current) => [...current, createMessage('assistant', 'Já existe uma tarefa chamada “' + creation.taskTitle + '”. Não criei uma duplicata.')]);
        return;
      }
      if (creation.kind === 'invalid-title') {
        setMessages((current) => [...current, createMessage('assistant', creation.reason)]);
        return;
      }
      const provider = new LocalAssistantProvider({ tasks, appointments, topics }, memories);
      const brain = new Brain({ provider });
      const response = await brain.process(nextMessages, {
        locale: 'pt-BR',
        now: new Date().toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'local',
      });
      setMessages((current) => [...current, createMessage('assistant', response.message)]);
    } catch {
      setError('Não consegui acessar seus dados locais. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  async function approveProposal() {
    if (!pendingProposal || approving || loading) return;
    const pending = pendingProposal;
    const proposal = pending.proposal;
    setApproving(true);
    setError('');
    const completeTaskTool: ToolDefinition<unknown, unknown> = {
      id: 'tasks.complete',
      description: 'Marca uma tarefa pendente como concluída.',
      risk: 'write',
      approval: 'explicit-confirmation',
      async execute(input) {
        if (typeof input !== 'object' || input === null || !('id' in input) || typeof input.id !== 'string') {
          throw new ActionApprovalError('Entrada inválida para concluir a tarefa.');
        }
        const current = await taskRepository.getById(input.id);
        if (!current) throw new ActionApprovalError('A tarefa não existe mais. Atualize os dados e tente novamente.');
        if (current.status !== 'pending') throw new ActionApprovalError('A tarefa já foi alterada. Nenhuma nova alteração foi feita.');
        await taskRepository.save({ ...current, status: 'completed' });
        return { id: current.id, title: current.title, status: 'completed' };
      },
    };
    const updatePriorityTool: ToolDefinition<unknown, unknown> = {
      id: 'tasks.update-priority',
      description: 'Altera a prioridade de uma tarefa existente.',
      risk: 'write',
      approval: 'explicit-confirmation',
      async execute(input) {
        if (typeof input !== 'object' || input === null) throw new ActionApprovalError('Entrada inválida para alterar a prioridade.');
        const record = input as Record<string, unknown>;
        if (typeof record.id !== 'string' || (record.priority !== 'low' && record.priority !== 'medium' && record.priority !== 'high') || (record.expectedPriority !== 'low' && record.expectedPriority !== 'medium' && record.expectedPriority !== 'high')) {
          throw new ActionApprovalError('Os dados da alteração de prioridade são inválidos.');
        }
        const current = await taskRepository.getById(record.id);
        if (!current) throw new ActionApprovalError('A tarefa não existe mais. Nenhuma alteração foi feita.');
        if (current.priority !== record.expectedPriority) throw new ActionApprovalError('A prioridade dessa tarefa foi alterada desde a proposta. Consulte novamente antes de tentar outra mudança.');
        await taskRepository.save({ ...current, priority: record.priority });
        return { id: current.id, title: current.title, priority: record.priority };
      },
    };
    const updateDueDateTool: ToolDefinition<unknown, unknown> = {
      id: 'tasks.update-due-date',
      description: 'Define ou altera o prazo de uma tarefa existente.',
      risk: 'write',
      approval: 'explicit-confirmation',
      async execute(input) {
        if (typeof input !== 'object' || input === null) throw new ActionApprovalError('Entrada inválida para alterar o prazo.');
        const record = input as Record<string, unknown>;
        const dueDate = record.dueDate;
        const validDate = typeof dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dueDate) &&
          !Number.isNaN(Date.parse(dueDate + 'T00:00:00Z')) &&
          new Date(dueDate + 'T00:00:00Z').toISOString().slice(0, 10) === dueDate;
        if (typeof record.id !== 'string' || !validDate ||
            !(record.expectedDueDate === null || typeof record.expectedDueDate === 'string')) {
          throw new ActionApprovalError('Os dados do prazo são inválidos.');
        }
        const current = await taskRepository.getById(record.id);
        if (!current) throw new ActionApprovalError('A tarefa não existe mais. Nenhuma alteração foi feita.');
        if ((current.dueDate ?? null) !== record.expectedDueDate) throw new ActionApprovalError('O prazo dessa tarefa foi alterado desde a proposta. Consulte novamente antes de tentar outra mudança.');
        await taskRepository.save({ ...current, dueDate });
        return { id: current.id, title: current.title, dueDate };
      },
    };
    const updateDescriptionTool: ToolDefinition<unknown, unknown> = {
      id: 'tasks.update-description',
      description: 'Atualiza a descrição de uma tarefa existente.',
      risk: 'write',
      approval: 'explicit-confirmation',
      async execute(input) {
        if (typeof input !== 'object' || input === null) throw new ActionApprovalError('Entrada inválida para atualizar a descrição.');
        const record = input as Record<string, unknown>;
        if (typeof record.id !== 'string' || typeof record.description !== 'string' || !record.description.trim() ||
            record.description.length > 500 || !(record.expectedDescription === null || typeof record.expectedDescription === 'string')) {
          throw new ActionApprovalError('A descrição deve conter entre 1 e 500 caracteres.');
        }
        const current = await taskRepository.getById(record.id);
        if (!current) throw new ActionApprovalError('A tarefa não existe mais. Nenhuma alteração foi feita.');
        if ((current.description ?? null) !== record.expectedDescription) throw new ActionApprovalError('A descrição foi alterada desde a proposta. Consulte novamente antes de tentar outra mudança.');
        await taskRepository.save({ ...current, description: record.description.trim() });
        return { id: current.id, title: current.title, description: record.description.trim() };
      },
    };
    const createTaskTool: ToolDefinition<unknown, unknown> = {
      id: 'tasks.create',
      description: 'Cria uma tarefa pendente.',
      risk: 'write',
      approval: 'explicit-confirmation',
      async execute(input) {
        if (typeof input !== 'object' || input === null) throw new ActionApprovalError('Entrada inválida para criar a tarefa.');
        const record = input as Record<string, unknown>;
        const id = record.id;
        const title = record.title;
        const priority = record.priority;
        if (typeof id !== 'string' || typeof title !== 'string' || !title.trim() || title.length > 120 ||
            (priority !== 'low' && priority !== 'medium' && priority !== 'high')) {
          throw new ActionApprovalError('Os dados da nova tarefa são inválidos.');
        }
        if (await taskRepository.getById(id)) throw new ActionApprovalError('O identificador da nova tarefa já está em uso.');
        const existing = await taskRepository.getAll();
        if (existing.some((item) => item.title.toLocaleLowerCase('pt-BR') === title.toLocaleLowerCase('pt-BR'))) {
          throw new ActionApprovalError('Já existe uma tarefa com esse título. Nenhuma tarefa nova foi criada.');
        }
        const created: Task = {
          id, title: title.trim(), priority: priority as TaskPriority,
          status: 'pending', createdAt: new Date().toISOString(),
        };
        await taskRepository.save(created);
        return created;
      },
    };
    const tools = pending.action === 'complete' ? [completeTaskTool] : pending.action === 'create' ? [createTaskTool] : pending.action === 'priority' ? [updatePriorityTool] : pending.action === 'due-date' ? [updateDueDateTool] : [updateDescriptionTool];
    const decision: ApprovalDecision = {
      proposalId: proposal.id,
      approved: true,
      decidedAt: new Date().toISOString(),
    };
    try {
      await executeApprovedProposal(proposal, decision, tools);
      setPendingProposal(null);
      if (pending.action === 'complete') {
        recentTaskIdRef.current = pending.task.id;
        setMessages((current) => [...current, createMessage('assistant', 'Confirmado. A tarefa “' + pending.task.title + '” foi marcada como concluída.')]);
      } else if (pending.action === 'create') {
        recentTaskIdRef.current = pending.taskId;
        setMessages((current) => [...current, createMessage('assistant', 'Confirmado. A tarefa “' + pending.taskTitle + '” foi criada com prioridade média e adicionada às pendências.')]);
      } else if (pending.action === 'priority') {
        recentTaskIdRef.current = pending.task.id;
        const label = pending.priority === 'high' ? 'alta' : pending.priority === 'low' ? 'baixa' : 'média';
        setMessages((current) => [...current, createMessage('assistant', 'Confirmado. A prioridade de “' + pending.task.title + '” agora é ' + label + '.')]);
      } else if (pending.action === 'due-date') {
        recentTaskIdRef.current = pending.task.id;
        const [year, month, day] = pending.dueDate.split('-').map(Number);
        const label = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, day)));
        setMessages((current) => [...current, createMessage('assistant', 'Confirmado. O prazo de “' + pending.task.title + '” foi definido para ' + label + '.')]);
      } else {
        recentTaskIdRef.current = pending.task.id;
        setMessages((current) => [...current, createMessage('assistant', 'Confirmado. A descrição de “' + pending.task.title + '” foi atualizada.')]);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível executar a ação. Nenhuma confirmação de sucesso foi registrada.');
    } finally {
      setApproving(false);
    }
  }
  async function clearConversation() {
    if (!confirmClear || loading || approving || pendingProposal) return;
    try {
      await persistenceQueueRef.current;
      await assistantMessageRepository.clear();
      recentTaskIdRef.current = null;
      setMessages([createMessage('assistant', welcomeMessage)]);
      setConfirmClear(false);
      setError('');
    } catch {
      setError('Não foi possível concluir a exclusão do histórico local. Tente novamente.');
    }
  }

  function cancelProposal() {
    if (!pendingProposal || approving) return;
    const title = pendingProposal.action === 'create' ? pendingProposal.taskTitle : pendingProposal.task.title;
    setPendingProposal(null);
    setMessages((current) => [...current, createMessage('assistant', `Proposta cancelada. “${title}” continua sem alterações.`)]);
  }

  return (
    <section className="assistant-module" aria-label="Assistente Alfred">
      <header className="assistant-heading">
        <div><span className="card-label">ALFRED · ASSISTENTE</span><h2>Como posso ajudar?</h2><p>Modo local: seus dados permanecem neste dispositivo. Para usar uma IA externa, utilize a exportação manual após revisar e autorizar o conteúdo.</p></div>
        <div className="assistant-heading-actions">
          <span className="assistant-status"><i aria-hidden="true" /> Local</span>
          <button type="button" className="secondary-action" onClick={() => setConfirmClear(true)} disabled={!historyReady || loading || approving || pendingProposal !== null}>Limpar conversa</button>
        </div>
      </header>
      <AssistantMemoryPanel />
      <ManualExportPanel />
      {!historyReady && <p className="assistant-loading" role="status">Recuperando conversa local…</p>}
      <div className="assistant-capabilities" aria-label="Consultas disponíveis">
        <span>Tarefas pendentes</span><span>Próximos compromissos</span><span>Progresso dos estudos</span><span>Criar tarefa com confirmação</span><span>Concluir tarefa com confirmação</span><span>Alterar prioridade com confirmação</span><span>Definir prazos com confirmação</span><span>Editar descrições com confirmação</span>
      </div>
      {messages.length === 1 && (
        <div className="assistant-suggestions" aria-label="Sugestões para começar">
          <span className="assistant-suggestions-label">EXPERIMENTE PERGUNTAR</span>
          <div className="assistant-suggestion-list">
            {[
              'Quais tarefas estão pendentes?',
              'Quais são meus próximos compromissos?',
              'Como está meu progresso nos estudos?',
              'O que você lembra sobre mim?',
            ].map((suggestion) => (
              <button key={suggestion} type="button" onClick={() => setInput(suggestion)} disabled={loading || approving}>
                <span aria-hidden="true">↗</span>{suggestion}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="assistant-conversation" role="log" aria-live="polite" aria-relevant="additions">
        {messages.map((message) => (
          <article className={`assistant-message ${message.role === 'user' ? 'from-user' : 'from-alfred'}`} key={message.id}>
            <span>{message.role === 'user' ? 'Você' : 'Alfred'}</span>
            <p>{message.content}</p>
          </article>
        ))}
        {loading && <p className="assistant-loading" role="status">Consultando seus dados locais…</p>}
        <div ref={endRef} />
      </div>
      {confirmClear && (
        <section className="assistant-proposal" aria-labelledby="assistant-clear-title">
          <span className="card-label">AÇÃO DE PRIVACIDADE</span>
          <h3 id="assistant-clear-title">Apagar histórico desta conversa?</h3>
          <p>As mensagens armazenadas neste dispositivo serão apagadas. Isso não altera tarefas, compromissos, estudos ou arquivos.</p>
          <div className="assistant-proposal-actions">
            <button type="button" className="secondary-action" onClick={() => setConfirmClear(false)}>Manter histórico</button>
            <button type="button" className="primary-action" onClick={clearConversation}>Apagar histórico</button>
          </div>
        </section>
      )}
      {pendingProposal && (
        <section className="assistant-proposal" aria-labelledby="assistant-proposal-title" aria-describedby="assistant-proposal-description">
          <span className="card-label">CONFIRMAÇÃO NECESSÁRIA</span>
          <h3 id="assistant-proposal-title">{pendingProposal.proposal.title}</h3>
          <p id="assistant-proposal-description">{pendingProposal.proposal.explanation}</p>
          <div className="assistant-proposal-record"><span>{pendingProposal.action === 'create' ? 'Nova tarefa' : 'Tarefa afetada'}</span><strong>{pendingProposal.action === 'create' ? pendingProposal.taskTitle : pendingProposal.task.title}</strong></div>
          {pendingProposal.action === 'due-date' && <div className="assistant-proposal-record"><span>Novo prazo</span><strong>{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(pendingProposal.dueDate + 'T00:00:00Z'))}</strong></div>}
          {pendingProposal.action === 'description' && <div className="assistant-proposal-record"><span>Nova descrição</span><strong>{pendingProposal.description}</strong></div>}
          <p className="assistant-proposal-warning">Nada será alterado até você selecionar “Confirmar alteração”.</p>
          <div className="assistant-proposal-actions">
            <button type="button" className="secondary-action" onClick={cancelProposal} disabled={approving}>Cancelar</button>
            <button type="button" className="primary-action" onClick={approveProposal} disabled={approving || loading}>{approving ? 'Salvando…' : 'Confirmar alteração'}</button>
          </div>
        </section>
      )}
      {error && <p className="module-error" role="alert">{error}</p>}
      <form className="assistant-composer" onSubmit={submit}>
        <label className="sr-only" htmlFor="assistant-prompt">Mensagem para Alfred</label>
        <input id="assistant-prompt" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ex.: Quais tarefas estão pendentes?" maxLength={500} disabled={!historyReady || loading || approving || pendingProposal !== null} />
        <button type="submit" className="primary-action" disabled={!historyReady || loading || approving || pendingProposal !== null || !input.trim()}>Enviar</button>
      </form>
      <p className="assistant-disclaimer">O modo local consulta somente dados deste dispositivo. Nenhuma mensagem é enviada automaticamente para serviços externos. Para usar outro modelo de IA, utilize a exportação manual, revise o conteúdo e faça o envio por sua própria conta. Alterações em tarefas continuam exigindo confirmação explícita.</p>
    </section>
  );
}
