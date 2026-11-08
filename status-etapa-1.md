# Status da Etapa 1

## Escopo entregue

- Base TypeScript estrita, sem dependências de runtime; build em `dist/js` e site estático em `site/`.
- Domínio: tarefas, disciplinas, notas e registros de envio, com identificadores universais, data de criação e alteração, exclusão lógica e versão do esquema.
- Validação de fronteira: todo registro vindo do armazenamento ou de arquivo importado é validado antes de entrar no domínio. Mensagens em português.
- Armazenamento local em IndexedDB, com leitura validada, e implementação em memória para testes.
- Backup versionado com checksum, importação por mesclagem (última alteração prevalece) e exclusões propagadas.
- Backup cifrado com senha: PBKDF2-SHA256 (600.000 iterações) e AES-GCM-256, pela Web Crypto API.
- Portão de envio: classifica dados (público, pessoal, acadêmico), exige ação do usuário e confirmação por classe, e registra os envios sem o conteúdo.
- Adaptador Manual: gera o texto para copiar, somente após o portão autorizar. Neutraliza marcações injetadas pelo conteúdo do usuário.
- Interface em português brasileiro, responsiva, sem `innerHTML`, sem chamadas de rede.
- PWA: manifesto, service worker com cache dos recursos do próprio site, ícones inclusive para iPhone (sem transparência).
- Workflow de publicação no GitHub Pages (não executado).

## Não implementado (conforme as decisões)

- Gemini ou qualquer provedor remoto (D13). O descritor não está registrado, e um teste garante isso.
- Canvas LMS, inclusive chamadas à API e solicitação de token (D5).
- Sincronização entre dispositivos (D11). A estrutura de dados já prevê.
- Voz, modelo local (D4, item 5 das decisões).
- Login do Claude (D8).
- Hábitos e Alfred Hoje, que pertencem às etapas seguintes do plano.
- Importação de arquivos de estudo (PDF e texto), prevista para a Etapa 6.

## Tecnologias

TypeScript 6.0 (compilação e tipos), Node.js 22 (testes e build), APIs nativas do navegador: IndexedDB, Web Crypto, Service Worker, Cache API, Clipboard, Blob. Dependências de desenvolvimento: `typescript` e `@types/node`. Não há framework de interface nem bundler nesta etapa.

Decisão técnica: sem Vite e sem React. Motivo: o ambiente em que esta etapa foi executada não tem acesso ao registro npm, então não foi possível instalar essas dependências. A escolha também reduz a superfície de dependências. Reavaliar na Etapa 2 se a complexidade da interface justificar.

## Testes executados

Comando: `npm test` (compila com TypeScript estrito e executa `node --test`).

Resultado: **51 testes, 51 aprovados, 0 falhas.**

| Arquivo | Cobertura |
|---|---|
| `tests/domain.test.ts` | identificadores UUID v4; criação e validação de tarefas; datas reais (rejeita 30 de fevereiro); alterações preservam identidade; exclusão lógica; validação de registros de fonte não confiável (tipo desconhecido, versão futura, datas inconsistentes, tipos errados) |
| `tests/privacy.test.ts` | classes padrão; portão de envio (ação do usuário, confirmação, provedor desabilitado, modo sem IA, provedor remoto sem autorização); motivos sem conteúdo; registro de envio sem conteúdo; adaptador Manual inclui só os itens selecionados e neutraliza marcações injetadas; nenhum provedor remoto registrado |
| `tests/backup.test.ts` | exportação e importação; recusa JSON inválido, formato estranho, versão futura, arquivo adulterado (checksum); nada gravado quando a verificação global falha; registros inválidos são contados; mesclagem por última alteração; exclusão propagada; cifração (sem texto em claro); senha obrigatória; senha errada sem gravação; senha curta recusada |
| `tests/storage.test.ts` | armazenamento em memória; consulta de registros ativos por tipo |

Verificações adicionais:
- Build de produção gerado (`npm run build`): 22 recursos no site, com versão de cache derivada do conteúdo.
- Sintaxe do service worker verificada.
- Módulos de domínio, privacidade e IA carregados em Node a partir do build.
- Busca no código: nenhum `innerHTML`, nenhuma chamada de rede, nenhum segredo, `localStorage` usado somente para o identificador do aparelho.

## Limitações conhecidas

1. **A interface não foi testada em navegador.** Não há navegador disponível neste ambiente. O HTML, o CSS e a lógica de eventos foram compilados, mas não executados. Os testes automatizados cobrem a lógica, não a tela.
2. **IndexedDB e service worker não foram executados.** A implementação `IdbStore` e o comportamento offline dependem do roteiro manual (`docs/testes-manuais-iphone.md`).
3. **Pages não foi executado.** O workflow está escrito, mas não foi disparado. Depende da pendência P6.
4. **Risco de perda de dados no iPhone (hipótese).** Políticas de armazenamento do WebKit podem apagar dados de sites que não foram instalados na tela de início após período sem uso. Não verifiquei isso na documentação oficial. Mitigação: instalação na tela de início e backups regulares, orientados pelo app (aba Backup). O roteiro T5 mede esse comportamento.
5. **Formulários perdem a digitação quando a tela é redesenhada.** Campos de senha do backup são mantidos fora da árvore de estado, mas os demais formulários são recriados ao salvar. Aceitável no MVP.
6. **Mensagens de erro vêm do domínio.** Estão em português, mas não são personalizadas por campo na interface.
7. **O backup não é protegido contra adulteração deliberada sem senha.** O checksum detecta corrupção, não alteração intencional. Com senha, o AES-GCM garante a integridade.
8. **Não há `package-lock.json`.** Sem acesso ao registro npm, o lock não foi gerado (pendência P5). O build depende da instalação de `typescript` e `@types/node` nas versões indicadas.
9. **Ícones gerados a partir de SVG com `sharp`.** O processo não está automatizado no repositório; os SVG-fonte estão em `public/icons/`.
10. **Autor dos commits é um marcador.** Os commits foram criados com identidade provisória. Antes de publicar, reescreva o autor (ver instruções abaixo).

## Pendências

| ID | Pendência | Situação |
|---|---|---|
| P1 | Licença do Alfred | aberta |
| P2 | Linha de copyright do Jarvis (copiar do LICENSE original) | aberta. Nenhum código do Jarvis foi copiado, então não bloqueia esta etapa |
| P3 | Políticas do Canvas | aberta. Integração não implementada |
| P4 | Verificação local do código do Jarvis (`bridge/`, `src/`) | aberta. Não bloqueia |
| P5 | `package-lock.json` | aberta. Gerar com `npm install` na máquina do usuário e commitar |
| P6 | Confirmar GitHub Pages como hospedagem | aberta. Necessária para T1 a T11 |
| P7 | Autoria dos commits | aberta. Ver instruções |

## Critérios da Etapa 1 (conforme o relatório anterior)

| Critério | Situação |
|---|---|
| Build sem erro | atendido (tsc estrito e build do site) |
| Testes passam | atendido (51/51) |
| Nenhum segredo no código ou no bundle | atendido por busca; a checagem automatizada fica para o CI |
| Nenhuma biblioteca sem licença verificada | atendido: nenhuma dependência de runtime |
| Funcionalidade testada no computador e no celular | **não atendido**: depende de execução manual (roteiro) |
| Nenhum dado enviado sem ação do usuário | atendido por teste |
| Documentação em português brasileiro | atendido |
| Aprovação do usuário | pendente |

## Como aplicar no repositório de destino

Os commits estão em um repositório local, com histórico pequeno e documentado. Para publicar em `BM000001/Alfred`:

```
git clone alfred.bundle Alfred
cd Alfred
git remote set-url origin https://github.com/BM000001/Alfred.git
git push -u origin main
```

Antes do push, para ajustar o autor (substitua pelos seus dados):

```
git rebase --exec 'git commit --amend --no-edit --reset-author' --root
```

Depois da primeira instalação na sua máquina, execute `npm install` e confirme que `npm test` passa, então gere e comite o `package-lock.json` (P5).
