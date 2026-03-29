export const ACTIVE_PARTY_CODE_KEY = "mafia-active-party-code";
export const ACTIVE_PARTY_EVENT = "mafia-active-party-changed";

function getCurrentPath() {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function notifyActivePartyChanged() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(ACTIVE_PARTY_EVENT));
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
      : null;

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

  window.history.pushState(
    {
      ...currentState,
      [ACTIVE_PARTY_CODE_KEY]: code.toUpperCase(),
    },
    "",
    getCurrentPath(),
  );
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
  window.history.replaceState(nextState, "", getCurrentPath());
  notifyActivePartyChanged();
}
