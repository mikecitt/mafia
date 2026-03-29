"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import styles from "./home-shell.module.css";

const CREATE_NICKNAME_KEY = "mafia-last-create-nickname";
const JOIN_NICKNAME_KEY = "mafia-last-join-nickname";

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
  const [createNickname, setCreateNickname] = useState(() =>
    typeof window === "undefined" ? "" : readStoredValue(CREATE_NICKNAME_KEY),
  );
  const [joinNickname, setJoinNickname] = useState(() =>
    typeof window === "undefined" ? "" : readStoredValue(JOIN_NICKNAME_KEY),
  );
  const [joinCode, setJoinCode] = useState("");

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
            nickname: createNickname,
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

        saveStoredValue(CREATE_NICKNAME_KEY, payload.nickname);
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
            nickname: joinNickname,
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

        saveStoredValue(JOIN_NICKNAME_KEY, payload.nickname);
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
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>Mafija / Werewolf Helper</span>
          <h1>Aplikacija vodi noc dok ne padne prvi moderator.</h1>
          <p>
            Host je ujedno i igrac. Igraci ulaze preko koda, dobijaju tajne uloge
            na telefonu, a aplikacija tokom noci izgovara genericke komande i
            ceka poteze tacnih uloga.
          </p>
        </div>

        <div className={styles.heroAside}>
          <div className={styles.metric}>
            <strong>8-12</strong>
            <span>igraca po partiji</span>
          </div>
          <div className={styles.metric}>
            <strong>TTS</strong>
            <span>glasovne komande u browseru</span>
          </div>
          <div className={styles.metric}>
            <strong>Reconnect</strong>
            <span>povratak po istom nadimku</span>
          </div>
        </div>
      </section>

      <section className={styles.grid}>
        <section className={`${styles.panel} ${styles.panelCompact}`}>
          <div className={styles.panelHeader}>
            <span className={styles.panelKicker}>Host</span>
            <h2>Kreiraj partiju</h2>
            <p>
              Prvo pravis lobby sa svojim nadimkom. Tek nakon kreiranja u lobby-ju
              podesavas broj igraca i uloge.
            </p>
          </div>

          <label className={styles.field}>
            <span>Nadimak hosta</span>
            <input
              value={createNickname}
              onChange={(event) => setCreateNickname(event.target.value)}
              placeholder="Na primer Mika"
              minLength={2}
              maxLength={24}
              required
            />
          </label>

          <button
            type="button"
            className={styles.primaryButton}
            disabled={isPending}
            onClick={() => {
              void handleCreateSubmit();
            }}
          >
            {isPending ? "Kreiram..." : "Kreiraj lobby"}
          </button>
        </section>

        <section className={`${styles.panel} ${styles.panelCompact}`}>
          <div className={styles.panelHeader}>
            <span className={styles.panelKicker}>Igrac</span>
            <h2>Udji u partiju</h2>
            <p>
              Unesi kod i svoj nadimak. Ako se osvezis ili izgubis vezu, vracas se
              sa istim nadimkom.
            </p>
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

          <label className={styles.field}>
            <span>Tvoj nadimak</span>
            <input
              value={joinNickname}
              onChange={(event) => setJoinNickname(event.target.value)}
              placeholder="Na primer Sara"
              minLength={2}
              maxLength={24}
              required
            />
          </label>

          <button
            type="button"
            className={styles.secondaryButton}
            disabled={isPending}
            onClick={() => {
              void handleJoinSubmit();
            }}
          >
            {isPending ? "Povezujem..." : "Udji u lobby"}
          </button>
        </section>
      </section>

      <section className={styles.notes}>
        <div className={styles.noteCard}>
          <h3>Sta aplikacija radi</h3>
          <p>
            Vodi nocni redosled poteza, cuva tajne uloge, objavljuje dnevni ishod i
            ceka da host oznaci da li je neko prvi put izglasan.
          </p>
        </div>

        <div className={styles.noteCard}>
          <h3>Sta ostaje moderatoru</h3>
          <p>
            Kada prvi igrac bude izglasan, njemu se otvara moderatorski prikaz sa
            svim ulogama i dosadasnjim stanjem partije.
          </p>
        </div>
      </section>

      {error ? <div className={styles.errorBanner}>{error}</div> : null}
    </main>
  );
}
