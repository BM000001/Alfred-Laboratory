import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

export function EditDialog({ title, children, onClose, protect = true }: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  protect?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useId();
  const dirty = useRef(false);
  const keepEditing = useRef<HTMLButtonElement>(null);
  const fieldFocus = useRef<HTMLElement | null>(null);
  const [discard, setDiscard] = useState(false);

  useEffect(() => {
    const element = dialog.current!;
    const previousFocus = document.activeElement;
    if (typeof element.showModal === 'function') element.showModal();
    else element.setAttribute('open', '');
    const first = element.querySelector<HTMLElement>('input:not([type=hidden]), textarea, button');
    first?.focus();
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (protect && dirty.current) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      if (typeof element.close === 'function' && element.open) element.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [protect]);

  useEffect(() => {
    if (discard) keepEditing.current?.focus();
  }, [discard]);

  function requestClose() {
    if (dialog.current?.querySelector('[data-saving]')) return;
    if (protect && dirty.current) {
      fieldFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setDiscard(true);
    }
    else onClose();
  }

  return <dialog ref={dialog} className="quick-dialog edit-dialog" aria-labelledby={heading}
    onCancel={(event) => { event.preventDefault(); requestClose(); }} onChangeCapture={() => { dirty.current = true; }}>
    <h2 id={heading}>{title}</h2>
    <div hidden={discard}>{children}</div>
    {discard ? <div className="dialog-actions">
      <p role="alert">Descartar as alterações não salvas?</p>
      <button ref={keepEditing} type="button" onClick={() => {
        setDiscard(false);
        requestAnimationFrame(() => fieldFocus.current?.focus({ preventScroll: true }));
      }}>Continuar editando</button>
      <button className="danger-action" type="button" onClick={onClose}>Descartar alterações</button>
    </div> : <button className="text-action" type="button" onClick={requestClose}>{protect ? 'Cancelar' : 'Fechar'}</button>}
  </dialog>;
}
