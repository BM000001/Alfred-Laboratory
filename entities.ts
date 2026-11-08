/** Versão atual do esquema de dados gravado pelo Alfred. */
export const SCHEMA_VERSION = 1;

export type EntityKind = "task" | "subject" | "note" | "egress-log";

/**
 * Classes de dado usadas pela política de privacidade.
 * - public: informação geral, sem relação com o usuário.
 * - personal: tarefas, hábitos e texto livre do usuário.
 * - academic: disciplinas, notas e materiais de estudo.
 */
export type DataClass = "public" | "personal" | "academic";

export interface BaseEntity {
  readonly id: string;
  readonly kind: EntityKind;
  /** ISO 8601, em UTC. */
  readonly createdAt: string;
  /** ISO 8601, em UTC. Usado para resolver conflitos (último a gravar vence). */
  readonly updatedAt: string;
  /** Exclusão lógica: registro permanece para propagar a remoção. */
  readonly deletedAt: string | null;
  /** Aparelho que criou ou alterou o registro por último. */
  readonly deviceId: string;
  readonly schemaVersion: number;
}

export interface Task extends BaseEntity {
  readonly kind: "task";
  readonly title: string;
  readonly notes: string;
  readonly done: boolean;
  /** Data no formato AAAA-MM-DD, ou null. */
  readonly dueDate: string | null;
  readonly subjectId: string | null;
}

export interface Subject extends BaseEntity {
  readonly kind: "subject";
  readonly name: string;
}

export type NoteOrigin = "manual" | "ai-manual-paste";

export interface Note extends BaseEntity {
  readonly kind: "note";
  readonly title: string;
  readonly body: string;
  readonly origin: NoteOrigin;
  readonly subjectId: string | null;
}

/** Registro de envio para fora do aparelho. Nunca contém o conteúdo enviado. */
export interface EgressLog extends BaseEntity {
  readonly kind: "egress-log";
  readonly providerId: string;
  readonly classes: readonly DataClass[];
  readonly decision: "allowed" | "blocked";
  readonly itemCount: number;
  readonly characterCount: number;
}

export type AnyEntity = Task | Subject | Note | EgressLog;

export const ENTITY_KINDS: readonly EntityKind[] = ["task", "subject", "note", "egress-log"];
export const DATA_CLASSES: readonly DataClass[] = ["public", "personal", "academic"];
