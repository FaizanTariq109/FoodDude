"use client";
import { useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export function Modal({ title, trigger, children, sheet = false, className = "" }: { title: string; trigger: ReactNode; children: ReactNode; sheet?: boolean; className?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return <>
    <button type="button" className={className} onClick={() => dialog.current?.showModal()}>{trigger}</button>
    <dialog ref={dialog} className={sheet ? "modal filter-sheet" : "modal"} aria-label={title} onClick={e => { if (e.target === e.currentTarget) dialog.current?.close(); }}>
      <div className="modal-content"><div className="modal-heading"><h2>{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={() => dialog.current?.close()}><X size={22} /></button></div>
        {children}
        {sheet && <button className="button button-dark sheet-apply" onClick={() => dialog.current?.close()}>Show results</button>}
      </div>
    </dialog>
  </>;
}
