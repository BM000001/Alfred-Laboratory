import { DATA_CLASSES, type DataClass } from "../domain/entities.js";
import { DATA_CLASS_LABELS } from "../domain/privacy.js";
import type { ProviderDescriptor } from "./providers.js";

/** Um item de conteúdo que sairia do aparelho. */
export interface OutgoingItem {
  /** Rótulo para exibição ao usuário. Não entra nos motivos de bloqueio. */
  readonly label: string;
  readonly dataClass: DataClass;
  readonly text: string;
}

export interface EgressRequest {
  readonly provider: ProviderDescriptor;
  readonly items: readonly OutgoingItem[];
  /** Classes que o usuário confirmou explicitamente nesta ação. */
  readonly acknowledgedClasses: readonly DataClass[];
  /** Verdadeiro somente quando o usuário pressionou o botão de ação. */
  readonly userInitiated: boolean;
}

export interface EgressDecision {
  readonly allowed: boolean;
  /** Motivos em português, sem conteúdo do usuário. */
  readonly reasons: readonly string[];
  readonly providerId: string;
  readonly classes: readonly DataClass[];
  readonly itemCount: number;
  readonly characterCount: number;
}

/**
 * Portão de envio. Função pura: decide se os itens podem sair do aparelho.
 * Bloqueia por padrão; liberar exige todas as condições ao mesmo tempo.
 */
export function authorizeEgress(request: EgressRequest): EgressDecision {
  const { provider, items, acknowledgedClasses, userInitiated } = request;
  const reasons: string[] = [];

  if (provider.status !== "enabled") reasons.push("O provedor selecionado está desabilitado.");
  if (provider.kind === "none") reasons.push("O modo sem IA não envia dados.");
  if (!userInitiated) reasons.push("O envio precisa ser iniciado por uma ação sua.");
  if (items.length === 0) reasons.push("Nenhum conteúdo foi selecionado.");

  const classes = [...new Set(items.map((i) => i.dataClass))].filter((c) =>
    DATA_CLASSES.includes(c),
  );

  for (const dataClass of classes) {
    const label = DATA_CLASS_LABELS[dataClass];
    if (!acknowledgedClasses.includes(dataClass)) {
      reasons.push(`Confirme o envio de conteúdo da classe ${label}.`);
    }
    if (
      provider.sendsDataOutsideDevice &&
      dataClass !== "public" &&
      !provider.allowsSensitiveClasses
    ) {
      reasons.push(`O provedor ${provider.name} não está autorizado a receber conteúdo da classe ${label}.`);
    }
  }

  return {
    allowed: reasons.length === 0,
    reasons,
    providerId: provider.id,
    classes,
    itemCount: items.length,
    characterCount: items.reduce((total, i) => total + i.text.length, 0),
  };
}

/** Converte a decisão em dados de registro de envio. O conteúdo nunca é incluído. */
export function toEgressLogInput(decision: EgressDecision): {
  providerId: string;
  classes: readonly DataClass[];
  decision: "allowed" | "blocked";
  itemCount: number;
  characterCount: number;
} {
  return {
    providerId: decision.providerId,
    classes: decision.classes,
    decision: decision.allowed ? "allowed" : "blocked",
    itemCount: decision.itemCount,
    characterCount: decision.characterCount,
  };
}
