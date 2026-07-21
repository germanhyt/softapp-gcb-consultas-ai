import { NextResponse } from "next/server";
import { getToteatApiMappingsPublic, getToteatRestaurantsPublic } from "@/lib/toteat/restaurants-config";

export async function GET() {
  try {
    const restaurants = getToteatRestaurantsPublic();
    const mappings = getToteatApiMappingsPublic();
    return NextResponse.json({ restaurants, mappings });
  } catch (error) {
    console.error("[toteat/restaurants] Error:", error);
    return NextResponse.json({
      restaurants: [],
      mappings: { barApiId: "", limanesasApiId: "" },
    });
  }
}
