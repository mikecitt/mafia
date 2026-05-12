import {
  dispatchBrowserEvent,
  safeReadStorage,
  safeRemoveStorage,
  safeWriteStorage,
} from "./browser-storage";

export const ACTIVE_PARTY_CODE_KEY = "mafia-active-party-code";
export const ACTIVE_PARTY_EVENT = "mafia-active-party-changed";

function getCurrentPath() {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function notifyActivePartyChanged() {
  if (typeof window === "undefined") {
    return;
  }

  dispatchBrowserEvent(ACTIVE_PARTY_EVENT);
}

export function readActivePartyCode() {
  if (typeof window === "undefined") {
    return null;
  }

  const historyState =
    window.history.state && typeof window.history.state === "object"
      ? (window.history.state as Record<string, unknown>)
      : null;
  const raw =
    historyState && typeof historyState[ACTIVE_PARTY_CODE_KEY] === "string"
      ? historyState[ACTIVE_PARTY_CODE_KEY]
      : safeReadStorage(ACTIVE_PARTY_CODE_KEY);

  return raw ? raw.trim().toUpperCase() : null;
}

export function saveActivePartyCode(code: string) {
  if (typeof window === "undefined") {
    return;
  }

  const currentState =
    window.history.state && typeof window.history.state === "object"
      ? (window.history.state as Record<string, unknown>)
      : {};

  const normalizedCode = code.toUpperCase();

  try {
    window.history.pushState(
      {
        ...currentState,
        [ACTIVE_PARTY_CODE_KEY]: normalizedCode,
      },
      "",
      getCurrentPath(),
    );
  } catch {
    try {
      window.history.replaceState(
        {
          ...currentState,
          [ACTIVE_PARTY_CODE_KEY]: normalizedCode,
        },
        "",
        getCurrentPath(),
      );
    } catch {
      // Some embedded browsers lock history state. Storage fallback still works.
    }
  }

  safeWriteStorage(ACTIVE_PARTY_CODE_KEY, normalizedCode);
  notifyActivePartyChanged();
}

export function clearActivePartyCode() {
  if (typeof window === "undefined") {
    return;
  }

  const currentState =
    window.history.state && typeof window.history.state === "object"
      ? (window.history.state as Record<string, unknown>)
      : {};

  const nextState = { ...currentState };
  delete nextState[ACTIVE_PARTY_CODE_KEY];
  try {
    window.history.replaceState(nextState, "", getCurrentPath());
  } catch {
    // If history state is unavailable, clearing durable storage is still enough.
  }

  safeRemoveStorage(ACTIVE_PARTY_CODE_KEY);
  notifyActivePartyChanged();
}
