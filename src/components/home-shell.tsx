"use client";

import { useState, useSyncExternalStore, useTransition } from "react";

import { saveActivePartyCode } from "@/lib/party-session";

import styles from "./home-shell.module.css";

const NICKNAME_KEY = "mafia-last-nickname";
const NICKNAME_EVENT = "mafia-nickname-changed";

function readStoredValue(key: string) {
  if (typeof window === "undefined") {
    return "";
  }

  return localStorage.getItem(key) ?? "";
}

function saveStoredValue(key: string, value: string) {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(key, value);
  window.dispatchEvent(new Event(NICKNAME_EVENT));
}

function saveSession(code: string, nickname: string) {
  localStorage.setItem(
    `mafia-session:${code.toUpperCase()}`,
    JSON.stringify({ nickname }),
  );
}

export function HomeShell() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const nickname = useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === "undefined") {
        return () => undefined;
      }

      window.addEventListener("storage", onStoreChange);
      window.addEventListener(NICKNAME_EVENT, onStoreChange);

      return () => {
        window.removeEventListener("storage", onStoreChange);
        window.removeEventListener(NICKNAME_EVENT, onStoreChange);
      };
    },
    () => readStoredValue(NICKNAME_KEY),
    () => "",
  );

  async function handleCreateSubmit() {
    setError(null);

    startTransition(() => {
      void (async () => {
        const response = await fetch("/api/party/create", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            nickname,
          }),
        });

        const payload = (await response.json()) as {
          code?: string;
          nickname?: string;
          error?: string;
        };

        if (!response.ok || !payload.code || !payload.nickname) {
          setError(payload.error ?? "Kreiranje partije nije uspelo.");
          return;
        }

        saveStoredValue(NICKNAME_KEY, payload.nickname);
        saveActivePartyCode(payload.code);
        saveSession(payload.code, payload.nickname);
      })().catch(() => {
        setError("Kreiranje partije nije uspelo.");
      });
    });
  }

  async function handleJoinSubmit() {
    setError(null);

    startTransition(() => {
      void (async () => {
        const response = await fetch("/api/party/join", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            code: joinCode,
            nickname,
          }),
        });

        const payload = (await response.json()) as {
          code?: string;
          nickname?: string;
          error?: string;
        };

        if (!response.ok || !payload.code || !payload.nickname) {
          setError(payload.error ?? "Ulazak u partiju nije uspeo.");
          return;
        }

        saveStoredValue(NICKNAME_KEY, payload.nickname);
        saveActivePartyCode(payload.code);
        saveSession(payload.code, payload.nickname);
      })().catch(() => {
        setError("Ulazak u partiju nije uspeo.");
      });
    });
  }

  return (
    <main className={styles.shell}>
      <div className={styles.topBar}>
        <button
          type="button"
          className={styles.createButton}
          disabled={isPending || nickname.trim().length < 2}
          onClick={() => {
            void handleCreateSubmit();
          }}
        >
          {isPending ? "Kreiram..." : "Nova partija"}
        </button>
      </div>

      <div className={styles.form}>
        <input
          className={styles.input}
          value={nickname}
          onChange={(event) => saveStoredValue(NICKNAME_KEY, event.target.value)}
          placeholder="Tvoj nadimak"
          minLength={2}
          maxLength={24}
          required
        />

        <div className={styles.joinRow}>
          <input
            className={styles.input}
            value={joinCode}
            onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
            placeholder="Kod partije"
            minLength={5}
            maxLength={5}
            required
          />
          <button
            type="button"
            className={styles.joinButton}
            disabled={
              isPending || nickname.trim().length < 2 || joinCode.trim().length !== 5
            }
            onClick={() => {
              void handleJoinSubmit();
            }}
          >
            {isPending ? "..." : "Udji"}
          </button>
        </div>
      </div>

      {error ? <div className={styles.errorBanner}>{error}</div> : null}
    </main>
  );
}
