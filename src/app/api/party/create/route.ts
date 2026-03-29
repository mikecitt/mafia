import { NextResponse } from "next/server";

import {
  createParty,
  DEFAULT_PARTY_CONFIG_INPUT,
  type PartyConfigInput,
} from "@/lib/game";
import { getPartyStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<PartyConfigInput> & {
      nickname: string;
    };
    const store = getPartyStore();
    const party = createParty(new Set(store.keys()), body.nickname, {
      totalPlayers: body.totalPlayers ?? DEFAULT_PARTY_CONFIG_INPUT.totalPlayers,
      mafiaCount: body.mafiaCount ?? DEFAULT_PARTY_CONFIG_INPUT.mafiaCount,
      hasDoctor: body.hasDoctor ?? DEFAULT_PARTY_CONFIG_INPUT.hasDoctor,
      hasPolice: body.hasPolice ?? DEFAULT_PARTY_CONFIG_INPUT.hasPolice,
      hasLady: body.hasLady ?? DEFAULT_PARTY_CONFIG_INPUT.hasLady,
    });

    store.set(party.code, party);

    return NextResponse.json({
      code: party.code,
      nickname: party.players[0]?.nickname ?? body.nickname,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Kreiranje partije nije uspelo.",
      },
      { status: 400 },
    );
  }
}
