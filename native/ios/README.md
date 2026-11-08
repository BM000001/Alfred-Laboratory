# Alfred para iOS

Este diretório contém o contêiner iOS nativo que habilita o acesso ao Calendário Apple por EventKit.

## Requisitos

- macOS com Xcode instalado
- XcodeGen (`brew install xcodegen`)
- iOS 17 ou superior para `requestFullAccessToEvents()`

## Gerar o projeto

Na raiz do repositório:

```bash
cd native/ios
xcodegen generate --spec project.yml
open Alfred.xcodeproj
```

No Xcode, selecione o target **Alfred**, configure uma equipe de assinatura em **Signing & Capabilities** e escolha um iPhone conectado ou um simulador. Para instalar em um iPhone físico, o identificador de pacote `com.bm000001.alfred` precisa estar habilitado na equipe Apple escolhida.

## Como a integração funciona

1. O app abre a interface hospedada em GitHub Pages dentro de uma WKWebView.
2. Ao tocar em **Conectar Calendário Apple**, a interface chama a ponte `alfredCalendar`.
3. O app solicita permissão de leitura pelo EventKit.
4. Os próximos 90 dias de eventos são enviados à interface localmente, sem encaminhar notas privadas.
5. A Agenda grava eventos com identificador `apple:<eventIdentifier>` e atualiza o mesmo registro nas sincronizações seguintes.

## Limitações atuais

- A interface web é carregada de `https://bm000001.github.io/Alfred/`; conexão com a internet é necessária para abrir a aplicação.
- A ponte só aceita mensagens da origem HTTPS oficial e do frame principal.
- A integração é somente leitura; não cria nem altera eventos no Apple Calendar.
- A compilação para simulador é verificada pelo workflow **Alfred iOS Build**. A instalação em dispositivo físico exige assinatura e provisionamento Apple.
- A sincronização incremental em segundo plano e a reconciliação de eventos excluídos ainda não estão implementadas.