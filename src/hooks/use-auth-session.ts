"use client";

import { useEffect, useState } from "react";

interface AuthSessionState {
  loading: boolean;
  /** true cuando auth está deshabilitado (dev) o hay sesión válida */
  canUseChat: boolean;
}

export function useAuthSession(): AuthSessionState {
  const [state, setState] = useState<AuthSessionState>({
    loading: true,
    canUseChat: false,
  });

  useEffect(() => {
    let cancelled = false;

    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (!data) {
          setState({ loading: false, canUseChat: false });
          return;
        }
        const canUseChat = data.enabled === false || Boolean(data.user);
        setState({ loading: false, canUseChat });
      })
      .catch(() => {
        if (!cancelled) setState({ loading: false, canUseChat: false });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
