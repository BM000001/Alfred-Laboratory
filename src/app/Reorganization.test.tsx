import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, expect, it } from 'vitest';
import App from './App';
import { create } from './testActions';
import { appointmentRepository, assistantMessageRepository, disciplineRepository, fileRepository, projectRepository, taskRepository } from '../storage/repositories';

const createdAt = new Date().toISOString();
const date = (year: number, month: string, day: string) => `${year}-${month}-${day}`;
const button = (name: string) => screen.getByRole('button', { name });
const fill = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

beforeEach(async () => {
  localStorage.clear();
  await Promise.all([appointmentRepository, assistantMessageRepository, disciplineRepository, fileRepository, projectRepository, taskRepository]
    .map((repository) => repository.clear()));
});

it('salva notas de Hoje nos destinos geral e disciplina, com uma única cópia após remontagem', async () => {
  await disciplineRepository.save({ id: 'historia', name: 'História', createdAt });
  const view = render(<App />);
  for (const [title, target] of [['Nota geral A', ''], ['Nota vinculada B', 'historia']]) {
    create('Nova nota');
    expect(screen.getByRole('dialog', { name: 'Nova nota' })).toBeVisible();
    expect(screen.getByLabelText('Destino da nota')).toHaveValue('');
    fill('Título da anotação', title);
    fill('Conteúdo', 'Conteúdo de teste.');
    if (target) {
      await screen.findByRole('option', { name: 'História' });
      fill('Destino da nota', target);
    }
    fireEvent.click(button('Salvar anotação'));
    await screen.findByText('Nota salva.');
  }
  const stored = await fileRepository.getAll();
  expect(stored).toHaveLength(2);
  expect(stored.find(({ name }) => name === 'Nota vinculada B')?.disciplineId).toBe('historia');
  expect(stored.find(({ name }) => name === 'Nota geral A')?.disciplineId).toBeUndefined();

  view.unmount();
  render(<App />);
  fireEvent.click(button('Organização'));
  fireEvent.click(screen.getByText('Notas gerais', { selector: 'summary' }));
  const general = await screen.findByRole('region', { name: 'Notas gerais' });
  expect(await within(general).findByText('Nota geral A')).toBeVisible();
  expect(within(general).queryByText('Nota vinculada B')).not.toBeInTheDocument();
  fireEvent.click(button('Aprender'));
  fireEvent.click(await screen.findByRole('button', { name: /História/ }));
  fireEvent.click(button('Anotações'));
  expect(await screen.findByText('Nota vinculada B')).toBeVisible();
  expect(screen.queryByText('Nota geral A')).not.toBeInTheDocument();
});

it('mantém a semana ao selecionar uma data e separa compromissos e tarefas por dia', async () => {
  const first = date(2026, '11', '18');
  const second = date(2026, '11', '19');
  for (const [day, suffix] of [[first, 'um'], [second, 'dois']]) {
    await appointmentRepository.save({ id: suffix, title: 'Evento ' + suffix, startsAt: day + 'T09:00:00', endsAt: day + 'T10:00:00', createdAt, type: 'class', status: 'scheduled' });
    await taskRepository.save({ id: suffix, title: 'Tarefa ' + suffix, dueDate: day, createdAt, status: 'pending', priority: 'medium' });
  }
  render(<App />);
  fireEvent.click(button('Organização'));
  fill('Data', first);
  expect(await screen.findByRole('heading', { name: 'Evento um' })).toBeVisible();
  expect(await screen.findByRole('button', { name: 'Tarefa um' })).toBeVisible();
  fireEvent.click(screen.getByRole('gridcell', { name: /^19\/11\/2026/ }));
  expect(screen.getByRole('grid', { name: 'Calendário semanal' })).toBeVisible();
  expect(await screen.findByRole('heading', { name: 'Evento dois' })).toBeVisible();
  expect(await screen.findByRole('button', { name: 'Tarefa dois' })).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Tarefa um' })).not.toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Evento um' })).not.toBeInTheDocument();
  create('Novo compromisso');
  expect(screen.getByLabelText('Início')).toHaveValue(second + 'T09:00');
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }));
  fireEvent.click(button('Próximo período'));
  expect(screen.getByRole('heading', { name: /22 de novembro de 2026/ })).toBeVisible();
  expect(screen.queryByRole('heading', { name: 'Hoje' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Foco' })).not.toBeInTheDocument();
});

it('abre projeto sem desmontar conversa, salva etapa e preserva as conversas após recarregar', async () => {
  await projectRepository.save({ id: 'sandbox', name: 'Projeto de teste', status: 'active', createdAt });
  await assistantMessageRepository.save({ id: 'legacy-message', role: 'user', content: 'Pergunta anterior', createdAt });
  const view = render(<App />);
  fireEvent.click(button('Alfred'));
  expect(await within(screen.getByRole('log')).findByText('Pergunta anterior')).toBeVisible();
  fill('Mensagem para Alfred', 'Rascunho da mensagem');
  fireEvent.click(button('Projetos'));
  fireEvent.click(await screen.findByRole('button', { name: 'Projeto de teste' }));
  create('Nova etapa');
  fill('Nome da etapa', 'Rever referências');
  fireEvent.click(button('Salvar etapa'));
  await screen.findByText('Alterações salvas.');
  fireEvent.click(button('Etapas'));
  expect(await screen.findByRole('checkbox', { name: 'Rever referências' })).toBeVisible();
  fireEvent.click(button('Conversa'));
  expect(screen.getByLabelText('Mensagem para Alfred')).toHaveValue('Rascunho da mensagem');
  create('Nova conversa');
  expect(await within(screen.getByRole('log')).findByText(/À sua disposição/)).toBeVisible();
  expect(within(screen.getByRole('log')).queryByText('Pergunta anterior')).not.toBeInTheDocument();
  view.unmount();
  render(<App />);
  fireEvent.click(button('Alfred'));
  fireEvent.click(screen.getByText('Histórico de conversas'));
  fireEvent.click(await screen.findByRole('button', { name: 'Pergunta anterior' }));
  expect(await within(screen.getByRole('log')).findByText('Pergunta anterior')).toBeVisible();
});
