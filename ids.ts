/**
 * Gera identificadores universais (UUID v4) no próprio aparelho.
 * Requer contexto seguro (HTTPS ou localhost) no navegador.
 * Identificadores gerados localmente não colidem entre dispositivos,
 * o que prepara o modelo para sincronização futura.
 */
export function newId(): string {
  return crypto.randomUUID();
}
