import { NextResponse } from "next/server";

import { getPartyCode } from "@/lib/game";
import { getPartyStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ code: string }> },
) {
  try {
    const { code: rawCode } = await context.params;
    const code = getPartyCode(rawCode);
    const store = getPartyStore();
    const party = store.get(code);

    if (!party) {
      return NextResponse.json(
        { error: "Partija sa tim kodom ne postoji." },
        { status: 404 },
      );
    }

    return NextResponse.json({ party });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Greška." },
      { status: 400 },
    );
  }
}
