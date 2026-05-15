import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ChatProvider } from "@/contexts/chat-context";
import { FloatingChat } from "@/components/assistant/floating-chat";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: "Consultas Refugio v2",
  description: "Asistente inteligente para El Refugio - Conciliación, Ventas, Estacionamiento y Flujo",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-white dark:bg-zinc-950 text-slate-900 dark:text-slate-100 antialiased">
        <ChatProvider>
          {/* Header */}
          <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm">
            <div className="w-full max-w-7xl mx-auto flex h-14 sm:h-16 items-center justify-between px-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 text-white font-bold text-sm sm:text-base">
                  R
                </div>
                <div>
                  <h1 className="text-sm sm:text-base font-bold leading-tight text-slate-800 dark:text-slate-100">
                    Consultas Refugio
                  </h1>
                  <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 leading-tight">
                    Asistente Inteligente
                  </p>
                </div>
              </div>

              <nav className="flex items-center gap-2 sm:gap-4">
                <a
                  href="/"
                  className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors font-medium"
                >
                  Dashboard
                </a>
                <a
                  href="/instancias"
                  className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors font-medium"
                >
                  Instancias
                </a>
                <a
                  href="/auditoria"
                  className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors font-medium"
                >
                  Auditoría
                </a>
                <a
                  href="/proyecciones"
                  className="hidden sm:inline text-xs sm:text-sm text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors font-medium"
                >
                  Proyecciones
                </a>
                <a
                  href="/reporteria"
                  className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors font-medium"
                >
                  Reportería
                </a>
                <a
                  href="/reports"
                  className="hidden sm:inline text-xs sm:text-sm text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors font-medium"
                >
                  Reportes Auto
                </a>
                <a
                  href="/settings"
                  className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors font-medium"
                >
                  Config
                </a>
              </nav>
            </div>
          </header>

          {/* Main content */}
          <main className="w-full max-w-7xl mx-auto px-4 py-4 sm:py-6">{children}</main>

          {/* Floating chat - always present */}
          <FloatingChat />
        </ChatProvider>
      </body>
    </html>
  );
}
