# Homologação iPhone — Alfred-Laboratory

Relacionado: #8. Branch: `fix/iphone-preview-current-base-20261108`.

## Estado atual
Este PR prepara **apenas a validação e o artefato de build**. Não publica um site. A URL de testes **não existe até a configuração e verificação do deploy**.

## Isolamento obrigatório antes de publicar
- Produção: `https://bm000001.github.io/Alfred/`.
- Laboratório: usar exclusivamente a origem/caminho `https://bm000001.github.io/Alfred-Laboratory/` se GitHub Pages estiver configurado para este repositório; nunca implantar o build do laboratório no Pages de `Alfred`.
- Conferir no código o escopo do service worker, links absolutos, manifest `start_url`/`scope`, cache names, IndexedDB e comportamento de importação/exportação antes de ativar publicação. Um caminho distinto na mesma origem **não garante isolamento do IndexedDB**, que é por origem; para isolamento forte usar domínio/subdomínio separado ou namespace distinto de armazenamento, validado em testes.
- Não utilizar dados pessoais reais no laboratório até comprovar isolamento e recuperação por backup.

## Portões de entrega
1. CI executa `npm install --no-audit --no-fund`, `npm test`, TypeScript e Vite com base `/Alfred-Laboratory/`.
2. Revisar assets PWA, OCR e caminhos absolutos no build.
3. Definir hospedagem separada e verificar HTTP 200 e carregamento dos recursos no Safari.
4. Verificar instalação PWA, funcionamento offline, armazenamento independente e rollback.
5. Registrar resultados e somente então disponibilizar URL para o usuário.
6. Nunca alterar `baseline/alfred-main` ou o Alfred original sem autorização explícita.

## Testes manuais mínimos
- Abrir URL no Safari do iPhone; navegação e atualização sem tela branca.
- Criar dados fictícios, recarregar, fechar/reabrir e confirmar persistência.
- Confirmar que os dados de produção não aparecem no laboratório e vice-versa.
- Verificar PWA/offline e restauração de backup de teste.
- Confirmar que nenhuma integração escreve no calendário sem consentimento.

## Observação
Este pipeline não implica agentes autônomos em execução, merge, publicação ou aprovação de testes. Evidências do GitHub Actions são necessárias.
