# Análise arquitetural: Jarvis original e integração segura ao Alfred

**Data da análise:** 2026-11-02  
**Repositório analisado:** https://github.com/adewaskar/jarvis  
**Repositório de destino:** https://github.com/BM000001/Alfred

## 1. Objetivo e conclusão

O Jarvis original é uma referência útil para capacidades de assistente — voz, orquestração de ferramentas, camada de inteligência e interface — mas não deve ser incorporado como um bloco único. Sua arquitetura e pressupostos de execução são diferentes do Alfred.

**Decisão:** preservar React + TypeScript + Vite, o armazenamento local e os módulos funcionais existentes. Extrair ideias e contratos pequenos, com testes e revisão de segurança, em vez de substituir a aplicação por uma cópia do Jarvis.

O Alfred deve continuar funcionando por toque e texto no iPhone. Voz será uma interface opcional, não uma dependência central.

## 2. O que foi observado no Jarvis

A inspeção do código identificou estes pontos relevantes:

| Área/arquivo | Responsabilidade observada | Possível contribuição ao Alfred |
|---|---|---|
| `src/lib/brain.ts` | Camada de decisão entre bridge e chamada direta ao modelo | Inspirar uma interface de provedor independente |
| `src/lib/bridge.ts` | Comunicação com serviço local | Referência para transporte isolado, não para adoção imediata |
| `src/lib/voice.ts` | Entrada/saída de voz, detecção de fala e interrupção | Inspirar módulo de voz opcional |
| `src/lib/capabilities.ts` | Descrição de capacidades disponíveis | Inspirar catálogo tipado de ferramentas |
| `src/lib/anthropic.ts` | Integração direta com Anthropic | Não reutilizar o padrão de chave no navegador |
| `bridge/ui.mjs` | Interface de controle por ferramentas | Referência para ações explícitas e delimitadas |
| `bridge/net.mjs` | Restrições de rede e proteção contra SSRF | Referência de segurança caso exista bridge/backend |
| `src/ui/sanitise.ts` | Sanitização de conteúdo produzido pela IA | Inspirar tratamento de saída não confiável |
| `src/store.ts` | Estado e eventos da aplicação | Referência conceitual, não substituir o estado React atual |
| `src/scene/` | Interface visual própria do projeto | Inspiração visual pontual; não prioridade funcional |

O Jarvis é fortemente orientado a voz e a um agente que pode usar Claude Code/Agent SDK e ferramentas MCP. Isso não corresponde ao objetivo do Alfred, que é um assistente pessoal local-first, multimodal por etapas e independente de fornecedor.

## 3. Riscos e limites de reutilização

### 3.1 Chaves e chamadas de IA

Foi observado em `src/lib/anthropic.ts` o uso de `dangerouslyAllowBrowser: true`, que permite chamada direta do navegador com chave de API. **Não transportar esse padrão para o Alfred publicado.** Uma chave embutida no frontend pode ser extraída por qualquer pessoa que acesse o aplicativo.

Qualquer integração remota futura deve usar credenciais protegidas fora do bundle público, consentimento explícito, minimização de contexto e limites de custo. Isso pode exigir um serviço intermediário ou um provedor com fluxo seguro apropriado; não será simulado como se o frontend pudesse guardar segredos.

### 3.2 Ações e ferramentas

Uma ferramenta chamada pela IA não deve ganhar permissão irrestrita para alterar dados. No Alfred:
- leitura pode ser disponibilizada com escopo limitado;
- propostas de alteração devem ser apresentadas como prévia;
- criar, editar, concluir, excluir ou reagendar exige aprovação explícita;
- ações irreversíveis ou externas exigem confirmação adicional;
- toda ação deve ter validação de entrada e resultado auditável sem registrar conteúdo pessoal desnecessário.

### 3.3 Rede e bridge

`bridge/net.mjs` contém controles relevantes contra SSRF, incluindo bloqueios de destinos privados e tratamento de redirects/DNS. Isso é referência, não justificativa para adicionar um servidor agora. O MVP continua sem backend próprio. Se uma bridge for introduzida, ela precisará de threat model, allowlist, isolamento, autenticação local e testes específicos.

### 3.4 Voz

O módulo de voz do Jarvis pode inspirar uma implementação futura, mas suporte de navegador varia e reconhecimento de fala pode enviar áudio a serviços do sistema operacional/navegador. O Alfred deve informar quando isso ocorrer e oferecer alternativa por texto. Não ativar microfone continuamente por padrão.

### 3.5 Licença e ativos

O repositório Jarvis declara licença MIT. Antes de copiar qualquer arquivo, dependência ou ativo, verificar o texto de licença e preservar avisos de copyright. Áudios, fontes, imagens e outros assets podem ter licenças próprias e não devem ser presumidos como cobertos pela licença principal.

## 4. Arquitetura recomendada para o Alfred

Separar responsabilidades por contratos pequenos:

1. **Alfred Core:** tarefas, estudos, agenda, projetos, arquivos, produtividade e memória local. Continua como fonte de verdade.
2. **Alfred Intelligence:** interpretação de pedidos, recuperação de contexto e planejamento. Independente de provedor.
3. **Alfred Tools:** catálogo tipado de operações permitidas, com schemas, validação e permissões.
4. **Alfred Approval:** apresenta plano, impacto e dados que serão alterados; executa somente após aprovação.
5. **Alfred Voice:** adaptador opcional de fala para texto e texto para fala.
6. **Alfred Interface:** UI React atual, com experiência mobile prioritária.

Fluxo de referência:

```text
Pessoa
  ↓ texto ou voz opcional
Interface Alfred
  ↓
Intelligence (provider adapter)
  ↓ pedido estruturado / plano
Policy + validação + aprovação
  ↓
Tools com escopo limitado
  ↓
Serviços do Alfred Core
  ↓
IndexedDB / resultado apresentado
```

A inteligência não acessa IndexedDB diretamente. Ela solicita operações por ferramentas explícitas. Os serviços existentes continuam responsáveis por validação e persistência.

## 5. Contratos iniciais propostos

Os nomes são conceituais; ainda não foram implementados.

- `AIProvider`: `generate(request, context)` e retorno estruturado, sem assumir fornecedor.
- `AssistantRequest`: texto do usuário, contexto mínimo e metadados de consentimento.
- `ToolDefinition`: identificador, descrição, schema de entrada, classe de risco e política de aprovação.
- `ActionProposal`: resumo, operações propostas, registros afetados e impacto esperado.
- `ApprovalDecision`: aprovado ou recusado, associado à proposta específica.
- `AssistantResult`: resposta, propostas e avisos; nunca uma execução silenciosa.

A primeira versão deve suportar um adaptador manual/local sem provedor remoto. Isso permite testar fluxo, contexto e permissões sem enviar dados a terceiros.

## 6. Plano incremental de integração

| Fase | Entrega | Critério para avançar |
|---|---|---|
| 0 | Documentação e limites de segurança | Decisões revisadas e escopo claro |
| 1 | Contratos TypeScript e testes sem IA remota | Tipos, validação e políticas cobertos |
| 2 | Ferramentas somente leitura | Escopo mínimo e testes de autorização |
| 3 | Propostas de ação com aprovação | Nenhuma mutação antes da aprovação |
| 4 | Adaptador de provedor independente | Segredos fora do frontend e consentimento |
| 5 | Voz opcional | Alternativa por texto e controles de privacidade |
| 6 | Bridge local, somente se necessária | Threat model, autenticação e testes de rede |

## 7. Não fazer

- Não substituir React/Vite pelo runtime do Jarvis.
- Não acoplar o Alfred exclusivamente ao Claude ou Claude Code.
- Não colocar API keys no frontend.
- Não permitir que o modelo altere tarefas ou compromissos sem aprovação.
- Não adicionar backend/bridge antes de existir necessidade concreta.
- Não implementar escuta contínua como padrão.
- Não copiar assets sem verificar licenças individuais.
- Não tratar saída de IA como código ou HTML confiável.

## 8. Arquivos inspecionados

A análise consultou, entre outros, os seguintes arquivos do repositório original:
- `src/lib/brain.ts`
- `src/lib/bridge.ts`
- `src/lib/anthropic.ts`
- `src/lib/voice.ts`
- `src/lib/capabilities.ts`
- `src/main.tsx`
- `bridge/net.mjs`
- `bridge/ui.mjs`

Esta documentação registra uma análise arquitetural. **Nenhum código do Jarvis foi copiado nesta etapa.**
