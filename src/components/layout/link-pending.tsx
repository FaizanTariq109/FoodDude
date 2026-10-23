"use client";
import { useLinkStatus } from "next/link";
export function LinkPending() {
  const { pending } = useLinkStatus();
  return <><span className="link-pending" data-pending={pending} aria-hidden="true" /><span className="sr-only" role="status">{pending ? "Opening page…" : ""}</span></>;
}
