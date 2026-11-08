import type { DataClass, EntityKind } from "./entities.js";

export const DATA_CLASS_LABELS: Readonly<Record<DataClass, string>> = {
  public: "pública",
  personal: "pessoal",
  academic: "acadêmica",
};

/**
 * Classe padrão de cada tipo de registro. Conservadora: quando houver dúvida,
 * o dado é tratado como pessoal ou acadêmico.
 * Registros de log de envio nunca são enviados, então não têm classe.
 */
export function defaultClassOf(kind: EntityKind): DataClass | null {
  switch (kind) {
    case "task":
      return "personal";
    case "subject":
    case "note":
      return "academic";
    case "egress-log":
      return null;
  }
}
