"use client";
import { useRef, useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { mutateList } from "@/app/lists/actions";
import type { ListState } from "@/lib/lists";

export function useListMutation(setBusy?: (busy: boolean) => void) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<ListState>({});
  const inFlight = useRef(false);
  function run(form: FormData, onSuccess?: () => void) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy?.(true);
    setFeedback({});
    startTransition(async () => {
      try {
        const state = await mutateList({}, form);
        setFeedback(state);
        if (state.success) onSuccess?.();
      } catch (error) {
        unstable_rethrow(error);
        setFeedback({ error: "We couldn’t save that change. Please try again." });
      } finally { inFlight.current = false; setBusy?.(false); }
    });
  }
  return { pending, feedback, run };
}
