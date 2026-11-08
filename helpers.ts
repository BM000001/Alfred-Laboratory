import type { Context } from "../src/domain/factories.js";

/** Contexto determinístico para testes: relógio que avança 1 segundo por chamada. */
export function makeContext(deviceId = "device-test"): Context {
  let tick = 0;
  let counter = 0;
  return {
    now: () => {
      tick += 1;
      const seconds = String(tick).padStart(2, "0");
      return `2026-03-01T10:00:${seconds}.000Z`;
    },
    deviceId,
    newId: () => {
      counter += 1;
      return `id-${String(counter).padStart(4, "0")}`;
    },
  };
}
