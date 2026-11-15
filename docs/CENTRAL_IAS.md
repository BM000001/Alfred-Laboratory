# Central de IAs — fundação

Execução e checkpoints: [Issue #51](https://github.com/BM000001/Alfred-Laboratory/issues/51). Depende do [PR #43](https://github.com/BM000001/Alfred-Laboratory/pull/43). A [Central de Comando planejada na #44](https://github.com/BM000001/Alfred-Laboratory/issues/44) permanece uma frente distinta; esta fundação não implementa aquele site, Google login ou coordenação de agentes.

Começamos pela Central e conectamos Estudos como primeiro consumidor. O Brain existente continua responsável pelo assistente e pelas ferramentas de agenda/tarefas. Esta mudança adiciona um despachante de operações limitadas, sem agentes autônomos nem acesso de modelos às ferramentas do Brain.

## Fronteiras

- Estudos preserva originais, executa OCR local e valida/salva recursos.
- A Central mantém solicitações, resultados, tentativas e erros em IndexedDB (`aiTasks`, versão de banco 14).
- Duas operações versionadas: `studies.analyze` e `studies.generate`.
- O provedor local reaproveita análise/geração conservadoras existentes; não é apresentado como modelo inteligente.
- O provedor remoto chama somente um serviço explicitamente configurado e autorizado por solicitação. O serviço delega a um modelo autohospedado e é independente do frontend.

## Fluxo inicial

Ao salvar em Estudos, a análise de texto e a geração local passam pela Central. O histórico fica em Configurações → Central de IAs. Etapas já concluídas continuam usando o cache do arquivo. Nenhum material passa automaticamente para a rede, inclusive quando a confiança é baixa.

Na Central, o proprietário pode preparar uma tarefa remota, revisar o texto completo e escolher incluir a imagem original para análise. O botão de envio exige consentimento para o destino e conteúdo exibidos, além do token em memória. O bloqueio global de saída de dados existente é respeitado. O histórico de auditoria registra somente metadados. Respostas com ID/versão incorretos ou formato inválido são rejeitadas.

Transcrição de VLM é proposta: a confiança declarada pelo próprio modelo não promove texto a fonte validada. A revisão/aplicação de transcrições remotas ao pipeline ainda não foi habilitada nesta fundação. Recursos remotos são filtrados por correspondência às evidências e aos recursos verificáveis pelo gerador local; não são salvos automaticamente.

As tarefas podem ser retomadas após recarga. Web Locks evita executar a mesma tarefa em duas abas quando suportado; o fallback coordena apenas esta aba. Tarefas com `running` depois de fechar a página podem ser retomadas manualmente. O servidor mantém cache idempotente de resultados concluídos. Cancelamento não apaga arquivos ou resultados concluídos. Não há migração de tarefas para outro endpoint com reaproveitamento de consentimento.

## Repositórios e execução

Por enquanto a Central está isolada em `services/ai-central`, dentro do Laboratory, para ter contrato e testes revisáveis junto ao primeiro consumidor. Não criamos outro repositório vazio nem dependemos de hospedagem paga. O diretório pode ser extraído para um repositório próprio quando o backend/modelo for escolhido; a integração é HTTP, não um import do servidor pelo aplicativo.

Consulte [instruções do serviço](../services/ai-central/README.md). Nenhum token de provedor vai em `VITE_*`, no bundle ou no IndexedDB. O endereço do serviço pode ser salvo; o token precisa ser informado novamente ao abrir a tela.

## Próxima ativação

1. Separar fotos reais que falharam e uma referência de transcrição.
2. Escolher infraestrutura para executar o modelo, sem depender de desempenho no Pentium/8 GB.
3. Homologar um checkpoint open source com imagens, fórmulas e português; medir latência, memória e qualidade.
4. Configurar URL HTTPS, token e origem permitida; testar a conexão sem enviar documentos.
5. Autorizar um material de teste e comparar a proposta à fonte.
6. Só depois ampliar validação semântica e habilitar aplicação de resultados e mais tipos de tarefas.

Não estão incluídos: sincronização entre dispositivos, múltiplos usuários, precificação monetária, download de pesos, GPU provisionada ou homologação em Safari físico. O serviço registra tokens informados pelo endpoint, mas ainda não estima custo de infraestrutura. Novas operações devem declarar contrato, limites, validação e regra de saída de dados antes de serem registradas.
