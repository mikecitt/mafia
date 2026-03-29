"use client";

import { useEffect, useState } from "react";

import {
  ACTIVE_PARTY_EVENT,
  readActivePartyCode,
} from "@/lib/party-session";

import { HomeShell } from "./home-shell";
import { PartyShell } from "./party-shell";

export function AppShell() {
  const [hasActiveParty, setHasActiveParty] = useState<boolean | null>(null);

  useEffect(() => {
    const syncActiveParty = () => {
      setHasActiveParty(Boolean(readActivePartyCode()));
    };

    syncActiveParty();
    window.addEventListener("popstate", syncActiveParty);
    window.addEventListener(ACTIVE_PARTY_EVENT, syncActiveParty);

    return () => {
      window.removeEventListener("popstate", syncActiveParty);
      window.removeEventListener(ACTIVE_PARTY_EVENT, syncActiveParty);
    };
  }, []);

  if (hasActiveParty === null) {
    return null;
  }

  return hasActiveParty ? <PartyShell /> : <HomeShell />;
}
