export interface EgressAuditEntry {
  readonly id: string;
  readonly copiedAt: string;
  readonly classes: readonly ('public' | 'personal' | 'academic')[];
  readonly itemCount: number;
  readonly characterCount: number;
  readonly action: 'copied_to_clipboard' | 'sent_to_ai';
}

export interface EgressSettings {
  readonly id: 'global';
  readonly enabled: boolean;
}

export const DEFAULT_EGRESS_SETTINGS: EgressSettings = {
  id: 'global',
  enabled: true,
};

/** Registro de auditoria deliberadamente limitado a metadados, sem conteúdo ou títulos. */
export function createEgressAuditEntry(input: {
  classes: readonly ('public' | 'personal' | 'academic')[];
  itemCount: number;
  characterCount: number;
  action?: 'copied_to_clipboard' | 'sent_to_ai';
  copiedAt?: string;
  id?: string;
}): EgressAuditEntry {
  if (!Number.isInteger(input.itemCount) || input.itemCount < 1) {
    throw new Error('A auditoria exige ao menos um item.');
  }
  if (!Number.isInteger(input.characterCount) || input.characterCount < 0) {
    throw new Error('A quantidade de caracteres é inválida.');
  }
  return {
    id: input.id ?? `egress-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    copiedAt: input.copiedAt ?? new Date().toISOString(),
    classes: [...new Set(input.classes)],
    itemCount: input.itemCount,
    characterCount: input.characterCount,
    action: input.action ?? 'copied_to_clipboard',
  };
}
