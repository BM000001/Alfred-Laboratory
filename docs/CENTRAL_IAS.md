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

## Gemini e Groq: configurar e comparar fotos

A seção **Configurações → Central de IAs → Gemini e Groq** configura conexões de
API no serviço da Central. Não é login nas contas dos aplicativos de chat.
Esta implementação está no PR #52; não basta abrir a versão pública anterior.

1. Inicie o serviço Node conforme `services/ai-central/README.md`. Para o celular,
   ele precisa estar acessível por HTTPS, com a origem do Alfred autorizada. Não
   exponha a porta sem autenticação/TLS. Nenhum servidor remoto é provisionado
   automaticamente e o GitHub Pages não executa este backend.
2. No [Google AI Studio](https://aistudio.google.com/apikey) e no
   [console Groq](https://console.groq.com/keys), crie as chaves de contas Free,
   sem ativar faturamento. Não publique nem envie as chaves pelo chat/GitHub.
   Confira as [condições Gemini](https://ai.google.dev/gemini-api/docs/billing),
   as [condições Groq](https://console.groq.com/docs/billing-faqs), limites e
   políticas de tratamento de material acadêmico antes de enviar suas fotos.
3. Informe endereço e token da Central na tela. O token dura somente nessa tela;
   o endereço é salvo no dispositivo. Em “Adicionar conexão”, selecione provedor,
   nome e chave e confirme as condições da conta. A consulta inicial apenas lista
   modelos; não faz uma análise. A chave é enviada ao backend e removida do campo.
4. Escolha no catálogo um modelo que aceite imagens **e tenha cota gratuita na
   sua conta**, verificando no painel do provedor; confirme a seleção. Catálogo
   não comprova preço, suporte a visão ou saldo. A confirmação é sua declaração,
   não uma garantia técnica de custo zero. Não ative faturamento se quer custo
   zero; o Alfred não ativa cobrança nem escolhe alternativa paga.
5. Crie uma disciplina em Estudos. Selecione uma conexão Gemini e outra Groq,
   a disciplina e uma foto JPG/PNG/WebP de até 8 MB. HEIC precisa de conversão.
   Revise a instrução e autorize o envio aos dois provedores. O original é salvo
   localmente antes das duas tarefas; ambas ficam registradas antes do primeiro
   envio. Não é necessário transcrever o quadro.
6. Compare as propostas lado a lado (empilhadas no celular). Os modelos recebem
   a mesma foto e instrução; transcrição e incertezas ficam separadas. Não há
   nota de qualidade inventada nem geração/salvamento automático de cartões.
   Dois modelos concordarem não demonstra fidelidade ao quadro.
7. Após recarga, os resultados continuam no IndexedDB. Para uma tarefa pendente,
   informe de novo o token, revise o provedor/modelo exibido e autorize a retomada.
   A Central busca a resposta pronta na caixa privada antes de repetir o envio.
   Cota esgotada/erro não elimina a resposta válida do outro provedor. Não existe
   fallback automático, repetição automática de inferência ou troca de modelo.

O backend guarda as chaves com AES-256-GCM em `CENTRAL_DATA_DIR/.connections/`;
metadados públicos não incluem segredos. A chave mestra fica no mesmo servidor:
proteja a pasta, backups e permissões/ACL do Windows. Isso não protege contra um
servidor comprometido. Remover uma conexão apaga-a do cofre, não revoga a chave
no provedor nem remove cópias antigas de backups. Revogue no painel se necessário.
Os resultados da caixa privada são arquivos de dados autenticados, não commits
nem issues públicos do GitHub. A instalação é de usuário único, com um processo
por diretório; não oferece isolamento entre múltiplos usuários com o mesmo token.

Cancelar interrompe a espera/envio no navegador; o provedor pode concluir uma
inferência iniciada. Se a resposta já foi persistida pelo backend, a retomada a
recupera sem inferência. Uma queda do backend antes da gravação pode exigir nova
inferência: não há promessa de execução exatamente uma vez nesse intervalo.
Não limpar dados do navegador se pretende preservar os originais/resultados locais.

### Limite da validação desta entrega

Os testes automatizados usam provedores controlados para verificar autenticação,
contratos, imagem, cofre, cota, retomada e conservação de resultados. Não são
medição da qualidade de Gemini/Groq em manuscritos. Nenhuma chave real foi
configurada e nenhuma foto real foi enviada aos provedores nesta implementação.
