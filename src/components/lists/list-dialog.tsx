"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";

export function ListDialog({ title, trigger, triggerClassName = "button button-outline", triggerLabel, children, disabled = false }: {
  title: string; trigger: ReactNode; triggerClassName?: string; triggerLabel?: string; disabled?: boolean;
  children: (close: () => void, setBusy: (busy: boolean) => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const headingId = useId();
  useEffect(() => {
    if (open && !dialog.current?.open) {
      dialog.current?.showModal();
      dialog.current?.querySelector<HTMLElement>("[data-dialog-autofocus]")?.focus();
    }
    else if (!open && dialog.current?.open) dialog.current.close();
  }, [open]);
  const close = () => setOpen(false);
  return <>
    <button ref={triggerRef} type="button" className={triggerClassName} aria-label={triggerLabel} title={triggerLabel} aria-haspopup="dialog" disabled={disabled} onClick={() => setOpen(true)}>{trigger}</button>
    <dialog ref={dialog} className="list-dialog" aria-labelledby={headingId}
      onCancel={event => { if (busy) event.preventDefault(); }}
      onClose={() => { setOpen(false); setBusy(false); triggerRef.current?.focus(); }}
      onClick={event => { if (!busy && event.target === event.currentTarget) close(); }}>
      {open && <div className="list-dialog-content"><div className="list-dialog-heading"><h2 id={headingId}>{title}</h2><button type="button" className="icon-button" aria-label="Close dialog" disabled={busy} onClick={close}><X size={19} /></button></div>{children(close, setBusy)}</div>}
    </dialog>
  </>;
}
