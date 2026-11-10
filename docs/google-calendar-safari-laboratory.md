# Google Calendar no laboratório — integração em teste

Este branch usa como base a proposta [Alfred PR #104](https://github.com/BM000001/Alfred/pull/104).
A navegação e o IndexedDB do Alfred-Laboratory permanecem isolados do repositório principal.

## Estado
- Painel Google Calendar incluído na Agenda do laboratório.
- Serviço de sincronização local, seleção de calendários e writes confirmados integrados.
- Backend de Apps Script, comunicação RPC e validação simulada do contrato presentes.
- Atualizações/exclusões remotas exigem ETag específico no navegador e no Apps Script.
- Nenhuma credencial é embutida no repositório.
- Nenhum script Google real foi implantado nesta branch.
- Não há evidência de sincronização com conta real ou teste físico no Safari do iPhone.

## Ativação futura
1. Revisar segurança e testar o Code.gs e o Index.html em Apps Script com execução como usuário que acessa e acesso privado.
2. Confirmar autorização OAuth, serviço Calendar API, canal postMessage e comportamento das abas no Safari.
3. Definir no ambiente de build a URL HTTPS /exec em VITE_GOOGLE_APPS_SCRIPT_URL; sem ela a interface informa que não foi configurada.
4. Executar testes de leitura, escrita com confirmação, conflitos de ETag, desconexão e reabertura.
5. Só considerar integração ao Alfred principal após aprovação humana; nunca fazer merge automaticamente.

**Risco conhecido:** a ponte depende do opener do Apps Script sandbox e pode não funcionar no Safari. CI e mocks não comprovam uso real.
