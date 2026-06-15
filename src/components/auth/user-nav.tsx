"use client";

import { useEffect, useState } from "react";
import { LogOut, User } from "lucide-react";
import { ROLE_LABELS, type UserRole } from "@/lib/auth/types";

interface MeResponse {
  enabled: boolean;
  user?: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
  };
}

export function UserNav() {
  const [me, setMe] = useState<MeResponse | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setMe(data))
      .catch(() => setMe(null));
  }, []);

  if (!me?.enabled || !me?.user) return null;

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  return (
    <div className="flex items-center gap-2 ml-1 sm:ml-2 pl-2 sm:pl-3 border-l border-border">
      <div className="hidden sm:flex flex-col items-end leading-tight max-w-[120px]">
        <span className="text-[11px] font-semibold truncate w-full text-right">{me.user.name}</span>
        <span className="text-[10px] text-muted-foreground">{ROLE_LABELS[me.user.role]}</span>
      </div>
      <button
        type="button"
        onClick={logout}
        title="Cerrar sesión"
        className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        <LogOut className="h-4 w-4" />
      </button>
      <span className="sm:hidden inline-flex h-8 w-8 items-center justify-center rounded-lg bg-muted/60">
        <User className="h-4 w-4 text-muted-foreground" />
      </span>
    </div>
  );
}
