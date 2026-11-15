import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AICentral } from './AICentral';
import { aiTaskRepository, aiCentralSettingsRepository, fileRepository } from '../../storage/repositories';
const text='Mitose: divisão celular que mantém o número de cromossomos.';
beforeEach(async()=>{
 vi.restoreAllMocks();await Promise.all([aiTaskRepository.clear(),aiCentralSettingsRepository.clear(),fileRepository.clear()]);
 await fileRepository.save({id:'file',name:'Biologia.txt',disciplineId:'biology',type:'text/plain',size:1,blob:new Blob(['x']),createdAt:new Date().toISOString(),extraction:{format:'txt',text,characterCount:text.length,wordCount:10,extractedAt:new Date().toISOString()}});
});
it('runs a real local analysis and restores its history on remount',async()=>{
 const network=vi.spyOn(globalThis,'fetch');const view=render(<AICentral/>);
 await screen.findByRole('option',{name:'Biologia.txt'});fireEvent.change(screen.getByLabelText('Material'),{target:{value:'file'}});
 fireEvent.click(screen.getByRole('button',{name:'Preparar solicitação'}));
 fireEvent.click(await screen.findByRole('button',{name:'Executar no dispositivo'}));
 await screen.findByText(/Tarefa concluída/);expect(network).not.toHaveBeenCalled();
 const tasks=await aiTaskRepository.getAll();expect(tasks).toHaveLength(1);expect(tasks[0].result?.analysis?.definitions).toHaveLength(1);
 view.unmount();render(<AICentral/>);expect(await screen.findByText(/Concluída · local/)).toBeInTheDocument();
});
it('keeps the gateway token out of persisted configuration and requires consent',async()=>{
 render(<AICentral/>);await screen.findByRole('option',{name:'Biologia.txt'});
 fireEvent.change(screen.getByLabelText('Endereço da Central'),{target:{value:'https://central.example'}});
 fireEvent.change(screen.getByLabelText('Token da Central'),{target:{value:'secret-test-token'}});
 fireEvent.click(screen.getByRole('button',{name:'Salvar endereço'}));await screen.findByText(/Endereço salvo/);
 expect(JSON.stringify(await aiCentralSettingsRepository.getById('central'))).not.toContain('secret-test-token');
 fireEvent.change(screen.getByLabelText('Material'),{target:{value:'file'}});fireEvent.change(screen.getByLabelText('Processamento'),{target:{value:'gateway'}});
 fireEvent.click(screen.getByRole('button',{name:'Preparar solicitação'}));
 expect(await screen.findByRole('button',{name:'Enviar esta solicitação'})).toBeDisabled();
 fireEvent.click(screen.getByLabelText(/Autorizo enviar/));expect(screen.getByRole('button',{name:'Enviar esta solicitação'})).toBeEnabled();
 fireEvent.change(screen.getByLabelText('Endereço da Central'),{target:{value:'https://another.example'}});
 await waitFor(()=>expect(screen.queryByRole('button',{name:'Enviar esta solicitação'})).not.toBeInTheDocument());
});
it('generates grounded local resources from a saved native text without older processing metadata',async()=>{
 render(<AICentral/>);await screen.findByRole('option',{name:'Biologia.txt'});
 fireEvent.change(screen.getByLabelText('Material'),{target:{value:'file'}});fireEvent.change(screen.getByLabelText('Solicitação'),{target:{value:'studies.generate'}});
 fireEvent.click(screen.getByRole('button',{name:'Preparar solicitação'}));fireEvent.click(await screen.findByRole('button',{name:'Executar no dispositivo'}));
 await screen.findByText(/Tarefa concluída/);const [task]=await aiTaskRepository.getAll();expect(task.result?.resources?.flashcards).toHaveLength(1);
});
