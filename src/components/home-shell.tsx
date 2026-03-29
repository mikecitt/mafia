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
      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelKicker}>Nadimak</span>
          <h1>Tvoj nadimak za ovu partiju</h1>
        </div>

        <label className={styles.field}>
          <span>Nadimak</span>
          <input
            value={nickname}
            onChange={(event) => saveStoredValue(NICKNAME_KEY, event.target.value)}
            placeholder="Na primer Mika"
            minLength={2}
            maxLength={24}
            required
          />
        </label>
      </section>

      <section className={styles.grid}>
        <section className={`${styles.panel} ${styles.actionPanel}`}>
          <div className={styles.panelHeader}>
            <span className={styles.panelKicker}>Host</span>
            <h2>Kreiraj partiju</h2>
          </div>

          <button
            type="button"
            className={styles.primaryButton}
            disabled={isPending || nickname.trim().length < 2}
            onClick={() => {
              void handleCreateSubmit();
            }}
          >
            {isPending ? "Kreiram..." : "Kreiraj lobby"}
          </button>
        </section>

        <section className={`${styles.panel} ${styles.actionPanel}`}>
          <div className={styles.panelHeader}>
            <span className={styles.panelKicker}>Igrac</span>
            <h2>Udji u partiju</h2>
          </div>

          <label className={styles.field}>
            <span>Kod partije</span>
            <input
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
              placeholder="ABCDE"
              minLength={5}
              maxLength={5}
              required
            />
          </label>

          <button
            type="button"
            className={styles.secondaryButton}
            disabled={
              isPending || nickname.trim().length < 2 || joinCode.trim().length !== 5
            }
            onClick={() => {
              void handleJoinSubmit();
            }}
          >
            {isPending ? "Povezujem..." : "Udji u lobby"}
          </button>
        </section>
      </section>

      {error ? <div className={styles.errorBanner}>{error}</div> : null}
    </main>
  );
}
