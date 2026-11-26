# Alfred Studies 2.2 — preparação de aulas, questões e flashcards por IA

Status: **Laboratory PR #87 e Server PR #8 em rascunho; implantação de frontend same-origin ainda pendente**.

## Estado verificado

- O Worker **já implantado** na Cloudflare aceita `POST /api/studies/questions` com até 3 questões por chamada. Ele exige autenticação Cloudflare Access, usuário autorizado, consentimento explícito e cotas de uso.
- O **código ainda não publicado** do Server PR #8 amplia o Worker com `/api/studies/lessons`, `/api/studies/flashcards` e `POST /api/studies/prepare`. A rota `prepare` gera um pacote limitado a até 2 aulas, 2 questões e 2 flashcards em uma chamada, economizando a cota de **2 requisições por minuto** e **10 por dia por usuário**.
- O cliente do Laboratory tenta `/api/studies/prepare`; quando recebe 404 de uma versão antiga do Worker, retorna à rota somente de questões, deixando aulas e flashcards explicitamente pendentes.
- Nada disso cria conteúdo local automaticamente por regras; sem IA real, são preservados apenas original, extração, análise e histórico.

## Segurança e privacidade

- O Worker exige `Origin` equivalente à origem HTTPS configurada, autenticação Access válida e conta permitida. GitHub Pages não pode chamar a API privada diretamente com segurança.
- `VITE_STUDIES_AI_ORIGIN` só ativa o cliente quando é **exatamente a mesma origem HTTPS do aplicativo**. A variável é uma origem pública, **não uma credencial**. Nunca publicar JWT, token do Cloudflare Access nem chave de API no JavaScript do frontend.
- A pessoa precisa autorizar o envio. O aplicativo envia somente até **3 trechos de até 1.200 caracteres**, extraídos do próprio material, com identidade do trecho (`trecho-1` etc.).
- Respostas e flashcards devem ter respostas literais fundamentadas em trechos recebidos. Aulas contêm explicações e exemplos **explicitamente identificados como conteúdo elaborado por IA**, com a fonte original disponível. A validação literal reduz erros, mas não comprova integralmente a correção pedagógica: revisão humana segue importante.
- Sem conexão, autenticação, cota ou resposta adequada, o conteúdo não é inventado; usuário vê falha ou estado pendente e pode tentar novamente.
- Os resultados são salvos localmente com disciplina, unidade e arquivo de origem; há identificação estável para evitar duplicações e suporte a processamento interrompido.

## Etapas visíveis

1. Análise e extração local do original.
2. Preparação das aulas pela IA.
3. Preparação das questões pela IA.
4. Preparação dos flashcards pela IA.
5. Montagem da trilha a partir dos materiais realmente salvos.

As etapas refletem execução e persistência reais. Se a versão do Worker não oferecer o pacote completo, as modalidades ausentes não serão anunciadas como prontas. Não inventar porcentagens e não prometer processamento com o iPhone fechado sem infraestrutura remota.

## Próxima etapa de infraestrutura (pendente)

1. Publicar o Worker revisado do **Server PR #8** somente após validar CI, políticas e configuração segura, sem afetar `alfred-edge-api` de produção.
2. Servir o build do Laboratory na **mesma origem HTTPS do Worker privado**, protegido pelo Cloudflare Access; não utilizar um site público de GitHub Pages como substituto.
3. Configurar `VITE_STUDIES_AI_ORIGIN` somente no build dessa prévia, nunca como segredo.
4. Homologar no Safari físico com conta autorizada e com conta não autorizada: login, consentimento, importação, geração de pacote, origem, quotas, falhas, reinício, progressão e persistência.
5. Após aprovação, decidir se a arquitetura de produção precisará de login Google individual e expansão de limites/infraestrutura. Não fazer merge automático em nenhum repositório.

**Estado atual:** CI automatizado não substitui um teste de geração real via navegador protegido; não declarar a Fase 1.1 concluída até essa validação.
