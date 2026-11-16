# Google Calendar OAuth — teste isolado no Alfred-Laboratory

A implementação é uma adaptação do PR #120 do repositório BM000001/Alfred. Nesta branch, a Agenda exibe o novo painel de integração OAuth somente leitura. O painel e a ponte Google Apps Script anteriores continuam presentes no código, sem exclusão, para comparação ou reversão.

## Como funciona
- O navegador carrega a biblioteca Google Identity Services apenas após a ação explícita de conectar.
- Token OAuth mantido somente na memória da página, não salvo em IndexedDB/localStorage nem enviado ao nosso servidor.
- Escopos: `calendar.calendarlist.readonly` e `calendar.events.readonly`; o Alfredo **não cria, atualiza nem exclui eventos no Google** por este modo.
- Importa eventos para a agenda local (próximos 90 dias), incluindo eventos recorrentes expandidos e de dia inteiro.
- A leitura integral dos calendários selecionados precisa terminar antes de qualquer atualização local. Registros ausentes no intervalo podem ser arquivados localmente na sincronização.
- Não sincroniza automaticamente em segundo plano. Requer reconectar após expiração ou recarregamento.

## Configuração da conta Google — sem Apps Script
1. Acesse [Google Cloud Console](https://console.cloud.google.com/) e selecione/crie um projeto.
2. Em **APIs e serviços → Biblioteca**, habilite **Google Calendar API**.
3. Em **Google Auth Platform**, configure a tela de consentimento (para teste externo, adicione sua Conta Google aos usuários de teste).
4. Em **Clientes → Criar cliente**, tipo **Aplicativo da Web**, adicione origem JavaScript autorizada **`https://bm000001.github.io`** (somente origem, sem `/Alfred-Laboratory` e sem barra final).
5. Copie **somente o Client ID público** terminado em `.apps.googleusercontent.com`, nunca o Client Secret.
6. Para deploy automático após merge autorizado, configure a variável Actions `VITE_GOOGLE_CALENDAR_CLIENT_ID` em Alfred-Laboratory; `.github/workflows/deploy-pages.yml` expõe esse ID público no build. Para testes locais/ambientes sem variável, o painel permite informar o Client ID na própria tela, apenas durante a sessão.
7. Ao autorizar, selecione apenas os escopos de leitura solicitados. Faça um primeiro teste com calendário pequeno/sem informações sensíveis.

## Checklist de validação antes de merge
- [ ] CI de testes automatizados e build TypeScript/Vite verde.
- [ ] Login OAuth em Edge/Chrome desktop, janela permitida, consentimento Google.
- [ ] Ler lista de calendários, selecionar/desmarcar, importar eventos e evitar duplicações após nova importação.
- [ ] Testar eventos de dia inteiro, recorrência e paginação.
- [ ] Confirmar que nenhuma escrita é enviada ao Google.
- [ ] Verificar que compromisso manual e eventos Apple não são alterados.
- [ ] Testar autenticação e reconexão no Safari iPhone físico.
- [ ] Garantir que o Alfred principal permanece intacto.

## Limites atuais
O OAuth exige um Client ID próprio do Google Cloud, mesmo com GitHub Pages. O Client ID não é senha; **não** inserir Client Secret, tokens ou credenciais na variável. A funcionalidade de escrita do Apps Script não foi migrada; primeiro liberamos apenas leitura comprovada.

Documentação: https://developers.google.com/workspace/calendar/api/quickstart/js e https://developers.google.com/identity/oauth2/web/guides/use-token-model
