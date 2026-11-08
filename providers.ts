/**
 * Descritores de provedores de IA disponíveis no aplicativo.
 *
 * Nenhum provedor remoto está registrado nesta etapa. Serviços externos só entram
 * aqui depois de uma decisão explícita registrada em docs/decisoes.md.
 */
export type ProviderKind = "none" | "manual" | "remote";

export interface ProviderDescriptor {
  readonly id: string;
  readonly name: string;
  readonly kind: ProviderKind;
  readonly status: "enabled" | "disabled";
  /** true quando o provedor transmite dados para fora do aparelho sem ação manual do usuário. */
  readonly sendsDataOutsideDevice: boolean;
  /** true quando o provedor pode receber dados pessoais e acadêmicos. */
  readonly allowsSensitiveClasses: boolean;
  readonly description: string;
}

export const PROVIDERS: readonly ProviderDescriptor[] = [
  {
    id: "none",
    name: "Sem IA",
    kind: "none",
    status: "enabled",
    sendsDataOutsideDevice: false,
    allowsSensitiveClasses: false,
    description: "Todas as funções de organização funcionam sem IA.",
  },
  {
    id: "manual",
    name: "Manual (copiar e colar)",
    kind: "manual",
    status: "enabled",
    sendsDataOutsideDevice: false,
    allowsSensitiveClasses: true,
    description:
      "O Alfred gera um texto. Você decide se e onde copiá-lo. O envio é feito por você, fora do aplicativo.",
  },
];

export function findProvider(id: string): ProviderDescriptor | undefined {
  return PROVIDERS.find((p) => p.id === id);
}
