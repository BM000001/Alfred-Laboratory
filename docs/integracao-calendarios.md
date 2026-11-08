# Integração de calendários do Alfred

## Objetivo

Permitir que o Alfred leia eventos do calendário escolhido pelo usuário, sem exigir cadastro manual e sem enviar o conteúdo dos eventos a um servidor próprio.

## Limite da versão atual

O Alfred publicado em GitHub Pages é uma aplicação web/PWA. O Safari e os demais navegadores não expõem a API EventKit do iOS para páginas web. Portanto, uma página web não consegue solicitar acesso direto a todos os calendários do iPhone. A importação .ics existente continua sendo a alternativa manual compatível com a versão web.

Não devemos simular uma conexão automática nem pedir credenciais do iCloud. Acesso direto ao Calendário Apple requer um contêiner nativo iOS com a permissão do EventKit.

## Etapa Apple (primeira)

1. Criar um aplicativo iOS nativo que hospede a interface do Alfred.
2. Declarar `NSCalendarsFullAccessUsageDescription` no Info.plist, explicando por que o Alfred precisa ler eventos.
3. Solicitar permissão somente quando o usuário tocar em “Conectar Calendário Apple”.
4. Usar EventKit para listar eventos futuros e devolver ao Alfred somente os campos necessários: título, início, fim, dia inteiro, indicador de recorrência, nome e identificador do calendário e local.
5. Fazer correspondência pelo identificador nativo do evento para atualizar registros importados sem duplicá-los.
6. Manter a leitura mínima necessária: título, datas, dia inteiro, calendário e local; não transferir notas privadas do evento.
7. Manter a agenda manual independente e permitir desconectar/revogar o acesso.

O serviço EventKit está em `native/ios/AlfredCalendarAccess.swift`. A casca SwiftUI/WebView está em `native/ios/AlfredApp.swift` e `native/ios/AlfredWebView.swift`. O cliente TypeScript da ponte está em `src/modules/agenda/nativeCalendarBridge.ts`.

### Contrato da ponte

O cliente envia `action` (`connect` ou `sync`) e um `requestId` único. A resposta contém o mesmo `requestId`, permitindo várias solicitações concorrentes sem cruzar resultados. A comunicação só é aceita na página principal HTTPS do host oficial `bm000001.github.io`. O cliente TypeScript oferece `isNativeAppleCalendarAvailable()`, `connectAppleCalendar()` e `syncAppleCalendar(calendarIds)`. Após conceder acesso, o Alfred lista os calendários disponíveis com seus identificadores, títulos e fontes; o usuário escolhe quais serão lidos na sincronização. A seleção é guardada localmente no dispositivo e, ao abrir a Agenda novamente no app iOS, o Alfred tenta atualizar automaticamente os eventos desses calendários. A seção de diagnóstico informa o ambiente em uso, quantidade de calendários selecionados, eventos recebidos na última leitura e eventos Apple ativos já registrados na Agenda. O estado da permissão é descrito com cautela: no navegador não é possível consultá-lo, e no app a confirmação ocorre quando a solicitação nativa é concluída.

Os eventos sem identificador estável do EventKit são ignorados para evitar que uma nova leitura gere cópias difíceis de reconciliar. Os eventos são lidos em uma janela padrão de 90 dias.

**Projeto iOS configurado:** `native/ios/project.yml` define o target iOS 17+ e os três arquivos Swift; `native/ios/Info.plist` declara a mensagem de permissão do EventKit. O projeto Xcode é gerado com XcodeGen. Para gerar e abrir no Mac:

```bash
brew install xcodegen
cd native/ios
xcodegen generate --spec project.yml
open Alfred.xcodeproj
```

O workflow `Alfred iOS Build` gera o projeto e tenta compilar para o simulador iOS no GitHub Actions. A instalação em iPhone ainda exige assinatura Apple Developer e perfil de provisionamento.

O projeto Xcode pode ser gerado a partir da especificação XcodeGen. A compilação automática está configurada, mas ainda precisa concluir com sucesso. A interface da Agenda agora detecta a ponte nativa, oferece conectar/sincronizar no contêiner iOS e faz upsert dos eventos por `apple:<eventIdentifier>`, sem duplicar eventos nem substituir compromissos manuais. Cada resposta de sincronização informa `snapshotComplete`, os calendários consultados e os instantes exatos de início e fim usados pelo EventKit. A reconciliação só é executada se o snapshot estiver explicitamente completo, corresponder exatamente à seleção atual, tiver intervalo válido e todos os eventos tiverem identificadores, calendários e datas válidos. Se o EventKit retornar qualquer evento sem identificador estável, o app interrompe a operação em vez de omiti-lo e potencialmente arquivá-lo por engano. A reconciliação usa o intervalo nativo exato, não um novo intervalo calculado no navegador. Eventos que possuem regras de repetição no EventKit são identificados com `hasRecurrenceRules` e recebem o indicador “Recorrente” na lista da Agenda; a informação é atualizada a cada sincronização. O nome do calendário de origem também é salvo e exibido em cada compromisso importado, permitindo distinguir, por exemplo, eventos vindos de “Universidade” e “Pessoal”. A importação não envia notas dos eventos para o armazenamento da Agenda. O site/PWA no navegador continua sem acesso direto ao EventKit; a importação .ics segue disponível. A identidade de sincronização agora combina o identificador externo fornecido pelo servidor (`calendarItemExternalIdentifier`) com `occurrenceDate` quando o evento pertence a uma série recorrente. O app nativo também observa notificações `EKEventStoreChanged` e o retorno do aplicativo ao primeiro plano; quando a Agenda está visível, esses sinais disparam uma nova leitura dos calendários selecionados. A sincronização inicial ao abrir a Agenda continua ativa. Se a Agenda não estiver visível, o Alfred aguarda até ela voltar a ficar visível/ser reaberta, em vez de tentar executar tarefas em segundo plano. A data original da ocorrência permanece estável mesmo quando uma ocorrência é deslocada, evitando que todas as instâncias da série sejam fundidas. O `eventIdentifier` continua sendo a chave rápida da ocorrência; se ele mudar após uma movimentação, o serviço tenta migrar o registro existente pela identidade estável. Se houver cópias externas ambíguas, o Alfred prefere criar um registro separado a fundir eventos diferentes. O `calendarItemExternalIdentifier` pode ser nulo ou repetido em cenários de cópias/convites, então não é tratado isoladamente como garantia universal de unicidade.

## Etapa Google (segunda)

Adicionar “Conectar Google Agenda” com OAuth 2.0 usando Authorization Code + PKCE e escopos mínimos de leitura. Tokens devem ficar no armazenamento seguro do sistema nativo (Keychain no iOS), nunca em código-fonte ou localStorage. Consultar a Google Calendar API e normalizar os eventos para o mesmo formato interno usado pela integração Apple.

## Modelo comum e sincronização

- Cada evento importado deve guardar provedor, calendário de origem e identificador externo estável.
- Importações repetidas devem atualizar o mesmo evento, não criar cópias.
- Eventos removidos na origem devem ser tratados com cuidado: primeiro marcar como removidos/sincronizados, sem apagar compromissos manuais.
- O usuário escolhe quais calendários conectar e pode desconectar a qualquer momento.
- A sincronização deve ser somente leitura inicialmente; criar/editar eventos na origem exige uma decisão explícita posterior.
- O Alfred deve informar a última sincronização e apresentar erros de permissão/rede de forma clara.

## Estado

- [x] Importação manual de arquivos .ics na versão web.
- [x] Serviço Swift inicial para leitura via EventKit.
- [x] Ponte com identificador por solicitação e validação HTTPS da origem.
- [x] Especificação XcodeGen, Info.plist e workflow de compilação iOS.
- [ ] Compilação iOS confirmada, assinatura e instalação em dispositivo real.
- [x] Interface nativa de conectar/sincronizar e upsert local idempotente dos eventos Apple.
- [x] Listagem de calendários Apple e seleção dos calendários a importar.
- [x] Persistência local da seleção e tentativa de sincronização ao abrir a Agenda no app nativo.
- [x] Reconciliação de eventos ausentes por calendário de origem, com cancelamento lógico e preservação do histórico.
- [x] Proteção contra snapshots vazios/incompletos quando um calendário selecionado não está mais disponível no dispositivo.
- [x] Classificação automática inicial dos eventos importados pelo título (aula, prova, prazo e pessoal).
- [x] Preservação e exibição de eventos de dia inteiro na Agenda.
- [x] Identificação visual de eventos recorrentes do Calendário Apple.
- [x] Exibição do nome do calendário de origem nos eventos importados.
- [x] Painel de diagnóstico da integração Apple na Agenda.
- [x] Confirmação explícita de snapshot completo, intervalo nativo exato e calendários consultados antes da reconciliação.
- [x] Interrupção segura da sincronização quando algum evento retornado não possui identificador estável ou dados válidos.
- [x] Identidade estável adicional para detectar eventos movidos e ocorrências recorrentes sem fundi-las.
- [x] Atualização automática da Agenda aberta após notificações de mudança do EventKit e retorno do app ao primeiro plano.
- [ ] Sincronização em segundo plano com o app suspenso e testes em dispositivo real.
- [ ] Integração Google Agenda via OAuth.
