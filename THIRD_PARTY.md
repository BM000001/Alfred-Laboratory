# Dependências de terceiros

Este inventário acompanha as dependências diretas declaradas em `package.json`. Bibliotecas de runtime são incluídas no bundle ou usadas como assets locais; portanto, a afirmação anterior de que o navegador usava apenas APIs nativas estava desatualizada.

## Dependências diretas de runtime

| Pacote | Uso | Versão declarada | Licença | Situação |
|---|---|---|---|---|
| react | interface | ^19.1.0 | a verificar | conferir licença e avisos da versão instalada |
| react-dom | renderização | ^19.1.0 | a verificar | conferir licença e avisos da versão instalada |
| pdfjs-dist | extração local de PDF | 6.5.438 | Apache-2.0 (declaração anterior; confirmar) | verificar avisos e assets distribuídos |
| tesseract.js | OCR local | 7.0.0 | a verificar | conferir licença e distribuição |
| @tesseract.js-data/por | dados do idioma português para OCR | 1.0.0 | a verificar | conferir licença e atribuição dos dados |
| tesseract.js-core | núcleo WebAssembly do OCR | 7.0.0 | a verificar | conferir licença e assets distribuídos |

## Dependências de desenvolvimento

O projeto também usa Vite, Vitest, TypeScript, bibliotecas de teste e pacotes de tipos, conforme `devDependencies` em `package.json`. A auditoria completa das licenças transitivas e dos avisos obrigatórios ainda está pendente. Não presuma que dependências de desenvolvimento nunca apareçam nos artefatos finais sem inspecionar o build.

## Verificação antes de distribuir

O teste `src/modules/thirdPartyInventory.test.ts` verifica que cada dependência direta de runtime apareça na tabela acima. **Ele não verifica as licenças**. Antes de distribuir, conferir os metadados e arquivos LICENSE/NOTICE das versões efetivamente instaladas, dependências transitivas, arquivos WebAssembly e modelos de idioma, e registrar os avisos exigidos. Não atribuir licenças por suposição.
