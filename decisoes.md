# Decisões do projeto

Registro das decisões que orientam o Alfred. Cada decisão tem data de referência, status e motivo.

## D1. Provedor de IA independente

**Status:** aceita.
O núcleo não depende de nenhum provedor. Provedores entram como adaptadores, registrados em `src/ai/providers.ts`.

## D2. Custo zero como premissa

**Status:** aceita.
Nenhuma funcionalidade essencial depende de serviço pago ou de assinatura. Serviços pagos futuros serão opcionais.

## D3. Plataforma: web e PWA primeiro

**Status:** aceita.
Interface responsiva, instalável como PWA, em computador e iPhone. Desktop nativo fica para avaliação futura.

## D4. Voz fora do MVP

**Status:** aceita.
Voz em pt-BR será um módulo posterior. Nenhuma funcionalidade essencial depende de navegador específico.

## D5. Canvas LMS: planejado, não implementado

**Status:** aceita, com bloqueio.
Só será implementado após verificação das políticas da instituição do usuário. Até lá, não há chamada à API, não há solicitação de token e não há código de integração. O módulo de estudos trabalha com importação manual de arquivos.

## D6. Privacidade e local-first

**Status:** aceita.
Dados pessoais e acadêmicos ficam no aparelho. Nenhum envio automático. Todo envio a serviço externo exige ação do usuário, confirmação por categoria e registro sem conteúdo.

## D7. Relação com o Jarvis

**Status:** aceita.
Repositório independente. Conceitos aproveitados, código reimplementado. Atribuições em `NOTICE.md`.

## D8. Claude e login do Claude Code

**Status:** aceita.
O Alfred não usa login do Claude Code e não depende de assinatura Claude. Eventual uso futuro da API da Anthropic exigiria chave de API e seria opcional.

## D9. Idioma

**Status:** aceita.
Interface, textos ao usuário e prompts gerados em português brasileiro. A arquitetura permite outros idiomas no futuro.

## D10. Uso pessoal

**Status:** aceita.
Uso exclusivamente pessoal nesta fase. A estrutura de dados (identificadores universais, metadados de alteração) não impede expansão futura para outros usuários.

## D11. Caminho A: armazenamento local no MVP

**Status:** aceita.
Dados em cada dispositivo, com backup e exportação. A sincronização automática fica para etapa futura, e a estrutura de dados já prevê essa evolução.

## D12. Hospedagem estática

**Status:** aceita.
Os arquivos públicos do Alfred são hospedados em serviço gratuito de páginas estáticas, por HTTPS. A hospedagem não armazena dados do usuário. O serviço escolhido para o site é o GitHub Pages, sujeito à confirmação do usuário antes da publicação.

## D13. Gemini API gratuita: NÃO autorizada para o runtime

**Status:** não autorizada, reavaliável.

**O que foi verificado nos termos oficiais** (Gemini API Additional Terms of Service, página oficial do Google AI for Developers):

1. No uso não pago (*Unpaid Services*), o Google usa o conteúdo enviado e as respostas para fornecer, melhorar e desenvolver produtos e tecnologias de aprendizado de máquina. Revisores humanos podem ler, anotar e processar entradas e saídas.
2. Os termos recomendam **não enviar informações sensíveis, confidenciais ou pessoais** ao uso não pago.
3. No uso pago, o Google afirma não usar prompts e respostas para melhorar seus produtos, mas registra prompts e respostas por período limitado para detectar violações da política de uso proibido.
4. **Restrição de público.** Os termos dizem que o uso da API é destinado a desenvolvedores que criam com os modelos "para fins profissionais ou comerciais, não para uso de consumidor".
5. **Idade.** O uso exige 18 anos ou mais.
6. **Região.** Para disponibilizar clientes a usuários no Espaço Econômico Europeu, Suíça ou Reino Unido, é preciso usar apenas serviços pagos.

**Consequência:** o Alfred **não assume** que o uso pessoal é permitido pela restrição do item 4. Essa avaliação fica com o usuário, e a integração não será habilitada sem nova decisão registrada aqui.

**Decisão do usuário:** não integrar o Gemini gratuito ao runtime por enquanto. Manter o adaptador Manual funcional e deixar a arquitetura preparada para outros provedores.

**Condições para reavaliar:** (a) confirmação do enquadramento do uso pessoal na restrição de consumo; (b) revisão dos limites e termos vigentes na data da reavaliação; (c) decisão explícita do usuário.

## D14. Região e idioma de uso

**Status:** aceita.
Uso inicial no Brasil, em português brasileiro. Não há intenção de disponibilizar o app a usuários de outras regiões nesta fase.

## D15. Testes em iPhone

**Status:** aceita.
O usuário dispõe de iPhone para testar instalação da PWA, funcionamento offline e armazenamento local. Roteiro em `docs/testes-manuais-iphone.md`.

## Pendências

| ID | Pendência | Bloqueia |
|---|---|---|
| P1 | Licença do próprio Alfred (MIT ou proprietária) | publicação de LICENSE |
| P2 | Linha de copyright do Jarvis (copiar do LICENSE original) | qualquer cópia de código do Jarvis |
| P3 | Verificação das políticas da instituição sobre tokens e API do Canvas | Etapa do Canvas |
| P4 | Execução local dos comandos de verificação do código do Jarvis (auditoria) | nada nesta etapa |
| P5 | Geração do `package-lock.json` com acesso ao registro npm | reprodutibilidade do build |
| P6 | Confirmação do GitHub Pages como serviço de hospedagem | publicação do site |
| P7 | Autoria dos commits (nome e e-mail do autor) | publicação do histórico |
