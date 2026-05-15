import { NextResponse } from "next/server";
import { getCuadreTarjetasClient } from "@/lib/data/cuadre-tarjetas-client";

export async function GET() {
  try {
    const instances = await getCuadreTarjetasClient().getInstances();
    return NextResponse.json(instances);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
