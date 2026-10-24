import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** Native modal dialogs provide focus containment, background inertness and focus return. */
export function Modal({ children, title, onClose, dismissible = true }: {
  children: ReactNode; title: string; onClose: () => void; dismissible?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog?.showModal();
    return () => { dialog?.close(); previous?.focus(); };
  }, []);
  return createPortal(<dialog ref={ref} aria-label={title} className="app-dialog"
    onKeyDown={event => {
      if(event.key !== 'Tab') return;
      const dialog=ref.current;
      if(!dialog) return;
      const controls=Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]'))
        .filter(element=>element.getClientRects().length>0);
      const first=controls[0],last=controls.at(-1);
      if(!first){event.preventDefault();dialog.focus();return;}
      if(event.shiftKey && document.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus();}
    }}
    onCancel={event => { event.preventDefault(); if (dismissible) closeRef.current(); }}>
    {children}
  </dialog>, document.body);
}
