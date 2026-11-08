# Roadmap — Alfred

O roadmap descreve o estado verificável do produto. Uma funcionalidade só é considerada concluída quando está implementada e coberta por validação adequada; testes automatizados não substituem testes em dispositivo real.

## Etapa 1 — Fundação técnica
- [x] React, TypeScript, Vite e Vitest.
- [x] Estrutura modular e persistência local com IndexedDB.
- [x] Navegação responsiva e aplicação PWA.
- [x] Pipeline de CI para instalação, auditoria, testes e build.
- [ ] Revisão visual e funcional em dispositivos reais.

## Etapa 2 — Organização pessoal
- [x] Cadastro e gerenciamento de tarefas, prioridades, estados, filtros e progresso.
- [x] Projetos e organização das tarefas.
- [x] Backup e restauração JSON com prévia e confirmação.
- [x] Exportação de backup protegida por senha.
- [x] Testes automatizados das regras principais.

## Etapa 3 — Agenda e estudos
- [x] Cadastro e gerenciamento local de compromissos.
- [x] Visões de agenda Dia, Semana e Mês.
- [x] Detecção de conflitos de horário.
- [x] Importação de arquivos iCalendar (.ics), com prévia e confirmação.
- [x] Disciplinas, tópicos, anotações, conclusão e acompanhamento de progresso.
- [ ] Sincronização direta com provedores de calendário — não implementada; a importação .ics é manual.
- [ ] Tratamento de eventos recorrentes na importação — atualmente ignorados com aviso.

## Etapa 3A — Central de Estudos completa
- [x] Biblioteca de arquivos local com vínculo a disciplinas e limite de 10 MB por arquivo.
- [x] Extração e pré-visualização local de TXT, MD, CSV, JSON e PDFs com camada de texto.
- [x] Persistência do texto extraído por arquivo no IndexedDB.
- [x] Geração assistida pelo Adaptador Manual: prompt exportável, resposta colada e salva pelo usuário.
- [x] Importação de respostas JSON estruturadas em flashcards e questões, com prévia e prevenção de duplicatas.
- [x] Flashcards interativos com fila de revisão e agendamento inicial de repetição espaçada.
- [x] Banco de questões e simulados com filtros por disciplina/dificuldade e ordem aleatória.
- [x] Desempenho por assunto e conversão de questões erradas em flashcards.
- [ ] OCR local para PDFs digitalizados — implementação em andamento na branch `feat/studies-local-pdf-ocr`; usa Tesseract.js com worker, WebAssembly e modelo português servidos pelo próprio Alfred, limite de 20 páginas por operação e cache offline após o primeiro uso. Pendente de CI, revisão de assets e teste real em iPhone.
- [ ] Extração local de DOCX e PPTX.
- [ ] Repetição espaçada mais robusta, com calibração por histórico real de acertos.
- [ ] Testes de ponta a ponta da Central de Estudos em iPhone/Safari.

## Etapa 4 — Painel e produtividade
- [x] Painel com pendências, atrasos, próximos compromissos e briefing diário.
- [x] Pomodoro e histórico de sessões.
- [x] Alertas e recomendações locais explicáveis.
- [ ] Preferências avançadas configuráveis para todos os alertas e rotinas.
- [ ] Validação de usabilidade e acessibilidade em dispositivos reais.

## Etapa 5 — Assistente local e contexto
- [x] Interface conversacional conectada aos dados locais.
- [x] Consultas locais de tarefas, agenda e progresso dos estudos.
- [x] Histórico local de conversas, com limite e ação explícita para apagar.
- [x] Memórias estruturadas cadastradas manualmente e recuperadas por correspondência lexical explicável.
- [x] Propostas de alteração de tarefas com confirmação explícita.
- [x] Portão de exportação manual, revisão do conteúdo e consentimento por classe de dados.
- [ ] Busca semântica — não implementada; a recuperação atual é lexical.
- [ ] Extração automática de memórias — não implementada.
- [ ] Modelo de IA generativa conectado — não há provedor remoto ativo.
- [ ] Resumos e recomendações generativas com fontes e incertezas.

## Etapa 6 — Protocolo Tático e integrações
- [x] Fundamentos de propostas, validação e aprovação explícita de ações.
- [ ] Reorganização de agenda/tarefas após imprevistos, com simulação e justificativas.
- [ ] Aprovação em lote e revisão de impactos.
- [ ] Integrações externas avaliadas individualmente, sempre com minimização de dados e consentimento.
- [x] Hospedagem estática via GitHub Pages; nenhuma dependência obrigatória de backend remoto.

## Etapa 7 — Experiência avançada e confiabilidade
- [x] Manifesto PWA e service worker.
- [x] Instruções de instalação e roteiro de 11 testes manuais no iPhone.
- [ ] Executar e registrar os testes manuais no Safari/iPhone.
- [ ] Verificar persistência após períodos prolongados sem abrir o app.
- [ ] Revisar acessibilidade, desempenho, segurança e licenças de dependências/assets.
- [ ] Avaliar notificações configuráveis e comandos por voz, sem comprometer privacidade.

## Próximas prioridades
1. Confirmar a conclusão do CI e da publicação da última integração da Central de Estudos; não considerar publicada enquanto os workflows estiverem pendentes.
2. Validar o OCR local em CI, medir o peso dos assets e testar em iPhone/Safari antes de considerá-lo concluído.
3. Executar o roteiro manual no iPhone/Safari, incluindo upload, leitura, flashcards, simulados, offline e persistência.
4. Adicionar extração local de DOCX/PPTX após estabilizar o fluxo PDF/OCR.
5. Só então avaliar recursos generativos ou integrações externas, mantendo contexto mínimo e autorização explícita.

## Regra de conclusão
Uma tarefa só pode ser marcada como concluída quando estiver implementada, revisada e validada pelo tipo de teste apropriado. Registre resultados e limitações em `CONTINUIDADE.md`.
