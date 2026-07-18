import { NextResponse } from "next/server";
import { fetchPokemonGroups, parseCardLanguage } from "@/lib/tcgcsv";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const language = parseCardLanguage(searchParams.get("lang"));

  try {
    const sets = await fetchPokemonGroups(language);
    return NextResponse.json({ sets, language });
  } catch {
    return NextResponse.json(
      { error: "Could not load the set list. Try again." },
      { status: 502 }
    );
  }
}
