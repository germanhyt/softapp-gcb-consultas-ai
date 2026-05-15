import type { Metadata, Viewport } from "next";
import Image from "next/image";
import { Hanken_Grotesk } from "next/font/google";
import "./globals.css";
import { ChatProvider } from "@/contexts/chat-context";
import { FloatingChat } from "@/components/assistant/floating-chat";

const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-hanken",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: "Consultas Refugio · Asistente Inteligente",
  description: "Asistente inteligente para El Refugio - Conciliación, Ventas, Estacionamiento y Flujo de Personas.",
};

const NAV_LINKS = [
  { href: "/",             label: "Dashboard"     },
  { href: "/instancias",   label: "Instancias"    },
  { href: "/auditoria",    label: "Auditoría"     },
  { href: "/proyecciones", label: "Proyecciones", hideMobile: true },
  { href: "/reporteria",   label: "Reportería"    },
  { href: "/reports",      label: "Reportes Auto", hideMobile: true },
  { href: "/settings",     label: "Config"        },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={hanken.variable}>
      <body className="min-h-screen antialiased">
        <ChatProvider>
          {/* ── Header ─────────────────────────────────────────────────────── */}
          <header
            className="sticky top-0 z-30"
            style={{
              background: "var(--surface)",
              borderBottom: "1px solid var(--border)",
              boxShadow: "0 1px 0 rgba(56,209,73,0.06)",
            }}
          >
            <div className="w-full max-w-7xl mx-auto flex h-14 sm:h-16 items-center justify-between px-4 sm:px-6">
              {/* Logo + Brand */}
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div
                  className="relative flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full overflow-hidden"
                  style={{
                    boxShadow: "0 0 0 2px rgba(56,209,73,0.30), 0 0 16px rgba(56,209,73,0.20)",
                  }}
                >
                  <Image
                    src="/logo-refugio.png"
                    alt="El Refugio"
                    fill
                    sizes="40px"
                    className="object-cover"
                    priority
                  />
                </div>
                <div>
                  <h1
                    className="text-sm sm:text-[15px] font-bold leading-tight"
                    style={{ color: "var(--foreground)" }}
                  >
                    Consultas Refugio
                  </h1>
                  <p
                    className="text-[10px] sm:text-[11px] leading-tight font-medium"
                    style={{ color: "var(--foreground-muted)" }}
                  >
                    Asistente Inteligente
                  </p>
                </div>
              </div>

              {/* Nav */}
              <nav className="flex items-center gap-1 sm:gap-1.5">
                {NAV_LINKS.map(({ href, label, hideMobile }) => (
                  <a
                    key={href}
                    href={href}
                    className={`nav-link text-[11px] sm:text-xs font-semibold px-2.5 py-1.5 rounded-lg ${
                      hideMobile ? "hidden sm:inline-flex" : "inline-flex"
                    }`}
                  >
                    {label}
                  </a>
                ))}
              </nav>
            </div>
          </header>

          {/* ── Main content ───────────────────────────────────────────────── */}
          <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
            {children}
          </main>

          {/* ── Floating chat ──────────────────────────────────────────────── */}
          <FloatingChat />
        </ChatProvider>
      </body>
    </html>
  );
}
