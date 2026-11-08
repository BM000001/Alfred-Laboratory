# Spike de transporte Google Apps Script

Este spike valida se o Safari do iPhone e o Chrome desktop conseguem carregar o Web App do Apps Script em um iframe e trocar mensagens com ele usando `postMessage` + `google.script.run`.

**Não integra o Google Calendar. Não lê nem grava eventos. Não contém tokens ou segredos.**

## 1. Criar o projeto Apps Script

1. Entre em [script.google.com](https://script.google.com/) com a conta Google que será usada pelo Alfred.
2. Crie um projeto independente chamado `Alfred Calendar Transport Spike`.
3. Substitua o conteúdo de `Code.gs` pelo arquivo deste diretório.
4. Crie um arquivo HTML chamado `Index` e copie `Index.html` deste diretório.
5. Salve o projeto.

## 2. Implantar como Web App

Em **Implantar → Nova implantação → Aplicativo da Web**:
- Executar como: **usuário que acessa o aplicativo da Web**.
- Quem tem acesso: **somente eu**.
- Implantar e copiar a URL terminada em `/exec`.

A combinação é intencional para o cenário pessoal aprovado. Não selecione “qualquer pessoa”.

## 3. Executar o harness

No clone local do Alfred-Laboratory:

```bash
npm install
npm run dev
```

Abra:

```
http://localhost:5173/spikes/google-calendar-transport/harness.html
```

Cole a URL `/exec`, carregue a ponte e execute o teste.

Para testar no iPhone, o harness precisa ser servido em HTTPS por uma origem autorizada. O domínio oficial `https://bm000001.github.io` está na allowlist do iframe; não publique um harness público sem revisar a allowlist e o escopo do teste.

## 4. Critérios de sucesso

- A página pai carrega o iframe sem bloqueio de frame.
- O iframe envia o sinal `ready`.
- A página pai envia a solicitação apenas para a origem Google que respondeu.
- O Apps Script responde por `google.script.run`.
- A página pai recebe e valida a resposta pelo mesmo iframe, origem e `requestId`.
- O resultado contém `ok: true`, `status: "ok"` e horário do servidor.

## 5. Critérios de falha / segurança

Registrar separadamente:
- erro de login ou acesso;
- iframe bloqueado;
- iframe carrega, mas não envia `ready`;
- `google.script.run` falha;
- retorno não chega à página pai;
- comportamento diferente entre Chrome e Safari;
- bloqueio por cookies/privacidade ou sessão Google.

Não usar `no-cors`, JSONP, token OAuth no frontend ou segredo compartilhado no JavaScript. Não adicionar ações de Calendar antes de o transporte passar nos testes.

## 6. Limites

Este projeto é descartável e separado do Alfred de produção. Não habilita Calendar API, não solicita escopos de calendário e não tem ações de escrita. O teste ainda depende de implantação manual pelo usuário na própria conta Google; o repositório não tem acesso à conta Apps Script.
