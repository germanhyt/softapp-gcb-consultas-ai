import { NextResponse } from "next/server";
import {
  readSmtpStoredConfig,
  writeSmtpStoredConfig,
  getMaskedSmtpConfig,
  type SmtpStoredConfig,
} from "@/lib/config/smtp-config";

export async function GET() {
  try {
    return NextResponse.json(getMaskedSmtpConfig());
  } catch (error) {
    console.error("[Settings SMTP] GET error:", error);
    return NextResponse.json({ error: "Error al leer SMTP" }, { status: 500 });
  }
}

/**
 * POST body: { host?, port?, secure?, user?, pass?, from? }
 * Si pass está vacío, es solo puntos, o coincide con la máscara mostrada, se conserva la contraseña guardada.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const current = readSmtpStoredConfig();
    const maskedEffective = getMaskedSmtpConfig().maskedPass;

    const incomingPass = String(body.pass ?? "").trim();
    const passUnchanged =
      incomingPass === "" ||
      /^[\u2022*]+$/u.test(incomingPass) ||
      (maskedEffective !== "" && incomingPass === maskedEffective);

    const host =
      typeof body.host === "string" && body.host.trim()
        ? body.host.trim()
        : current.host || "smtp.gmail.com";
    const portRaw = Number(body.port);
    const port =
      Number.isFinite(portRaw) && portRaw > 0 ? Math.floor(portRaw) : current.port || 587;
    const secure =
      typeof body.secure === "boolean" ? body.secure : port === 465 ? true : current.secure;
    const user = typeof body.user === "string" ? body.user.trim() : current.user;
    const from = typeof body.from === "string" ? body.from.trim() : current.from;

    const next: SmtpStoredConfig = {
      host,
      port,
      secure,
      user,
      pass: passUnchanged ? current.pass : incomingPass,
      from,
    };

    writeSmtpStoredConfig(next);
    return NextResponse.json(getMaskedSmtpConfig());
  } catch (error) {
    console.error("[Settings SMTP] POST error:", error);
    const message = error instanceof Error ? error.message : "Error al guardar";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
