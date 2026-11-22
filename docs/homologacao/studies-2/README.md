# Central de Estudos no iPhone

Branch de integração `codex/studies-iphone-preview-client`. Prévia protegida [alfred-studies-iphone-preview](https://alfred-studies-iphone-preview.brianmarcondes2000.workers.dev).

## Percurso

Em Aprender, abra uma disciplina e selecione a unidade em Unidades. Toque em uma construção para abrir o painel. A Biblioteca abre os materiais. Em Material para exercícios, escolha o arquivo, confira os trechos e autorize o processamento remoto. Cada questão precisa de aprovação para entrar no banco. A aba Revisar mantém o estudo guiado.

O Campo de Alvos inicia com dez questões ou as disponíveis. O Laboratório usa questões do banco com trecho de origem e mostra o trecho durante a resolução. O Castelo usa até cinquenta questões disponíveis. Essas três atividades exigem pelo menos 80% de acertos em uma sessão completa. O Baú mantém a revisão espaçada e oferece um desafio de exatamente três frentes distintas. As alternativas vêm dos versos dos cartões. Duas respostas corretas aprovam. Perguntas ambíguas são descartadas. As atividades permitem rever os erros.

A última tentativa completa determina a indicação do painel. A seleção de uma unidade restringe a sessão e o histórico àquela unidade. Os rascunhos de questionário usam o mecanismo local existente por disciplina, unidade e atividade. A conclusão grava as respostas e suas fontes no histórico IndexedDB existente. Tentativas antigas sem identificação de atividade pertencem à prática. A configuração existente de visibilidade do mascote também vale para Estudos.

## Evidências

- [Ilha mobile](mobile.jpg), [ilha desktop](desktop.jpg), [painel da Biblioteca](painel.jpg), [boas-vindas](boas-vindas.png), [busto](busto.png) e [expressões do mesmo personagem](expressoes.png).
- Chromium local, com o pacote da prévia servido a partir do disco sob a origem esperada. Larguras de 320, 390 e 1280 pixels sem excesso de largura na página. Disciplina e Markdown sintéticos, quatro sessões corrigidas, uma tentativa por atividade após recarregar e zero exceções JavaScript. O botão de envio permaneceu desabilitado até o consentimento.
- TypeScript, build normal e build studies-preview. Vitest com 409 testes aprovados e um teste opcional de Ollama ignorado. A suíte do Worker inclui JWT assinado, titular, consentimento e limites. Contador diário individual conferido separadamente com dez admissões, uma recusa e admissão de um segundo sujeito em armazenamento de teste.
- Os testes do frontend usam resposta controlada para verificar a aprovação manual e a persistência. A verificação HTTP externa sem sessão exige login do Access. A homologação autenticada no aparelho depende do titular.
- As artes foram criadas com base na descrição visual. A fidelidade às imagens originais depende da comparação com os arquivos do proprietário.

## Retomada e publicação

Executar `npm ci`, `npm test` e `npm run build` no Laboratory. Para o pacote de homologação, definir `VITE_ALFRED_STUDIES_PREVIEW_ORIGIN` com a origem HTTPS da prévia e executar `npx vite build --mode studies-preview`; depois executar `node scripts/stamp-release.mjs` com o SHA do commit. Conferir o selo em dist/version.json. No Server, usar o Worker e a configuração dedicados descritos em worker/STUDIES_PREVIEW.md (PR 8). Manter o segredo do proprietário, o emissor e a audiência já configurados. A versão anterior da prévia é `f639a07e-0cdd-4e6d-b195-660dd9621ea0`; ela está disponível em Deployments do Worker para rollback.

Para encerrar a homologação, usar o Safari autenticado, enviar um trecho sintético, verificar a fonte retornada e salvar uma questão. Concluir um simulado com essa questão, fechar e reabrir o Safari e confirmar o histórico no Castelo ou no Campo de Alvos conforme a atividade escolhida.
