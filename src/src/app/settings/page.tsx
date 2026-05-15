"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useGlobalChat } from "@/contexts/chat-context";
import { AI_PROVIDERS } from "@/lib/ai/providers";
import { Settings, Bot, Mail, Database, Key } from "lucide-react";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const { selectedModel, setSelectedModel } = useGlobalChat();
  const providers = Object.values(AI_PROVIDERS);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
          <Settings className="h-5 w-5 sm:h-6 sm:w-6" />
          Configuración
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configura el modelo de IA, conexiones y tareas programadas.
        </p>
      </div>

      {/* Model Selection */}
      <section className="border rounded-xl p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold flex items-center gap-2 mb-4">
          <Bot className="h-5 w-5 text-emerald-600" />
          Modelo de IA
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {providers.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedModel(p.id)}
              className={cn(
                "p-3 sm:p-4 rounded-lg border-2 text-left transition-all",
                selectedModel === p.id
                  ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                  : "border-border hover:border-muted-foreground/30"
              )}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{p.icon}</span>
                <div>
                  <p className="font-semibold text-sm">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.provider}</p>
                </div>
              </div>
              {selectedModel === p.id && (
                <span className="text-xs text-emerald-600 font-medium mt-1 block">
                  Activo
                </span>
              )}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Las API keys se configuran en el archivo .env.local del servidor.
        </p>
      </section>

      {/* CuadreTarjetas Connection */}
      <section className="border rounded-xl p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold flex items-center gap-2 mb-4">
          <Database className="h-5 w-5 text-blue-600" />
          CuadreTarjetas API
        </h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              URL del API
            </label>
            <input
              type="text"
              readOnly
              value={process.env.NEXT_PUBLIC_CT_API_URL || "http://62.169.23.24:8082/api"}
              className="w-full mt-1 px-3 py-2 text-sm border rounded-lg bg-muted/50"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Las credenciales se configuran en .env.local (CT_USERNAME, CT_PASSWORD).
          </p>
        </div>
      </section>

      {/* Email Configuration */}
      <section className="border rounded-xl p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold flex items-center gap-2 mb-4">
          <Mail className="h-5 w-5 text-amber-600" />
          Reportes por Email
        </h3>
        <p className="text-sm text-muted-foreground">
          Configura el servidor SMTP en .env.local para habilitar el envío
          automático de reportes programados.
        </p>
        <div className="mt-3 p-3 bg-muted/50 rounded-lg">
          <p className="text-xs font-mono text-muted-foreground">
            SMTP_HOST=smtp.gmail.com
            <br />
            SMTP_PORT=587
            <br />
            SMTP_USER=tu@email.com
            <br />
            SMTP_PASS=app_password
          </p>
        </div>
      </section>

      {/* API Keys */}
      <section className="border rounded-xl p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold flex items-center gap-2 mb-4">
          <Key className="h-5 w-5 text-purple-600" />
          API Keys
        </h3>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>
            <strong>Google (Gemini):</strong>{" "}
            <code className="text-xs bg-muted px-1 rounded">
              GOOGLE_GENERATIVE_AI_API_KEY
            </code>
          </p>
          <p>
            <strong>Anthropic (Claude):</strong>{" "}
            <code className="text-xs bg-muted px-1 rounded">
              ANTHROPIC_API_KEY
            </code>
          </p>
          <p>
            <strong>OpenAI (GPT):</strong>{" "}
            <code className="text-xs bg-muted px-1 rounded">
              OPENAI_API_KEY
            </code>
          </p>
        </div>
      </section>
    </div>
  );
}
