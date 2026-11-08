// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { decryptBackup, encryptBackup, isEncryptedBackup } from './encryptedBackup';

describe('encryptedBackup', () => {
  it('criptografa com AES-GCM e recupera o JSON original com a senha correta', async () => {
    const plaintext = JSON.stringify({ format: 'alfred-local-backup', data: { tasks: [{ title: 'Privado' }] } });
    const encrypted = await encryptBackup(plaintext, 'uma-senha-longa-123');
    expect(isEncryptedBackup(encrypted)).toBe(true);
    expect(encrypted).not.toContain('Privado');
    expect(await decryptBackup(encrypted, 'uma-senha-longa-123')).toBe(plaintext);
  });

  it('rejeita senhas curtas ao criptografar', async () => {
    await expect(encryptBackup('conteúdo', 'curta')).rejects.toThrow('pelo menos 12 caracteres');
  });

  it('retorna erro genérico para senha incorreta', async () => {
    const encrypted = await encryptBackup('conteúdo privado', 'senha-correta-123');
    await expect(decryptBackup(encrypted, 'senha-incorreta-123')).rejects.toThrow('Senha incorreta ou backup criptografado danificado');
  });

  it('rejeita envelopes incompatíveis ou malformados', async () => {
    await expect(decryptBackup('{"format":"outro"}', 'senha-correta-123')).rejects.toThrow('não compatível');
    expect(isEncryptedBackup('{')).toBe(false);
  });
});
