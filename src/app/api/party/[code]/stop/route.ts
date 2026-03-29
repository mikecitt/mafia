import { NextResponse } from "next/server";

import { getPartyCode, stopGame } from "@/lib/game";
import { getPartyStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  try {
    const body = (await request.json()) as { nickname: string };
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

    stopGame(party, body.nickname);
    store.delete(code);

    return NextResponse.json({
      stopped: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Stopiranje partije nije uspelo.",
      },
      { status: 400 },
    );
  }
}
