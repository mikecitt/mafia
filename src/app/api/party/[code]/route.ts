import { NextResponse } from "next/server";

import { getPartyCode, getPartySnapshot } from "@/lib/game";
import { getPartyStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  try {
    const { code: rawCode } = await context.params;
    const code = getPartyCode(rawCode);
    const url = new URL(request.url);
    const nickname = url.searchParams.get("nickname") ?? "";
    const store = getPartyStore();
    const party = store.get(code);

    if (!party) {
      return NextResponse.json(
        { error: "Partija sa tim kodom ne postoji." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      party: getPartySnapshot(party, nickname),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Ucitavanje partije nije uspelo.",
      },
      { status: 400 },
    );
  }
}
