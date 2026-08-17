import type { Metadata, Viewport } from "next";
import { COMPANY_NAME, PRODUCT_NAME } from "@/lib/config/brand";
import Image from "next/image";
import { Hanken_Grotesk } from "next/font/google";
import "./globals.css";
import { ChatShell } from "@/components/assistant/chat-shell";
import { MainNav } from "@/components/layout/main-nav";

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
  title: `${PRODUCT_NAME} · Asistente Inteligente`,
  description: `Asistente inteligente para ${COMPANY_NAME} - Conciliación, Ventas, Estacionamiento y Flujo de Personas.`,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={hanken.variable}>
      <body className="min-h-screen antialiased">
        <ChatShell>
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
                    alt={COMPANY_NAME}
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
                    {PRODUCT_NAME}
                  </h1>
                  <p
                    className="text-[10px] sm:text-[11px] leading-tight font-medium"
                    style={{ color: "var(--foreground-muted)" }}
                  >
                    {COMPANY_NAME}
                  </p>
                </div>
              </div>

              <MainNav />
            </div>
          </header>

          {/* ── Main content ───────────────────────────────────────────────── */}
          <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
            {children}
          </main>

        </ChatShell>
      </body>
    </html>
  );
}
