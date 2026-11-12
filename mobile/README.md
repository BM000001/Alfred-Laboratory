# Alfred Mobile

Cliente nativo para iPhone e Android, isolado do frontend web do Alfred. O aplicativo usa Expo e React Native para manter uma única base de interface nas duas plataformas.

## Rodar no telefone

Requisitos: Node.js 20.19.x ou superior e Expo Go compatível com o SDK 54.

```sh
cd mobile
npm install
npm start
```

Escaneie o QR code pelo Expo Go. A opção `--tunnel` já vem habilitada para facilitar a conexão quando o telefone e o computador não estão na mesma rede local.

## Estado implementado

- Shell nativo com identidade inicial preta e dourada e navegação inferior.
- Início, rotina, estudos e projetos como destinos de navegação.
- Adição e conclusão de tarefas na rotina.
- Persistência local das tarefas via SQLite key-value store, sem exigir conexão.
- Telas de estudos e projetos informam explicitamente que ainda não compartilham dados com o Alfred web.

## Limites desta base

Este é o primeiro cliente móvel executável, não um espelho completo do Alfred web. Não há autenticação, sincronização entre aparelhos, integração com Google Calendar ou Canvas, processamento de arquivos, notificações, nem conexão com provedores de IA. O que for registrado nesta versão permanece apenas no aparelho. Não colocar credenciais ou dados sensíveis nela.

## Próximo trabalho técnico

1. Auditar os contratos e o modelo de domínio atuais do Alfred web.
2. Definir um pacote de domínio compartilhado que não dependa de DOM ou IndexedDB.
3. Migrar gradualmente os módulos e a persistência com versionamento de esquema.
4. Só depois conectar uma API de sincronização multiusuário, com autenticação, conflitos e autorização explícitos.
5. Configurar builds assinados e distribuição TestFlight / Google Play quando houver contas e credenciais de publicação.

Expo Go no iOS acompanha um SDK específico. A base usa SDK 54 porque a versão do Expo Go disponível pela App Store para iPhone suporta até esse SDK; a compatibilidade deve ser reavaliada antes de atualizar dependências.
