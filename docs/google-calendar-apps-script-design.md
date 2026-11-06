# Google Calendar via Apps Script — desenho técnico (proposta para validação)

**Estado:** desenho técnico; ainda não implementado.  
**Base:** branch `develop-app` por meio da branch documental `docs/reconcile-calendar-state-2026-11-06`.  
**Escopo:** integração Google independente do provider Apple/EventKit; compatibilidade prioritária com GitHub Pages/PWA no Safari do iPhone.

## 1. Decisões confirmadas pelo usuário

- Provedor: Google Calendar.
- Ponte/backend: Google Apps Script publicado como Web App.
- Identidade de execução: usuário que acessa o Web App (`USER_ACCESSING`).
- Acesso ao Web App: somente o usuário que o implantou (`MYSELF`), pois a instalação é pessoal.
- Sincronização: bidirecional, manual e automática.
- Permissões funcionais: leitura e escrita.
- Cada criação, atualização ou exclusão remota exige confirmação explícita e individual no Alfred, imediatamente antes do envio.
- Preservar local-first: IndexedDB continua sendo a base local; a nuvem Google é um provider conectado, não o banco primário do Alfred.
- Apple/EventKit continua independente e não pode ser removido, condicionado ao Google ou substituído.
- Não fazer merge em `BM000001/Alfred` nem neste repositório sem autorização explícita.

## 2. Fatos técnicos verificados e riscos

### 2.1 Identidade e acesso

O manifesto de Web App do Apps Script separa:
- `access`: `MYSELF` significa somente o implantador; `ANYONE` significa qualquer usuário autenticado.
- `executeAs`: `USER_ACCESSING` executa com a identidade da pessoa que acessa; `USER_DEPLOYING` executa com a identidade do implantador.

A combinação pretendida para o uso pessoal é `MYSELF` + `USER_ACCESSING`. O acesso real deve ser homologado com a mesma conta Google usada no Safari do iPhone, inclusive após expiração de sessão e revogação de consentimento.

### 2.2 Transporte navegador ↔ Apps Script: bloqueador a validar antes do produto

Apps Script Web Apps recebem chamadas por `doGet(e)` e `doPost(e)`. O serviço ContentService devolve `TextOutput`, mas o Google documenta que o navegador é redirecionado para uma URL diferente por motivos de segurança. A documentação consultada não garante CORS para uma PWA hospedada em `bm000001.github.io`.

Portanto:
- Não assumir que `fetch()` cross-origin conseguirá ler a resposta do Web App.
- `mode: "no-cors"` não é solução: a resposta opaca não permite ao Alfred confirmar o resultado da sincronização.
- Não colocar tokens OAuth, chaves privadas ou segredos no bundle da PWA.
- Não escolher iframe/HTML Service como solução sem teste: embora exista `XFrameOptionsMode.ALLOWALL`, há relatos recentes de falha de embedding cross-origin, inclusive com esse modo. Tratar como risco de plataforma, não como comportamento garantidamente quebrado.
- `google.script.run` só está disponível no HTML Service do Apps Script. Se for usado como ponte, precisa de um canal de mensagens autenticado e estritamente validado entre a página do Alfred e o frame; não aceitar mensagens de qualquer origem.

**Gate obrigatório:** antes de implementar a integração de produção, fazer um spike mínimo no Safari iOS e Chrome desktop com a configuração pessoal pretendida. Provar conexão, leitura JSON, escrita de teste cancelável, erro de autenticação e resposta legível pela PWA. Se o transporte não for confiável, parar e propor alternativas sem alterar a decisão do provider/backend sem autorização.

### 2.3 API Google Calendar

Preferir o Advanced Calendar Service do Apps Script, habilitando a Calendar API v3. A documentação Google recomenda serviços avançados quando disponíveis; eles seguem os recursos e parâmetros da API pública e tratam a autorização do serviço. A sincronização incremental usa `nextSyncToken`; a paginação deve ser concluída antes de persistir o token. Um token inválido retorna 410 e exige sincronização completa.

Usar Calendar API v3 em vez de depender somente de `CalendarApp` porque o contrato precisa de identificadores, ETags, tombstones e sync tokens.

## 3. Arquitetura proposta

```
Alfred PWA (Safari / GitHub Pages)
  ├─ IndexedDB: compromissos, vínculos externos, cursores, operações pendentes
  ├─ GoogleCalendarProvider (interface interna comum)
  ├─ WriteApprovalGate (uma aprovação por operação)
  └─ Google Apps Script Web App
       ├─ valida envelope, versão, tamanho e operação
       ├─ executa como o usuário autenticado
       ├─ Advanced Calendar Service (Calendar API v3)
       └─ devolve resposta normalizada
             └─ Google Calendar do próprio usuário
```

O Apps Script não deve ser usado como proxy genérico nem receber uma exportação completa do IndexedDB. Cada chamada transporta somente os dados mínimos necessários para a operação solicitada.

## 4. Contrato lógico da API

O contrato abaixo é independente do transporte final. A forma HTTP/iframe será escolhida somente após o spike.

### Envelope de requisição

```json
{
  "protocolVersion": 1,
  "requestId": "uuid",
  "action": "calendar.list",
  "payload": {}
}
```

Regras:
- `protocolVersion` obrigatório; rejeitar versões desconhecidas.
- `requestId` UUID gerado no cliente e repetido na resposta.
- `action` deve pertencer a uma allowlist fechada.
- Validar tipos, tamanho máximo, datas RFC 3339, IDs e campos permitidos no servidor.
- Rejeitar propriedades desconhecidas em operações de escrita, em vez de repassá-las à API.
- Não aceitar nome de função, URL, método HTTP ou nome de serviço fornecido pelo cliente.

### Envelope de resposta

```json
{
  "protocolVersion": 1,
  "requestId": "uuid",
  "ok": true,
  "data": {},
  "error": null
}
```

Erros devem ter códigos estáveis, por exemplo: `AUTH_REQUIRED`, `PERMISSION_DENIED`, `INVALID_ARGUMENT`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`, `PROVIDER_ERROR` e `RETRYABLE`. Não retornar stack traces, tokens, cabeçalhos de autenticação ou conteúdo privado desnecessário.

### Ações permitidas

| Ação | Finalidade | Efeito remoto |
|---|---|---|
| `health` | Versão e disponibilidade | Nenhum |
| `calendar.list` | Listar calendários acessíveis | Leitura |
| `event.sync` | Sync inicial/incremental de um calendário | Leitura |
| `event.get` | Revalidar um evento por ID/ETag | Leitura |
| `event.create` | Criar evento aprovado | Escrita |
| `event.update` | Atualizar evento aprovado | Escrita |
| `event.delete` | Excluir evento aprovado | Escrita |

Não criar uma ação genérica `execute`, `proxy` ou `batchWrite`.

## 5. Modelo de dados e sincronização

### Identidade externa

Cada compromisso ligado ao Google precisa de metadados separados dos campos visíveis:
- provider = `google`;
- `calendarId`;
- `eventId`;
- `etag`;
- `iCalUID` quando disponível;
- `updated` remoto;
- estado de sincronização;
- data/hora da última reconciliação.

Não usar título + horário como identidade. Eventos recorrentes precisam preservar o ID da ocorrência/instância e a referência à série, sem fundir ocorrências distintas.

### Sync incremental por calendário

1. Usuário seleciona explicitamente os calendários que deseja conectar.
2. Na primeira sincronização, listar eventos em páginas até concluir o resultado e só então guardar `nextSyncToken`.
3. Nas sincronizações seguintes, enviar o `syncToken` anterior e processar todas as páginas.
4. Tratar eventos cancelados/removidos como tombstones; não apagar compromissos manuais.
5. Persistir alterações e o novo token atomicamente no IndexedDB, somente após processar o conjunto completo.
6. Se ocorrer 410, refazer sync completo daquele calendário e reconciliar por IDs externos; não limpar a agenda inteira do Alfred.
7. Se ocorrer falha no meio da paginação, não avançar o token.
8. Respeitar limites de API e aplicar backoff exponencial com jitter em erros temporários.

### Direção das alterações

- Google → Alfred: mudanças remotas são importadas automaticamente, segundo calendários selecionados.
- Alfred → Google: mudanças locais são apenas propostas e entram numa fila local de aprovação.
- Sincronização automática nunca autoriza escrita automática.
- Eventos manuais do Alfred não podem ser removidos porque desapareceram de uma resposta Google.
- Se ambos os lados mudarem o mesmo evento, sinalizar conflito e não sobrescrever silenciosamente.

## 6. Portão de aprovação de escrita

Toda escrita remota deve ser representada por uma operação imutável e individual na fila local:

```ts
type PendingGoogleOperation = {
  operationId: string;
  kind: 'create' | 'update' | 'delete';
  calendarId: string;
  eventId?: string;
  expectedEtag?: string;
  payloadSnapshot: unknown;
  payloadHash: string;
  state: 'proposed' | 'approved' | 'sending' | 'succeeded' |
         'failed' | 'conflict' | 'cancelled';
  createdAt: string;
  approvedAt?: string;
};
```

Regras obrigatórias:
1. Mostrar ação, calendário, título, datas, fuso horário e campos que serão alterados.
2. Exigir botão explícito “Confirmar esta alteração” ou “Cancelar”.
3. A aprovação vale apenas para aquele `operationId` e aquele hash do payload.
4. Se o payload mudar, invalidar a aprovação e pedir nova confirmação.
5. Revalidar o ETag antes de atualizar/excluir; se estiver diferente, interromper e mostrar conflito.
6. Aprovação não pode ser reutilizada nem agrupada em lote.
7. Se a rede cair após o envio, reconciliar o resultado antes de repetir a escrita.
8. Não converter uma falha ou timeout em sucesso presumido.

Para criação idempotente, gerar um ID determinístico compatível com a regra de IDs do Calendar API a partir do `operationId`, ou usar marcador privado equivalente e verificar a existência antes de repetir. Uma resposta de timeout nunca deve provocar evento duplicado.

## 7. Segurança e privacidade

- Implantação pessoal: `MYSELF` + `USER_ACCESSING`, a confirmar em teste real.
- Escopos mínimos a declarar explicitamente e revisar no consentimento; não solicitar acesso a Gmail, Drive ou outros serviços.
- Nunca usar `ScriptApp.getOAuthToken()` no cliente nem transmitir token Google para a PWA.
- Não guardar segredo compartilhado no código público do GitHub Pages.
- Validar autenticação/autorização em toda chamada; não confiar em `calendarId` recebido do cliente sem verificar acesso.
- Aplicar allowlist de ações, validação estrita de payload, limite de tamanho, rate limiting compatível com Apps Script e logs sem conteúdo de evento.
- Usar `LockService` para serializar operações concorrentes que atualizem o mesmo estado de sincronização.
- Guardar cursores por conta/calendário no armazenamento local; não misturar calendários de contas diferentes.
- Desconectar deve interromper sync futuro e permitir remover os metadados/caches Google locais sem afetar compromissos manuais ou Apple.
- Não persistir notas privadas do evento se não forem necessárias ao produto.
- O log local registra tipo, provider, resultado e timestamp; evitar descrição, convidados e conteúdo completo.

## 8. Estratégia de testes

### Spike de transporte — bloqueador inicial
- Chrome desktop e Safari iPhone.
- Acesso com a conta Google correta, sessão expirada e conta incorreta.
- Leitura JSON com resposta legível pelo Alfred.
- Uma criação de evento de teste após aprovação explícita.
- Atualização e exclusão de evento de teste após aprovação individual.
- Cancelar a confirmação e provar que não há chamada de escrita.
- Testar bloqueio de cookies/privacidade e retorno após login.
- Verificar que nenhuma credencial ou token aparece no bundle, logs ou mensagens.

### Testes automatizados
- Paginação e persistência de `nextSyncToken`.
- 410 e recuperação por sync completo.
- Duplicidade, recorrência, eventos de dia inteiro e fuso horário.
- Tombstones sem apagar eventos manuais.
- ETag desatualizado e conflito.
- Timeout depois de uma criação e retry idempotente.
- Duas operações concorrentes no mesmo evento.
- Operação alterada após aprovação invalida o consentimento.
- Nenhuma escrita sem estado `approved`.
- Desconexão e revogação de acesso.

### Homologação iPhone
- Safari normal e modo privado, quando suportado.
- PWA instalada e não instalada.
- Suspender/retomar Safari, perda de rede e sessão Google expirada.
- Conferir estado de sync e mensagens de erro na interface.

## 9. Fases de implementação propostas

1. **Spike de transporte** — projeto Apps Script mínimo separado; nenhuma escrita em calendário real sem confirmação. Resultado: relatório de compatibilidade Safari/Chrome.
2. **Contrato e adapter** — schemas, validação, erros, provider interface e testes de contrato.
3. **Leitura** — listagem de calendários, sync inicial/incremental, paginação, tombstones e conflitos de leitura.
4. **Portão de escrita** — fila local, prévia, aprovação individual, ETag e idempotência.
5. **Homologação** — testes automatizados e manuais no Safari/iPhone.
6. **Entrega** — PR para `develop-app`; não integrar ao Alfred original sem autorização.

## 10. Critérios de aceite

- [ ] Transporte comprovado no Safari iPhone e Chrome desktop.
- [ ] Acesso restrito ao usuário pretendido e execução com a identidade do usuário que acessa.
- [ ] Apenas calendários escolhidos são sincronizados.
- [ ] Sync incremental não perde alterações nem cria duplicatas.
- [ ] Escritas remotas são impossíveis sem aprovação individual explícita.
- [ ] ETag/conflito impede sobrescrita silenciosa.
- [ ] Retry não cria eventos duplicados.
- [ ] Dados manuais e Apple permanecem independentes.
- [ ] Sem tokens/segredos no frontend, no repositório ou nos logs.
- [ ] CI, testes e homologação iPhone concluídos.

## 11. Referências oficiais consultadas

- [Apps Script Web Apps](https://developers.google.com/apps-script/guides/web) — `doGet`, `doPost`, deploy e identidade de execução.
- [Web App manifest](https://developers.google.com/apps-script/manifest/web-app-api-executable) — `MYSELF`, `USER_ACCESSING`, `USER_DEPLOYING`.
- [Content Service](https://developers.google.com/apps-script/reference/content/content-service) — respostas `TextOutput` e redirecionamento.
- [Advanced Google Services](https://developers.google.com/apps-script/guides/services/advanced) — ativação e uso dos serviços avançados.
- [Advanced Calendar Service](https://developers.google.com/apps-script/advanced/calendar) — Calendar API v3 no Apps Script.
- [Calendar incremental sync](https://developers.google.com/workspace/calendar/api/guides/sync) — paginação, `nextSyncToken` e recuperação de 410.
- [HtmlService XFrameOptionsMode](https://developers.google.com/apps-script/reference/html/x-frame-options-mode) — risco e proteção de iframe.

## 12. Limites desta proposta

Este documento não prova que o transporte cross-origin do Apps Script funciona na PWA. Isso depende do spike em navegadores reais. Também não cria um projeto Apps Script, não solicita autorização Google, não altera o código da aplicação e não realiza chamadas à conta Calendar do usuário.
