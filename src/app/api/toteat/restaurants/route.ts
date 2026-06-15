import { NextResponse } from "next/server";
import { getToteatRestaurantsPublic } from "@/lib/toteat/restaurants-config";

export async function GET() {
  try {
    const restaurants = getToteatRestaurantsPublic();
    return NextResponse.json({ restaurants });
  } catch (error) {
    console.error("[toteat/restaurants] Error:", error);
    return NextResponse.json({ restaurants: [] });
  }
}
