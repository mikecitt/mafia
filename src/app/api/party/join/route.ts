import { NextResponse } from "next/server";

import { getPartyCode, joinParty } from "@/lib/game";
import { getPartyStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { code: string; nickname: string };
    const store = getPartyStore();
    const code = getPartyCode(body.code);
    const party = store.get(code);

    if (!party) {
      return NextResponse.json(
        { error: "Partija sa tim kodom ne postoji." },
        { status: 404 },
      );
    }

    const player = joinParty(party, body.nickname);

    return NextResponse.json({
      code: party.code,
      nickname: player.nickname,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Povezivanje na partiju nije uspelo.",
      },
      { status: 400 },
    );
  }
}
