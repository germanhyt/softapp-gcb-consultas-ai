import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";

/** Valores guardados en disco (pueden combinarse con variables de entorno). */
export interface SmtpStoredConfig {
  host: string;
  port: number;
  /** true = puerto 465 típico (SSL); false = STARTTLS (p. ej. 587). */
  secure: boolean;
  user: string;
  pass: string;
  /** Dirección "From" opcional; si está vacía se usa user o SMTP_FROM del entorno. */
  from: string;
}

export interface SmtpEffectiveConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  /** true = Nodemailer debe autenticar con user/pass. false = relay por IP (p. ej. smtp-relay.gmail.com). */
  requireAuth: boolean;
  /** Dominio enviado en EHLO/HELO (Google Workspace relay lo exige alineado al dominio). */
  ehloName: string;
}

export interface MaskedSmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  from: string;
  maskedPass: string;
  hasPass: boolean;
  /** "login" = user+pass; "relay" = sin credenciales (IP allowlist). */
  authMode: "login" | "relay" | "incomplete";
  /** true si la config permite intentar envío. */
  ready: boolean;
}

function findProjectRootFromCwd(startDir: string): string {
  let currentDir = startDir;
  while (true) {
    const hasPackageJson = existsSync(join(currentDir, "package.json"));
    const hasSrcDir = existsSync(join(currentDir, "src"));
    if (hasPackageJson && hasSrcDir) return currentDir;
    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) return startDir;
    currentDir = parentDir;
  }
}

const PROJECT_ROOT = findProjectRootFromCwd(process.cwd());
const CONFIG_DIR = join(PROJECT_ROOT, "data");
const CONFIG_PATH = join(CONFIG_DIR, "smtp-config.json");

const DEFAULT_STORED: SmtpStoredConfig = {
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  user: "",
  pass: "",
  from: "",
};

export function maskSmtpPass(pass: string): string {
  if (!pass) return "";
  if (pass.length <= 4) return "••••";
  return "••••••••" + pass.slice(-4);
}

/** Extrae dominio del From/user para EHLO (p. ej. sistemas@gcb.pe → gcb.pe). */
export function resolveSmtpEhloName(fromOrUser: string, fallback = "localhost"): string {
  const fromEnv = (process.env.SMTP_EHLO_NAME ?? "").trim();
  if (fromEnv) return fromEnv;
  const raw = (fromOrUser ?? "").trim();
  const at = raw.lastIndexOf("@");
  if (at >= 0 && at < raw.length - 1) {
    const domain = raw.slice(at + 1).trim().toLowerCase();
    if (domain && !domain.includes(" ")) return domain;
  }
  return fallback;
}

function parseStored(raw: unknown): SmtpStoredConfig {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_STORED };
  const o = raw as Record<string, unknown>;
  const host = typeof o.host === "string" ? o.host.trim() : DEFAULT_STORED.host;
  const portNum = Number(o.port);
  const port = Number.isFinite(portNum) && portNum > 0 ? Math.floor(portNum) : DEFAULT_STORED.port;
  const secure = typeof o.secure === "boolean" ? o.secure : port === 465;
  const user = typeof o.user === "string" ? o.user.trim() : "";
  const pass = typeof o.pass === "string" ? o.pass : "";
  const from = typeof o.from === "string" ? o.from.trim() : "";
  return { host, port, secure, user, pass, from };
}

export function readSmtpStoredConfig(): SmtpStoredConfig {
  try {
    if (existsSync(CONFIG_PATH)) {
      const raw = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
      return parseStored(raw);
    }
  } catch (err) {
    console.error("[SmtpConfig] read error:", err);
  }
  return { ...DEFAULT_STORED };
}

export function writeSmtpStoredConfig(config: SmtpStoredConfig): void {
  try {
    if (!existsSync(CONFIG_DIR)) {
      mkdirSync(CONFIG_DIR, { recursive: true });
    }
    writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
  } catch (err) {
    console.error("[SmtpConfig] write error:", err);
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`No se pudo guardar SMTP (${detail}). Ruta: ${CONFIG_PATH}`);
  }
}

/** Contraseña usable para envío: archivo o .env (el archivo tiene prioridad si no está vacío). */
function effectivePass(stored: SmtpStoredConfig): string {
  const fromFile = (stored.pass ?? "").trim();
  if (fromFile) return fromFile;
  return (process.env.SMTP_PASS ?? "").trim();
}

function effectiveUser(stored: SmtpStoredConfig): string {
  const fromFile = (stored.user ?? "").trim();
  if (fromFile) return fromFile;
  return (process.env.SMTP_USER ?? "").trim();
}

function resolveAuthMode(
  user: string,
  pass: string,
): MaskedSmtpConfig["authMode"] {
  if (user && pass) return "login";
  if (!user && !pass) return "relay";
  return "incomplete";
}

/**
 * Configuración efectiva para Nodemailer (archivo sobrescribe env por campo cuando el valor guardado no está vacío).
 * Soporta:
 * - login: user + pass
 * - relay: sin credenciales (Google Workspace smtp-relay / IP allowlist), requiere From
 */
export function getSmtpEffectiveConfig(): SmtpEffectiveConfig | null {
  const stored = readSmtpStoredConfig();
  const host =
    stored.host.trim() || process.env.SMTP_HOST?.trim() || "smtp.gmail.com";
  const port =
    (stored.port > 0 ? stored.port : undefined) ??
    (Number(process.env.SMTP_PORT) || 587);
  let secure = stored.secure;
  if (!existsSync(CONFIG_PATH) && process.env.SMTP_PORT) {
    const envPort = Number(process.env.SMTP_PORT);
    if (envPort === 465) secure = true;
  }
  if (port === 465) secure = true;

  const user = effectiveUser(stored);
  const pass = effectivePass(stored);
  const fromRaw =
    stored.from.trim() ||
    process.env.SMTP_FROM?.trim() ||
    user ||
    process.env.SMTP_USER ||
    "";

  const mode = resolveAuthMode(user, pass);
  if (mode === "incomplete") return null;
  if (!host.trim()) return null;
  if (!fromRaw.trim()) return null;

  return {
    host,
    port,
    secure,
    user,
    pass,
    from: fromRaw,
    requireAuth: mode === "login",
    ehloName: resolveSmtpEhloName(fromRaw, host),
  };
}

export function isSmtpConfigured(): boolean {
  return getSmtpEffectiveConfig() !== null;
}

export function getMaskedSmtpConfig(): MaskedSmtpConfig {
  const stored = readSmtpStoredConfig();
  const user = effectiveUser(stored);
  const pass = effectivePass(stored);
  const maskedPass = maskSmtpPass(pass);
  const host = stored.host || process.env.SMTP_HOST || DEFAULT_STORED.host;
  const from =
    stored.from ||
    process.env.SMTP_FROM ||
    user ||
    process.env.SMTP_USER ||
    "";
  const authMode = resolveAuthMode(user, pass);
  const ready =
    Boolean(host.trim()) &&
    Boolean(from.trim()) &&
    (authMode === "login" || authMode === "relay");

  return {
    host,
    port:
      stored.port > 0 ? stored.port : Number(process.env.SMTP_PORT) || DEFAULT_STORED.port,
    secure: stored.secure,
    user: stored.user || process.env.SMTP_USER || "",
    from: stored.from || process.env.SMTP_FROM || "",
    maskedPass,
    hasPass: Boolean(pass),
    authMode,
    ready,
  };
}
