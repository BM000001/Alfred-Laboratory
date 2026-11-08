import { useState, type ChangeEvent } from 'react';
import { createBackup, inspectBackup, restoreBackup } from './backup/backupService';
import { decryptBackup, encryptBackup, isEncryptedBackup } from './backup/encryptedBackup';

type BackupPreview = ReturnType<typeof inspectBackup>;

const labels: Record<string, string> = {
  tasks: 'Tarefas', projects: 'Projetos', appointments: 'Compromissos',
  disciplines: 'Disciplinas', studyTopics: 'Conteúdos de estudo', focusSessions: 'Sessões Pomodoro', memories: 'Memórias do Alfred', files: 'Arquivos',
};

function downloadJson(content: string, filename: string) {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Do not revoke synchronously: some browsers start the download after click returns.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function BackupSettings() {
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const [exportPassword, setExportPassword] = useState('');
  const [exportPasswordConfirm, setExportPasswordConfirm] = useState('');
  const [encryptedRaw, setEncryptedRaw] = useState<string | null>(null);
  const [encryptedPassword, setEncryptedPassword] = useState('');

  async function exportData() {
    setBusy(true); setError(''); setFeedback('');
    try {
      const json = await createBackup();
      downloadJson(json, `alfred-backup-${new Date().toISOString().slice(0, 10)}.json`);
      setFeedback('Backup gerado. Guarde o arquivo em um local seguro.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível gerar o backup.'); }
    finally { setBusy(false); }
  }

  async function exportEncryptedData() {
    setError(''); setFeedback('');
    if (exportPassword !== exportPasswordConfirm) {
      setError('As senhas não correspondem. Confira os dois campos.');
      return;
    }
    setBusy(true);
    try {
      const json = await createBackup();
      const encrypted = await encryptBackup(json, exportPassword);
      downloadJson(encrypted, `alfred-backup-criptografado-${new Date().toISOString().slice(0, 10)}.json`);
      setExportPassword('');
      setExportPasswordConfirm('');
      setFeedback('Backup criptografado gerado. A senha não pode ser recuperada; guarde-a separadamente do arquivo.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível criptografar o backup.'); }
    finally { setBusy(false); }
  }

  async function selectBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setPreview(null); setEncryptedRaw(null); setEncryptedPassword(''); setError(''); setFeedback('');
    if (!file) return;
    try {
      if (file.size > 100 * 1024 * 1024) throw new Error('O backup excede o limite de 100 MB.');
      const raw = await file.text();
      if (isEncryptedBackup(raw)) {
        setEncryptedRaw(raw);
        setFeedback('Backup criptografado detectado. Informe a senha para descriptografar e conferir o conteúdo antes de restaurar.');
      } else {
        setPreview(inspectBackup(raw));
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível ler o backup.'); }
    event.target.value = '';
  }

  async function decryptSelectedBackup() {
    if (!encryptedRaw || !encryptedPassword || busy) return;
    setBusy(true); setError(''); setFeedback('');
    try {
      const plaintext = await decryptBackup(encryptedRaw, encryptedPassword);
      setPreview(inspectBackup(plaintext));
      setEncryptedRaw(null);
      setEncryptedPassword('');
      setFeedback('Backup descriptografado e validado. Confira os registros antes de restaurar.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível descriptografar o backup.'); }
    finally { setBusy(false); }
  }

  async function confirmRestore() {
    if (!preview || !window.confirm('Atenção: a restauração substituirá todos os dados atuais do Alfred neste dispositivo. Essa ação não pode ser desfeita. Deseja continuar?')) return;
    setBusy(true); setError(''); setFeedback('');
    try {
      await restoreBackup(preview.payload);
      setFeedback('Backup restaurado. Recarregue a página para atualizar todos os módulos.');
      setPreview(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível restaurar o backup.'); }
    finally { setBusy(false); }
  }

  return <section className="backup-settings">
    <article className="entry-panel">
      <span className="card-label">PROTEÇÃO DOS SEUS DADOS</span>
      <h2>Backup local</h2>
      <p>Exporte tarefas, projetos, agenda, estudos, histórico Pomodoro, memórias e arquivos em um único documento. O Alfred não envia esses dados para um servidor. O histórico de mensagens não é incluído no backup e permanece neste dispositivo.</p>
      <button className="primary-action" type="button" disabled={busy} onClick={() => void exportData()}>{busy ? 'Processando...' : 'Exportar backup JSON'}</button>
    </article>
    <article className="entry-panel">
      <span className="card-label">PRIVACIDADE ADICIONAL</span>
      <h2>Backup criptografado</h2>
      <p>Proteja o arquivo com AES-GCM de 256 bits e uma senha derivada por PBKDF2-SHA-256. Use uma senha longa e guarde-a em segurança: sem ela, não será possível restaurar o arquivo.</p>
      <label className="field-label" htmlFor="backup-export-password">Senha (mínimo 12 caracteres)</label>
      <input id="backup-export-password" type="password" autoComplete="new-password" minLength={12} value={exportPassword} onChange={(event) => setExportPassword(event.target.value)} disabled={busy} />
      <label className="field-label" htmlFor="backup-export-password-confirm">Confirme a senha</label>
      <input id="backup-export-password-confirm" type="password" autoComplete="new-password" minLength={12} value={exportPasswordConfirm} onChange={(event) => setExportPasswordConfirm(event.target.value)} disabled={busy} />
      <button className="primary-action" type="button" disabled={busy || exportPassword.length < 12 || !exportPasswordConfirm} onClick={() => void exportEncryptedData()}>{busy ? 'Processando...' : 'Exportar backup criptografado'}</button>
    </article>
    <article className="entry-panel">
      <span className="card-label">RECUPERAÇÃO</span>
      <h2>Restaurar backup</h2>
      <p>Selecione um backup JSON criado pelo Alfred. Backups criptografados pedem senha antes de mostrar a prévia. A restauração substitui os dados atuais deste dispositivo.</p>
      <label className="file-upload-button">Selecionar backup<input type="file" accept="application/json,.json" aria-label="Selecionar arquivo de backup" onChange={selectBackup} disabled={busy} /></label>
      {encryptedRaw && <div className="backup-preview" aria-live="polite">
        <strong>Backup criptografado detectado</strong>
        <label className="field-label" htmlFor="backup-import-password">Senha do backup</label>
        <input id="backup-import-password" type="password" autoComplete="current-password" value={encryptedPassword} onChange={(event) => setEncryptedPassword(event.target.value)} disabled={busy} />
        <button className="primary-action" type="button" disabled={busy || !encryptedPassword} onClick={() => void decryptSelectedBackup()}>{busy ? 'Descriptografando...' : 'Descriptografar e conferir'}</button>
      </div>}
      {preview && <div className="backup-preview" aria-live="polite">
        <strong>Backup de {new Date(preview.createdAt).toLocaleString('pt-BR')}</strong>
        <ul>{Object.entries(preview.counts).map(([key, count]) => <li key={key}>{labels[key]}: {count}</li>)}</ul>
        <button className="primary-action danger-action" type="button" disabled={busy} onClick={() => void confirmRestore()}>Substituir dados e restaurar</button>
      </div>}
    </article>
    {error && <p className="module-error" role="alert">{error}</p>}
    {feedback && <p className="module-feedback" role="status">{feedback}</p>}
  </section>;
}
