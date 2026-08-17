"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { UserNav } from "@/components/auth/user-nav";
import { cn } from "@/lib/utils";

const PRIMARY_LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/toteat", label: "Toteat" },
] as const;

const MORE_GROUPS = [
  {
    title: "Conciliación",
    items: [
      { href: "/instancias", label: "Instancias" },
      { href: "/auditoria", label: "Auditoría" },
    ],
  },
  {
    title: "Ventas",
    items: [
      { href: "/proyecciones", label: "Proyecciones" },
      { href: "/reporteria", label: "Reportería" },
    ],
  },
  {
    title: "Automatización",
    items: [{ href: "/reports", label: "Reportes Auto" }],
  },
] as const;

const MORE_HREFS = MORE_GROUPS.flatMap((g) => g.items.map((i) => i.href));

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MainNav() {
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const moreActive = MORE_HREFS.some((href) => isActive(pathname, href));

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent | TouchEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <nav className="flex items-center gap-1 sm:gap-1.5">
      {PRIMARY_LINKS.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "nav-link text-[11px] sm:text-xs font-semibold px-2.5 py-1.5 rounded-lg inline-flex",
            isActive(pathname, href) && "text-[var(--primary)] bg-[rgba(56,209,73,0.10)]",
          )}
        >
          {label}
        </Link>
      ))}

      <div ref={wrapRef} className="relative">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "nav-link text-[11px] sm:text-xs font-semibold px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1",
            (open || moreActive) && "text-[var(--primary)] bg-[rgba(56,209,73,0.10)]",
          )}
        >
          Más
          <ChevronDown
            className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")}
          />
        </button>

        {open && (
          <div
            role="menu"
            className="absolute right-0 top-full mt-1.5 min-w-[200px] rounded-xl border py-1.5 z-50"
            style={{
              background: "var(--surface)",
              borderColor: "var(--border)",
              boxShadow: "0 10px 28px rgba(0,0,0,0.12)",
            }}
          >
            {MORE_GROUPS.map((group, gi) => (
              <div key={group.title}>
                {gi > 0 && (
                  <div
                    className="my-1.5 mx-2 h-px"
                    style={{ background: "var(--border)" }}
                  />
                )}
                <p
                  className="px-3 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wide"
                  style={{ color: "var(--foreground-muted)" }}
                >
                  {group.title}
                </p>
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    role="menuitem"
                    className={cn(
                      "block px-3 py-2 text-xs font-semibold transition-colors",
                      isActive(pathname, item.href)
                        ? "text-[var(--primary)] bg-[rgba(56,209,73,0.10)]"
                        : "text-[var(--foreground)] hover:bg-[rgba(56,209,73,0.08)] hover:text-[var(--primary)]",
                    )}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      <Link
        href="/settings"
        className={cn(
          "nav-link text-[11px] sm:text-xs font-semibold px-2.5 py-1.5 rounded-lg inline-flex",
          isActive(pathname, "/settings") &&
            "text-[var(--primary)] bg-[rgba(56,209,73,0.10)]",
        )}
      >
        Config
      </Link>
      <UserNav />
    </nav>
  );
}
