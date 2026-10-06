import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Optimistic local value over a remote one, saved on a debounce.
 *
 * While you're editing, the draft wins, so a Realtime echo of an older save
 * can't yank a slider back mid-drag. Once the latest edit has been saved
 * (`save` should resolve only after the remote copy is fresh), the hook falls
 * back to the remote value. Pending edits are flushed on unmount.
 */
export function useSyncedDraft<T>(remote: T, save: (value: T) => Promise<unknown>, delay = 400) {
  const [draft, setDraft] = useState<{ value: T } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pending = useRef<{ value: T } | null>(null);
  const saveRef = useRef(save);
  saveRef.current = save;

  const flush = useCallback(async () => {
    const sent = pending.current;
    if (!sent) return;
    pending.current = null;
    try {
      await saveRef.current(sent.value);
    } finally {
      // Only hand control back if nothing newer was typed while saving.
      setDraft((current) => (current === sent ? null : current));
    }
  }, []);

  const set = useCallback(
    (value: T) => {
      const entry = { value };
      pending.current = entry;
      setDraft(entry);
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, delay);
    },
    [delay, flush],
  );

  useEffect(
    () => () => {
      clearTimeout(timer.current);
      void flush();
    },
    [flush],
  );

  return [draft ? draft.value : remote, set] as const;
}
