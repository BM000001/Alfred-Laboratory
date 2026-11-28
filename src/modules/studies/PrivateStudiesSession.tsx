import { useEffect, useState } from 'react';
import { isSameOriginAIAvailable } from './studyRemoteQuestions';

export function PrivateStudiesSession({ build }: { build?: string }) {
  const enabled = isSameOriginAIAvailable(import.meta.env.VITE_STUDIES_AI_ORIGIN, location.origin);
  const [status, setStatus] = useState('Verificando a disponibilidade da IA…');
  useEffect(() => {
    if (!enabled) return;
    let active: AbortController | undefined;
    async function check() {
      active?.abort();
      const controller = new AbortController();
      active = controller;
      try {
        const response = await fetch('/api/studies/status', { method: 'POST', credentials: 'same-origin',
          cache: 'no-store', redirect: 'manual', signal: controller.signal });
        const message = response.ok && (await response.json()).available === true ? 'IA disponível'
          : response.type === 'opaqueredirect' || response.status === 401 ? 'Sessão expirada ou inválida'
          : response.status === 403 ? 'Acesso à IA recusado' : 'IA temporariamente indisponível';
        if (!controller.signal.aborted) setStatus(message);
      } catch {
        if (!controller.signal.aborted) setStatus('Não foi possível verificar a IA. Os materiais estão disponíveis localmente.');
      }
    }
    void check();
    window.addEventListener('focus', check);
    window.addEventListener('alfred-studies-session', check);
    return () => { active?.abort(); window.removeEventListener('focus', check); window.removeEventListener('alfred-studies-session', check); };
  }, [enabled]);
  if (!enabled) return null;
  return <aside aria-label="Estado da prévia" style={{display:'flex', flexWrap:'wrap', alignItems:'center', gap:'.75rem'}}>
    <small>Versão {build?.split(' · ')[0] ?? 'local'}</small>
    <small role="status">{status}</small>
    <a href="/cdn-cgi/access/logout" target="_blank" rel="noopener noreferrer">Renovar sessão</a>
    <small>Após sair, <a href="/" target="_blank" rel="noopener noreferrer">entre novamente na prévia</a> e retorne a esta aba.</small>
  </aside>;
}
