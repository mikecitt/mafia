import { NextResponse } from "next/server";

import { getPartyCode, getPartySnapshot, resolveDayVote } from "@/lib/game";
import { getPartyStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  try {
    const body = (await request.json()) as {
      nickname: string;
      votedOutPlayerId: string | null;
    };
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

    resolveDayVote(party, body.nickname, body.votedOutPlayerId);

    return NextResponse.json({
      party: getPartySnapshot(party, body.nickname),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Zakljucavanje dana nije uspelo.",
      },
      { status: 400 },
    );
  }
}
