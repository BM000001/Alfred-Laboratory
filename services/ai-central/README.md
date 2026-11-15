# Central de IAs — serviço opcional

Este serviço integra um modelo **autohospedado** com endpoint de chat compatível com OpenAI. Não contém modelos, não baixa pesos e não contrata APIs. O modo local do Alfred funciona independentemente dele.

Requer Node.js 22 ou superior. Usa módulos nativos; nenhuma dependência adicional.

## Iniciar em Windows / PowerShell

Na raiz do checkout:

```powershell
Copy-Item services/ai-central/.env.example services/ai-central/.env
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Coloque o segredo gerado em `CENTRAL_TOKEN` no arquivo `.env`. Não publique nem envie esse valor em chat. Configure:

- `MODEL_URL`: URL completa de `/v1/chat/completions` do seu servidor de modelo.
- `MODEL_ID`: identificador efetivamente oferecido por esse servidor.
- `MODEL_TOKEN`: segredo do servidor do modelo, somente se necessário.
- `CENTRAL_ALLOWED_ORIGINS`: origens exatas permitidas, separadas por vírgula. Uma origem não inclui caminho (`https://bm000001.github.io`).
- `CENTRAL_DATA_DIR`: diretório privado onde serão guardadas respostas concluídas.

```powershell
npm run central:start
```

O serviço inicia em `127.0.0.1:8787`. Sem `MODEL_URL` e `MODEL_ID`, a verificação de saúde informa `ready: false` e executar retorna 503. Não há sucesso simulado.

Em Configurações → Central de IAs no Alfred, informe a URL do serviço e o token. O token da Central fica só em memória; a chave do modelo fica somente no servidor.

**iPhone:** `localhost` significa o próprio iPhone. Para acesso por outro dispositivo, hospede a Central atrás de HTTPS, com autenticação, na máquina/servidor escolhido. Não exponha uma porta sem TLS. O GitHub Pages hospeda somente o frontend. Este serviço foi preparado para um proprietário, não para múltiplas contas públicas.

## Modelo

O primeiro candidato de teste é um VLM open source (por exemplo, um checkpoint Qwen-VL compatível com o servidor escolhido). Configure o nome real do checkpoint, sem presumir que uma API de OCR dedicada aceite chat. PaddleOCR-VL tem protocolo próprio e requer adaptador adicional. Não instalamos modelo no Pentium/8 GB informado: hardware e qualidade em manuscrito real ainda precisam de teste.

O endpoint deve aceitar `messages` com imagens em `image_url`, `response_format: json_object`, `temperature` e `max_tokens`. Não alegamos compatibilidade universal: a integração real com o checkpoint escolhido é a próxima homologação. Nesta etapa o contrato é testado com servidor de inferência controlado.

## Operações e privacidade

- `GET /health`: autenticado, mostra versão, operações e se há configuração de modelo.
- `POST /v1/tasks`: autenticado; operações `studies.analyze` e `studies.generate`.
- Análise recebe texto e imagem opcional JPG/PNG/WebP. Geração recebe texto, nunca imagem.
- Prompts são versionados e definidos no servidor; instruções dentro do material não concedem acesso a ferramentas.
- A tarefa mantém ID estável nas retomadas. Respostas concluídas são gravadas atomicamente e reutilizadas após reinício. Reutilizar ID com conteúdo/modelo diferente retorna 409.
- Uma inferência simultânea por processo; excesso retorna 429. O navegador mantém a fila e exige ação para retomar após falha.
- Cancelar no navegador interrompe a espera/envio, mas a inferência em andamento pode terminar; o resultado é guardado para a mesma tarefa. Se o servidor cair antes de persistir a resposta, poderá ser necessário repetir a inferência. Não há promessa de execução exatamente uma vez.
- Respostas em disco contêm conteúdo acadêmico. Restrinja acesso e use disco criptografado. Não há política automática de expurgo nesta primeira versão; apague o diretório de dados quando desejar descartar o cache. Não são guardados originais nem tokens nesse cache.
- Um processo por diretório de dados. Réplicas exigem armazenamento transacional e controle de concorrência compartilhado.
- A validação no Alfred é obrigatória. Transcrição remota é proposta não verificada e não substitui o original. Geração remota ainda aceita somente recursos verificáveis pelo gerador determinístico existente; paráfrases novas são descartadas. Nenhum resultado remoto entra automaticamente no banco de cartões.

## Testes

```powershell
npm run central:test
npm test
npm run build
npm run build:pages
```

### Conexões Gemini/Groq e caixa privada

Além do modelo próprio opcional, esta versão oferece `/v1/connections` autenticado
(GET metadados, POST chave+catálogo), `/v1/connections/:id` (PATCH modelo confirmado,
DELETE conexão) e `GET /v1/tasks/:id` (resposta já concluída). As URLs dos provedores
são fixas no servidor. Não há OAuth nem reaproveitamento de assinatura de chat.
Chaves ficam no cofre AES-256-GCM dentro de `CENTRAL_DATA_DIR/.connections` com
chave mestra local. Proteja toda a pasta e os backups (ACL no Windows); o cofre
não protege contra comprometimento do servidor. Não utilize múltiplos processos
com o mesmo diretório. O token da Central dá acesso a todas as conexões/respostas.

Cada tarefa de API fixa conexão, revisão e modelo e exige `freeTierConsent:true`.
Conexão/modelo alterados exigem nova preparação; respostas prontas podem ser
recuperadas na caixa autenticada mesmo depois de remover a conexão. Confirmação
Free não consulta faturamento: use contas sem billing e valide modelo/cota no
painel. Nenhuma alternativa paga é escolhida e 429 não dispara retry automático.
Veja o passo a passo em `docs/CENTRAL_IAS.md`.
