import { describe, expect, it } from 'vitest';
import { createEgressAuditEntry, DEFAULT_EGRESS_SETTINGS } from './egressAudit';

describe('auditoria de exportação', () => {
  it('registra somente metadados de uma cópia concluída', () => {
    const entry = createEgressAuditEntry({
      id: 'audit-1',
      copiedAt: '2026-11-03T10:00:00.000Z',
      classes: ['academic', 'academic', 'personal'],
      itemCount: 2,
      characterCount: 120,
    });
    expect(entry).toEqual({
      id: 'audit-1',
      copiedAt: '2026-11-03T10:00:00.000Z',
      classes: ['academic', 'personal'],
      itemCount: 2,
      characterCount: 120,
      action: 'copied_to_clipboard',
    });
    expect(JSON.stringify(entry)).not.toMatch(/conteúdo|senha|título|texto enviado/i);
  });

  it('distingue o envio a uma IA externa da cópia manual', () => {
    const entry = createEgressAuditEntry({ classes: ['personal'], itemCount: 1, characterCount: 35, action: 'sent_to_ai' });
    expect(entry.action).toBe('sent_to_ai');
    expect(JSON.stringify(entry)).not.toMatch(/mensagem|conteúdo|senha/i);
  });

  it('mantém a exportação habilitada por padrão, mas sem consentimento prévio', () => {
    expect(DEFAULT_EGRESS_SETTINGS).toEqual({ id: 'global', enabled: true });
  });

  it('rejeita registros inválidos', () => {
    expect(() => createEgressAuditEntry({ classes: [], itemCount: 0, characterCount: 0 })).toThrow();
    expect(() => createEgressAuditEntry({ classes: [], itemCount: 1, characterCount: -1 })).toThrow();
  });
});
