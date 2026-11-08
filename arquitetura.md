# Arquitetura do Alfred (Etapa 1)

## Camadas

- **Domínio** (`src/domain/`): entidades, validação, fábricas e identificadores. Puro TypeScript, sem dependência de navegador ou de serviço externo.
- **Privacidade e IA** (`src/ai/`): classificação de dados, portão de envio (*egress gate*), descritores de provedores e adaptador Manual.
- **Armazenamento** (`src/storage/`): interface de repositório, implementação em memória (testes) e em IndexedDB (navegador), backup e criptografia.
- **Aplicação** (`src/app/`): interface do usuário, sem lógica de negócio além da orquestração.

Regra de dependência: a aplicação depende de todas as camadas; as camadas de domínio e privacidade não dependem da aplicação nem do armazenamento.

## Entidades

Todas as entidades compartilham:

| Campo | Finalidade |
|---|---|
| `id` | identificador universal (UUID v4), gerado no aparelho |
| `kind` | tipo da entidade |
| `createdAt`, `updatedAt` | data ISO 8601 em UTC |
| `deletedAt` | exclusão lógica (*tombstone*), `null` se ativo |
| `deviceId` | identificador do aparelho que criou ou alterou |
| `schemaVersion` | versão do esquema em que o registro foi gravado |

Tipos: `task`, `subject`, `note`, `egress-log`.

## Preparação para sincronização

Os campos acima permitem uma futura sincronização sem reescrever o domínio:
- identificadores não colidem entre aparelhos;
- `updatedAt` permite resolver conflitos por último a gravar (*last-writer-wins*), que é a regra já aplicada na importação de backup;
- `deletedAt` propaga exclusões.

Esta etapa **não implementa sincronização**.

## Classificação de privacidade

| Classe | Entidades por padrão | Observação |
|---|---|---|
| `public` | — | apenas quando o usuário marca explicitamente |
| `personal` | tarefas, texto livre | padrão conservador para texto livre |
| `academic` | disciplinas, notas | materiais de estudo |

Entradas de texto livre são classificadas como `personal` por padrão.

## Portão de envio (regras)

Função pura `authorizeEgress(request)`. Bloqueia quando:

1. o provedor está desabilitado ou é do tipo `none`;
2. a ação não foi iniciada pelo usuário (`userInitiated` falso);
3. não há itens a enviar;
4. alguma classe presente não foi reconhecida pelo usuário em `acknowledgedClasses`;
5. o provedor envia dados para fora do aparelho e não é autorizado a receber a classe (`allowsSensitiveClasses` falso para `personal` ou `academic`).

O registro de envio (`egress-log`) guarda provedor, classes, quantidade de itens, tamanho em caracteres e decisão. **Nunca guarda o conteúdo.**

## Formato de backup

Arquivo JSON:

```json
{
  "format": "alfred-backup",
  "formatVersion": 1,
  "schemaVersion": 1,
  "exportedAt": "2026-...Z",
  "deviceId": "...",
  "entityCount": 0,
  "checksum": "sha256 hex de JSON.stringify(entities)",
  "entities": []
}
```

Importação:
- rejeita formato desconhecido, `formatVersion` desconhecida e `schemaVersion` maior que a suportada;
- recalcula o checksum e rejeita divergência;
- valida cada entidade e ignora as inválidas, com relatório;
- mescla por `id`, mantendo a versão de `updatedAt` mais recente.

Backup criptografado (opcional): envelope com `format` `alfred-backup-encrypted`, derivação PBKDF2-SHA256 (600.000 iterações, sal aleatório de 16 bytes), cifra AES-GCM-256 com IV aleatório de 12 bytes. Sem a senha, o conteúdo não é recuperável.

Limitação: o checksum detecta corrupção acidental, não adulteração deliberada. A criptografia protege o conteúdo; o checksum não substitui assinatura.

## Provedores

Registrados em `src/ai/providers.ts`:

- `none`: sem IA. Sempre disponível.
- `manual`: gera texto para o usuário copiar. O Alfred não transmite nada.

Provedores futuros (por exemplo, um adaptador remoto) devem ser adicionados como novos descritores e implementações, sem alterar o domínio. Nenhum provedor remoto está registrado nesta etapa.
