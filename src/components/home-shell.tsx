"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import styles from "./home-shell.module.css";

const NICKNAME_KEY = "mafia-last-nickname";

function saveActivePartyCode(code: string) {
  localStorage.setItem("mafia-active-party-code", code.toUpperCase());
}

function readStoredValue(key: string) {
  return localStorage.getItem(key) ?? "";
}

function saveStoredValue(key: string, value: string) {
  localStorage.setItem(key, value);
}

function saveSession(code: string, nickname: string) {
  localStorage.setItem(
    `mafia-session:${code.toUpperCase()}`,
    JSON.stringify({ nickname }),
  );
}

export function HomeShell() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [nickname, setNickname] = useState(() =>
    typeof window === "undefined" ? "" : readStoredValue(NICKNAME_KEY),
  );
  const [joinCode, setJoinCode] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    saveStoredValue(NICKNAME_KEY, nickname);
  }, [nickname]);

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

        setNickname(payload.nickname);
        saveActivePartyCode(payload.code);
        saveSession(payload.code, payload.nickname);
        router.push("/party");
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

        setNickname(payload.nickname);
        saveActivePartyCode(payload.code);
        saveSession(payload.code, payload.nickname);
        router.push("/party");
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
            onChange={(event) => setNickname(event.target.value)}
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
            disabled={isPending || nickname.trim().length < 2 || joinCode.trim().length !== 5}
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
