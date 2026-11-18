# Alfred 3.0 · interface do Laboratory

Base: main em 2296a6b, com #67 e #68 integrados.

## Diagnóstico dos estilos azuis

O ponto de entrada carregava `global.css` e depois `workspace.css`, com regras da mesma interface em ambas. `global.css` redefinia `--blue` ao longo do arquivo, incluindo `#3978D5`, `#48c9ed` e `#6b9cff`. Formulários de simulados ainda tinham `accent-color:#91b4f5`. `workspace.css` aplicava correções de maior especificidade, por exemplo `html #root .main-content`. O assistente importava sua própria folha, com cores fixas de texto, ícones e scrollbar.

A inspeção das dependências encontrou essas três folhas no runtime React. Estilos inline dos módulos afetam progresso e disposição de conteúdo, sem definir o azul. O manifesto e a meta do HTML tinham `#1e3a8a` e `#17243A`. O PNG de 192 px tinha 31.335 pixels em `#1E3A8A`. A PWA podia servir offline o HTML e os assets do cache `app-shell-v1`. O Pages usa outro caminho base e pode servir outro commit.

## Organização nova

- `App.tsx` contém a navegação principal, o cabeçalho de Configurações e a criação rápida. A lista de Organização inclui Calendário, Tarefas, Projetos, Notas, Arquivos e Foco. A criação rápida redireciona aos formulários existentes.
- `design.css` define paletas, tipografia, espaçamento, controles e estados compartilhados. `interface.css` usa esses tokens para a composição da página e para os módulos existentes. As três folhas legadas foram removidas. O mascote usa os assets existentes e pode ser ocultado em Configurações.
- A preferência automática segue o sistema. Claro e Escuro são escolhas persistidas no namespace existente, com leitura da preferência anterior.
- O cache `app-shell-v2` aceita a nova geração depois de obter o HTML e seus arquivos de entrada fingerprintados. A ativação aguarda o encerramento dos clientes antigos. O cache de OCR e os caches de outras aplicações ficam preservados. Manifesto e ícones são servidos em ambos os builds Vite.

## Safari e PWA

1. Em uma origem isolada, percorra as cinco posições da navegação inferior em retrato e paisagem. Abra Configurações pelo cabeçalho, alterne temas e confira a opção de ocultar o mascote após reabrir.
2. Use Criar para abrir tarefa, compromisso, nota e projeto. Confira formulário, teclado, cancelamento e persistência após recarregar. Abra arquivos e integrações pela Organização.
3. No Aprender, repita Material → OCR/retomada → Simulado → Correção → Histórico. Confira backups em Configurações.
4. Em uma instalação de teste da PWA, atualize com a versão antiga ainda aberta, depois encerre todas as janelas e reabra online. Reabra offline e confira ícones, tema, armazenamento e navegação. Teste com dados descartáveis.
