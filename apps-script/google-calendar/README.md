> **Estágio de laboratório:** os arquivos abaixo são uma base isolada para avaliação. O painel Google ainda não está ligado à interface do Alfred-Laboratory. Não representa conexão validada com uma conta nem com o Safari real. O PR #104 no repositório Alfred continua separado.\n\n# Alfred — Google Calendar via Apps Script

Este projeto substitui o Cloudflare Worker/D1 por um Google Apps Script Web App privado. Ele é um backend de execução por usuário e deve ser criado pelo próprio usuário, na mesma Conta Google cuja agenda será conectada.

## Regra de implantação obrigatória

**Execute as: User accessing the web app.**

Nunca escolha "Me" / proprietário. Se o Web App executar como o proprietário, as chamadas Calendar API usarão a agenda do proprietário e poderão expor dados de outra pessoa.

## Arquivos

- Code.gs: dispatcher RPC e chamadas REST ao Google Calendar.
- Index.html: janela de ponte entre Alfred e google.script.run.
- appsscript.json: runtime V8, escopos OAuth explícitos e configuração do Web App.

## Configuração pelo proprietário do Alfred

1. Abra https://script.google.com/ e crie um projeto independente chamado **Alfred Google Calendar**.
2. No editor, ative **Project Settings → Show "appsscript.json" manifest file in editor**.
3. Substitua o conteúdo de Code.gs pelo arquivo deste diretório.
4. Crie um arquivo HTML chamado Index (sem extensão) e cole o conteúdo de Index.html.
5. Substitua o manifesto pelo appsscript.json deste diretório.
6. Salve o projeto e confirme que **Services → Calendar API v3** aparece habilitado. O manifesto já declara esse serviço. Se o Apps Script estiver associado a um projeto Google Cloud padrão (standard), habilite também a **Google Calendar API** em APIs e serviços nesse projeto; em projetos padrão criados automaticamente pelo Apps Script, a ativação do serviço avançado é gerenciada pelo próprio Apps Script.
7. Em **Deploy → New deployment → Web app**, configure:
   - Execute as: **User accessing the web app**.
   - Who has access: **Only myself**. O projeto é de uso pessoal e deve ser criado na mesma Conta Google cuja agenda será conectada.
8. Implante e copie a URL HTTPS terminada em /exec.
9. No repositório GitHub, abra **Settings → Secrets and variables → Actions → Variables** e crie VITE_GOOGLE_APPS_SCRIPT_URL com essa URL. Não coloque a URL em um secret nem em arquivo versionado.
10. Atualize/reexecute o workflow de Pages somente depois da autorização de merge e do planejamento de publicação.

O projeto pede apenas os escopos definidos no manifesto. A API Calendar v3 é ativada como serviço avançado para garantir que a API esteja habilitada no projeto associado, embora as chamadas sejam feitas pela REST API com UrlFetchApp. Na primeira conexão, o Google exibirá a tela de consentimento. Se o Google mostrar um aviso de app não verificado, não ignore automaticamente: confirme que o script/proprietário e os escopos exibidos são os esperados. Não adicione usuários externos nem publique o script para terceiros sem revisar a verificação OAuth e as políticas aplicáveis.

## Como a ponte funciona

O Alfred abre a URL /exec?nonce=... em uma janela/aba por uma ação direta do usuário. O Apps Script responde a operações permitidas via google.script.run. O canal usa origem Alfred fixa, referência à janela e nonce aleatório. O token OAuth fica no servidor Apps Script e é usado para chamar a Google Calendar REST API via UrlFetchApp; nunca é enviado ao navegador.

A janela/aba do Apps Script precisa continuar aberta durante a conexão. Fechar a janela, perder o vínculo window.opener ou recarregar Alfred exige reconectar. A interface local não armazena bearer ou refresh token.

## Privacidade e limites

- O Apps Script deve executar como o usuário que acessa.
- Nenhum token, evento ou payload é persistido pelo script em propriedades, cache, planilhas ou logs.
- Os dados dos eventos transitam temporariamente pelo Apps Script durante a chamada à Google API.
- O IndexedDB do Alfred continua sendo a fonte local dos compromissos e cursores.
- Escritas remotas exigem confirmação individual no Alfred.
- ETag/If-Match protege contra sobrescrita concorrente; conflitos devem ser resolvidos pelo usuário.
- Criações usam um ID Google estável (base32hex) e um marcador privado `extendedProperties.private.alfredOperationId`. O Alfred persiste a operação e o snapshot exato do evento no IndexedDB antes da chamada; após timeout/reload, uma nova confirmação do usuário retoma o mesmo ID e payload. Em HTTP 409, o Apps Script só reconhece a criação anterior se o marcador privado corresponder; IDs ocupados por outra operação são rejeitados.
- Atualizações que recebem conflito de ETag após uma resposta perdida consultam o evento atual. Só são consideradas concluídas se título, descrição, local e horários já corresponderem ao payload desejado; se houver divergência, o Alfred preserva o conflito e não sobrescreve a edição externa.
- Exclusões repetidas do mesmo evento tratam HTTP 404 como estado final já alcançado. Conflitos de ETag e demais erros continuam sendo apresentados, sem apagar a referência local automaticamente.
- O registro de operações pendentes fica em uma store IndexedDB própria (migração DB v12), não é enviado ao Google como armazenamento de fila e não integra o backup exportado. O payload duplicado permanece somente no dispositivo para permitir retry idêntico.
- A desconexão fecha a ponte e limpa o estado em memória, mas não confirma revogação OAuth. Para revogar completamente, abra a Conta Google → Segurança → Suas conexões com apps e serviços de terceiros e remova o acesso do script.
- Safari pode suspender sincronização automática em segundo plano. O Apps Script também tem quotas e limites de execução/UrlFetch.

## Bloqueio conhecido — Safari

A comunicação depende de uma janela aberta pelo Alfred e de postMessage. O HTML Service executa a página em um sandbox; se ele não preservar a referência à janela Alfred que abriu o Apps Script, a ponte falha fechada e esta arquitetura não poderá ser liberada. No iPhone, o Safari também pode abrir uma nova aba ou suspender a aba Apps Script em segundo plano. **Não considerar a integração pronta até validar a referência à janela de origem, abertura, troca de abas, retorno, suspensão e reconexão em Safari físico.**

O projeto não usa iframe, pois há relatos recentes de Apps Script Web Apps bloqueados em iframes mesmo com XFrameOptionsMode.ALLOWALL.

## Desenvolvimento e validação

O CI verifica o TypeScript da aplicação, os testes existentes, o build e a sintaxe básica do arquivo Code.gs. Isso não substitui implantação/teste no ambiente Apps Script nem validação no Safari real.
