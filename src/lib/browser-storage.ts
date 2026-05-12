export function safeReadStorage(key: string) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeWriteStorage(key: string, value: string) {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function safeRemoveStorage(key: string) {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function dispatchBrowserEvent(name: string) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (typeof Event === "function") {
      window.dispatchEvent(new Event(name));
      return;
    }
  } catch {
    // Fall back to the older createEvent API below.
  }

  const event = document.createEvent("Event");
  event.initEvent(name, false, false);
  window.dispatchEvent(event);
}
