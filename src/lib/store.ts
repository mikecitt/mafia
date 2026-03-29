import type { Party } from "@/lib/game";

declare global {
  var __mafiaStore: Map<string, Party> | undefined;
}

export function getPartyStore() {
  if (!globalThis.__mafiaStore) {
    globalThis.__mafiaStore = new Map<string, Party>();
  }

  return globalThis.__mafiaStore;
}
