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

## Correção de visual e diagnóstico pós-#69

A consulta de 18/11/2026 ao URL público serviu o CSS `index-Di3_SURe.css` e o JS `index-DmcB72ZR.js`. O JS contém `primary-navigation` e `alfred-shell`; não contém `mobile-more-menu` ou `sidebar-note`. O CSS contém `.masthead` e não apresenta os seletores e valores azuis legados pesquisados. O service worker servido é o v2 e coincide byte a byte com a main em `6fd78be`. A execução do workflow Pages `44286530269` publicou esse commit. O endpoint de builds legados ainda indica `f9d75a3` e a branch antiga. Esse endpoint não prova qual conteúdo o iPhone exibiu.

Na versão anterior ao #69, `src/styles/global.css`, `src/styles/workspace.css` e `src/modules/assistant/assistant.css` definiam cores e superfícies herdadas. O shell antigo em `src/app/App.tsx` renderizava sidebar e menu Mais. O #69 removeu essas folhas e substituiu a navegação. O `styles.css` restante na raiz ainda continha superfícies azuis, mas não era importado pelo React, pelo HTML Vite ou pelos workflows. O empacotador antigo `build-site.mjs` apontava para `public/styles.css`, `public/sw.template.js` e um comando `build:js` inexistentes. Foram removidos o CSS órfão, o empacotador e seu template antigo. O arquivo histórico ZIP foi preservado.

O shell offline agora é identificado pelo hash do build. A instalação confere se o HTML pertence à mesma versão do worker e se os assets necessários estão disponíveis. A navegação online não substitui a cópia offline instalada. O arquivo público `version.json` informa revisão e hash; a tela Configurações mostra a revisão curta e o hash do HTML que abriu aquela sessão. O deploy oficial está restrito à branch main.

A composição mobile dá uma grade própria às abas, alvos maiores na barra inferior e bordas com contraste medido para controles. Calendário e assistente usam o espaço disponível no telefone sem a moldura externa das suas versões desktop. O diagnóstico das capturas originais depende do arquivo de imagem ou do aparelho. A confirmação física deve comparar a Versão em Configurações com o `version.json` online, testar a PWA após fechar janelas antigas e repetir offline. Não é necessário limpar os dados do site.
