import type { AnyEntity, EntityKind } from "../domain/entities.js";

/**
 * Contrato de armazenamento. Implementações: MemoryStore (testes) e IdbStore (navegador).
 * Os registros devolvidos sempre incluem exclusões lógicas; use listActive para ver apenas os ativos.
 */
export interface EntityStore {
  put(entity: AnyEntity): Promise<void>;
  get(id: string): Promise<AnyEntity | undefined>;
  all(): Promise<AnyEntity[]>;
}

export class MemoryStore implements EntityStore {
  private readonly items = new Map<string, AnyEntity>();

  async put(entity: AnyEntity): Promise<void> {
    this.items.set(entity.id, entity);
  }

  async get(id: string): Promise<AnyEntity | undefined> {
    return this.items.get(id);
  }

  async all(): Promise<AnyEntity[]> {
    return [...this.items.values()];
  }
}

/** Registros ativos (não excluídos) de um tipo, ordenados pela data de criação. */
export async function listActive<K extends EntityKind>(
  store: EntityStore,
  kind: K,
): Promise<Extract<AnyEntity, { kind: K }>[]> {
  const all = await store.all();
  return all
    .filter((e): e is Extract<AnyEntity, { kind: K }> => e.kind === kind && e.deletedAt === null)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
