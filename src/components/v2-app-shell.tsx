"use client";

import { useEffect, useRef, useState } from "react";

import {
  DEFAULT_PARTY_CONFIG_INPUT,
  ROLE_LABELS,
  type PartySnapshot,
  type PlayerStatus,
  type Role,
} from "@/lib/game";
import {
  clearActivePartyCode,
  readActivePartyCode,
  saveActivePartyCode,
} from "@/lib/party-session";

import styles from "./v2-shell.module.css";

const NICKNAME_KEY = "mafia-last-nickname";

const STATUS_LABELS: Record<PlayerStatus, string> = {
  alive: "Ziv",
  dead: "Mrtav",
  "voted-out": "Izglasan",
};

function readSession(code: string) {
  const raw = localStorage.getItem(`mafia-session:${code.toUpperCase()}`);

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as { nickname?: string };
    return parsed.nickname ? { nickname: parsed.nickname } : null;
  } catch {
    return null;
  }
}

function saveSession(code: string, nickname: string) {
  localStorage.setItem(
    `mafia-session:${code.toUpperCase()}`,
    JSON.stringify({ nickname }),
  );
}

function removeSession(code: string) {
  localStorage.removeItem(`mafia-session:${code.toUpperCase()}`);
}

function readSavedNickname() {
  if (typeof window === "undefined") {
    return "";
  }

  return localStorage.getItem(NICKNAME_KEY) ?? "";
}

function saveSavedNickname(nickname: string) {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(NICKNAME_KEY, nickname);
}

function prettyRole(role: Role | null | undefined) {
  if (!role) {
    return "Nepoznata";
  }

  return ROLE_LABELS[role];
}

function statusTone(status: PlayerStatus) {
  if (status === "alive") {
    return styles.statusAlive;
  }

  if (status === "dead") {
    return styles.statusDead;
  }

  return styles.statusOut;
}

function phaseLabel(snapshot: PartySnapshot) {
  if (snapshot.phase === "lobby") {
    return "Lobby";
  }

  if (snapshot.phase === "role-reveal") {
    return "Uloge";
  }

  if (snapshot.phase === "night-role") {
    return "Noc";
  }

  if (snapshot.phase === "night-transition") {
    return "Prelaz";
  }

  if (snapshot.phase === "day-summary") {
    return "Dan";
  }

  return "Moderator";
}

function phaseHint(snapshot: PartySnapshot) {
  if (snapshot.phase === "lobby") {
    return "Host bira konfiguraciju i pokrece partiju.";
  }

  if (snapshot.phase === "role-reveal") {
    return "Svako proverava svoju ulogu, pa host pokrece prvu noc.";
  }

  if (snapshot.phase === "night-role" || snapshot.phase === "night-transition") {
    return "Samo odgovarajuca uloga moze da odigra potez.";
  }

  if (snapshot.phase === "day-summary") {
    return "Host zatvara dnevni ishod.";
  }

  return "Aplikacija je predala partiju moderatoru.";
}

export function V2AppShell() {
  const [activeCode, setActiveCode] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  const [sessionNickname, setSessionNickname] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [reconnectNickname, setReconnectNickname] = useState("");
  const [snapshot, setSnapshot] = useState<PartySnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isRoleVisible, setIsRoleVisible] = useState(false);
  const [mafiaCount, setMafiaCount] = useState(DEFAULT_PARTY_CONFIG_INPUT.mafiaCount);
  const [hasDoctor, setHasDoctor] = useState(DEFAULT_PARTY_CONFIG_INPUT.hasDoctor);
  const [hasPolice, setHasPolice] = useState(DEFAULT_PARTY_CONFIG_INPUT.hasPolice);
  const [hasLady, setHasLady] = useState(DEFAULT_PARTY_CONFIG_INPUT.hasLady);
  const [isConfigDirty, setIsConfigDirty] = useState(false);
  const isMounted = useRef(false);
  const fetchSnapshotRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    isMounted.current = true;
    const code = readActivePartyCode();
    const savedNickname = readSavedNickname();
    setActiveCode(code);
    setNickname(savedNickname);

    if (code) {
      const session = readSession(code);
      setSessionNickname(session?.nickname ?? null);
      setReconnectNickname(session?.nickname ?? savedNickname);
    } else {
      setReconnectNickname(savedNickname);
    }

    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!snapshot || snapshot.phase !== "lobby" || !snapshot.requester.isHost || isConfigDirty) {
      return;
    }

    setMafiaCount(snapshot.config.mafiaCount);
    setHasDoctor(snapshot.config.hasDoctor);
    setHasPolice(snapshot.config.hasPolice);
    setHasLady(snapshot.config.hasLady);
  }, [isConfigDirty, snapshot]);

  const joinedPlayers = snapshot?.lobby.joinedCount ?? 1;
  const citizenCount =
    joinedPlayers - mafiaCount - Number(hasDoctor) - Number(hasPolice) - Number(hasLady);
  const canStartDraft = joinedPlayers >= 5 && citizenCount >= 1;

  async function fetchSnapshot() {
    if (!activeCode || !sessionNickname) {
      return;
    }

    try {
      const response = await fetch(
        `/api/party/${activeCode}?nickname=${encodeURIComponent(sessionNickname)}`,
        { cache: "no-store" },
      );
      const payload = (await response.json()) as {
        party?: PartySnapshot;
        error?: string;
      };

      if (!response.ok || !payload.party) {
        if (response.status === 404) {
          removeSession(activeCode);
          clearActivePartyCode();
          setActiveCode(null);
          setSessionNickname(null);
          setReconnectNickname(readSavedNickname());
          setSnapshot(null);
          setError("Partija vise nije dostupna.");
          return;
        }

        setSnapshot(null);
        setError(payload.error ?? "Partija nije dostupna.");
        return;
      }

      setSnapshot(payload.party);
      setError(null);
    } catch {
      setError("Partija nije dostupna.");
    }
  }

  fetchSnapshotRef.current = fetchSnapshot;

  useEffect(() => {
    if (!activeCode || !sessionNickname) {
      return;
    }

    void fetchSnapshotRef.current?.();
    const interval = window.setInterval(() => {
      void fetchSnapshotRef.current?.();
    }, 1500);

    return () => {
      window.clearInterval(interval);
    };
  }, [activeCode, sessionNickname]);

  useEffect(() => {
    setIsRoleVisible(false);
  }, [snapshot?.phase, snapshot?.promptKey]);

  async function handleCreate() {
    setActionError(null);
    setError(null);
    setIsBusy(true);

    try {
      const response = await fetch("/api/party/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ nickname }),
      });

      const payload = (await response.json()) as {
        code?: string;
        nickname?: string;
        error?: string;
      };

      if (!response.ok || !payload.code || !payload.nickname) {
        setActionError(payload.error ?? "Kreiranje partije nije uspelo.");
        return;
      }

      saveSavedNickname(payload.nickname);
      saveActivePartyCode(payload.code);
      saveSession(payload.code, payload.nickname);
      setNickname(payload.nickname);
      setActiveCode(payload.code);
      setSessionNickname(payload.nickname);
      setReconnectNickname(payload.nickname);
      setJoinCode("");
    } catch {
      setActionError("Kreiranje partije nije uspelo.");
    } finally {
      if (isMounted.current) {
        setIsBusy(false);
      }
    }
  }

  async function handleJoin() {
    setActionError(null);
    setError(null);
    setIsBusy(true);

    try {
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
        setActionError(payload.error ?? "Ulazak u partiju nije uspeo.");
        return;
      }

      saveSavedNickname(payload.nickname);
      saveActivePartyCode(payload.code);
      saveSession(payload.code, payload.nickname);
      setNickname(payload.nickname);
      setActiveCode(payload.code);
      setSessionNickname(payload.nickname);
      setReconnectNickname(payload.nickname);
      setJoinCode("");
    } catch {
      setActionError("Ulazak u partiju nije uspeo.");
    } finally {
      if (isMounted.current) {
        setIsBusy(false);
      }
    }
  }

  async function handleReconnect() {
    if (!activeCode) {
      return;
    }

    setActionError(null);
    setError(null);
    setIsBusy(true);

    try {
      const response = await fetch("/api/party/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: activeCode,
          nickname: reconnectNickname,
        }),
      });

      const payload = (await response.json()) as {
        code?: string;
        nickname?: string;
        error?: string;
      };

      if (!response.ok || !payload.code || !payload.nickname) {
        setActionError(payload.error ?? "Reconnect nije uspeo.");
        return;
      }

      saveSavedNickname(payload.nickname);
      saveSession(payload.code, payload.nickname);
      setNickname(payload.nickname);
      setSessionNickname(payload.nickname);
      setReconnectNickname(payload.nickname);
      await fetchSnapshot();
    } catch {
      setActionError("Reconnect nije uspeo.");
    } finally {
      if (isMounted.current) {
        setIsBusy(false);
      }
    }
  }

  async function postAction(
    path: string,
    body: Record<string, string | number | boolean | null>,
  ) {
    if (!sessionNickname) {
      return false;
    }

    setActionError(null);
    setError(null);
    setIsBusy(true);

    try {
      const response = await fetch(path, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nickname: sessionNickname,
          ...body,
        }),
      });

      const payload = (await response.json()) as {
        party?: PartySnapshot;
        error?: string;
      };

      if (!response.ok || !payload.party) {
        setActionError(payload.error ?? "Akcija nije uspela.");
        return false;
      }

      setSnapshot(payload.party);
      setIsConfigDirty(false);
      return true;
    } catch {
      setActionError("Akcija nije uspela.");
      return false;
    } finally {
      if (isMounted.current) {
        setIsBusy(false);
      }
    }
  }

  async function handleSaveConfig() {
    if (!activeCode) {
      return false;
    }

    return postAction(`/api/party/${activeCode}/config`, {
      mafiaCount,
      hasDoctor,
      hasPolice,
      hasLady,
    });
  }

  async function handleStartGame() {
    if (!activeCode) {
      return;
    }

    if (isConfigDirty) {
      const saved = await handleSaveConfig();

      if (!saved) {
        return;
      }
    }

    await postAction(`/api/party/${activeCode}/start`, {});
  }

  async function handleStopGame() {
    if (!activeCode) {
      return;
    }

    if (!window.confirm("Da li sigurno zelis da zaustavis partiju?")) {
      return;
    }

    setIsRoleVisible(false);
    await postAction(`/api/party/${activeCode}/stop`, {});
  }

  function disconnect() {
    if (activeCode) {
      removeSession(activeCode);
    }

    setSessionNickname(null);
    setSnapshot(null);
    setActionError(null);
    setError(null);
    setReconnectNickname(nickname);
  }

  function goHome() {
    clearActivePartyCode();
    setActiveCode(null);
    setSessionNickname(null);
    setSnapshot(null);
    setError(null);
    setActionError(null);
  }

  if (!activeCode) {
    return (
      <main className={styles.shell}>
        <section className={styles.panel}>
          <h2>Tvoj nadimak</h2>
          <label className={styles.field}>
            <span>Nadimak</span>
            <input
              value={nickname}
              onChange={(event) => {
                const nextNickname = event.target.value;
                setNickname(nextNickname);
                saveSavedNickname(nextNickname);
              }}
              placeholder="Na primer Mika"
              minLength={2}
              maxLength={24}
            />
          </label>
        </section>

        <section className={styles.panel}>
          <h2>Kreiraj partiju</h2>
          <button
            type="button"
            className={styles.button}
            disabled={isBusy || nickname.trim().length < 2}
            onClick={() => {
              void handleCreate();
            }}
          >
            {isBusy ? "Kreiram..." : "Kreiraj lobby"}
          </button>
        </section>

        <section className={styles.panel}>
          <h2>Udji u partiju</h2>
          <label className={styles.field}>
            <span>Kod partije</span>
            <input
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
              placeholder="ABCDE"
              minLength={5}
              maxLength={5}
            />
          </label>
          <button
            type="button"
            className={styles.secondaryButton}
            disabled={isBusy || nickname.trim().length < 2 || joinCode.trim().length !== 5}
            onClick={() => {
              void handleJoin();
            }}
          >
            {isBusy ? "Povezujem..." : "Udji u lobby"}
          </button>
        </section>

        {error ? <div className={styles.errorBanner}>{error}</div> : null}
        {actionError ? <div className={styles.errorBanner}>{actionError}</div> : null}
      </main>
    );
  }

  if (!sessionNickname) {
    return (
      <main className={styles.shell}>
        <section className={styles.hero}>
          <span className={styles.eyebrow}>Kod partije</span>
          <h1 className={styles.code}>{activeCode}</h1>
          <p>Unesi isti nadimak za reconnect ili novi nadimak ako je partija jos u lobby-ju.</p>
        </section>

        <section className={styles.panel}>
          <label className={styles.field}>
            <span>Nadimak</span>
            <input
              value={reconnectNickname}
              onChange={(event) => setReconnectNickname(event.target.value)}
              placeholder="Tvoj nadimak"
              minLength={2}
              maxLength={24}
            />
          </label>

          <button
            type="button"
            className={styles.button}
            disabled={isBusy || reconnectNickname.trim().length < 2}
            onClick={() => {
              void handleReconnect();
            }}
          >
            {isBusy ? "Ulazim..." : "Udji"}
          </button>

          <button type="button" className={styles.ghostButton} onClick={goHome}>
            Nazad
          </button>
        </section>

        {error ? <div className={styles.errorBanner}>{error}</div> : null}
        {actionError ? <div className={styles.errorBanner}>{actionError}</div> : null}
      </main>
    );
  }

  return (
    <main className={styles.shell}>
      <section className={styles.hero}>
        <span className={styles.eyebrow}>Partija</span>
        <h1 className={styles.code}>{activeCode}</h1>
        <div className={styles.topMeta}>
          {snapshot ? <span className={styles.phaseBadge}>{phaseLabel(snapshot)}</span> : null}
          {snapshot ? (
            <span className={`${styles.statusBadge} ${statusTone(snapshot.requester.status)}`}>
              {STATUS_LABELS[snapshot.requester.status]}
            </span>
          ) : null}
          <span className={styles.chip}>{sessionNickname}</span>
        </div>
        <p>
          {snapshot ? phaseHint(snapshot) : "Ucitavam stanje partije..."}
        </p>
      </section>

      {snapshot?.requester.role ? (
        <section className={styles.roleCard}>
          <span className={styles.eyebrow}>Tvoja uloga</span>
          <button
            type="button"
            className={`${styles.roleButton} ${isRoleVisible ? styles.roleButtonVisible : ""}`}
            onPointerDown={() => setIsRoleVisible(true)}
            onPointerUp={() => setIsRoleVisible(false)}
            onPointerLeave={() => setIsRoleVisible(false)}
            onPointerCancel={() => setIsRoleVisible(false)}
            onContextMenu={(event) => event.preventDefault()}
          >
            <span className={styles.hint}>
              {isRoleVisible ? "Pusti da sakrijes." : "Drzi da vidis svoju ulogu."}
            </span>
            <strong>{isRoleVisible ? prettyRole(snapshot.requester.role) : "Tajna uloga"}</strong>
          </button>
        </section>
      ) : null}

      <section className={styles.panel}>
        <span className={styles.eyebrow}>Prompt</span>
        <h2>{snapshot?.promptText ?? "Ucitavam..."}</h2>
        {snapshot ? (
          <p className={styles.metaLine}>
            {snapshot.requester.isHost ? "Ti si host." : "Cekaj sledeci korak."}
          </p>
        ) : null}
      </section>

      {snapshot?.phase === "lobby" ? (
        <section className={styles.panel}>
          <span className={styles.eyebrow}>Lobby</span>
          <p>Povezano igraca: {snapshot.lobby.joinedCount}</p>

          {snapshot.requester.isHost ? (
            <div className={styles.stack}>
              <label className={styles.field}>
                <span>Broj mafijasa</span>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={mafiaCount}
                  onChange={(event) => {
                    setMafiaCount(Number(event.target.value));
                    setIsConfigDirty(true);
                  }}
                />
              </label>

              <div className={styles.toggleList}>
                <label className={styles.toggle}>
                  <input
                    type="checkbox"
                    checked={hasDoctor}
                    onChange={(event) => {
                      setHasDoctor(event.target.checked);
                      setIsConfigDirty(true);
                    }}
                  />
                  <span>Lekar</span>
                </label>

                <label className={styles.toggle}>
                  <input
                    type="checkbox"
                    checked={hasPolice}
                    onChange={(event) => {
                      setHasPolice(event.target.checked);
                      setIsConfigDirty(true);
                    }}
                  />
                  <span>Policajac</span>
                </label>

                <label className={styles.toggle}>
                  <input
                    type="checkbox"
                    checked={hasLady}
                    onChange={(event) => {
                      setHasLady(event.target.checked);
                      setIsConfigDirty(true);
                    }}
                  />
                  <span>Dama</span>
                </label>
              </div>

              <div className={styles.summary}>
                <strong>Gradjana ostaje: {citizenCount}</strong>
                <span>
                  {citizenCount < 1
                    ? "Mora ostati bar jedan gradjanin."
                    : joinedPlayers < 5
                      ? "Potrebno je najmanje 5 igraca."
                      : isConfigDirty
                        ? "Sacuvaj promene pa pokreni partiju."
                        : "Spremno za start."}
                </span>
              </div>

              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.button}
                  disabled={isBusy || !canStartDraft || !snapshot.hostControls.canStart}
                  onClick={() => {
                    void handleStartGame();
                  }}
                >
                  Pokreni partiju
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.banner}>Host podesava konfiguraciju i pokrece partiju.</div>
          )}
        </section>
      ) : null}

      {snapshot?.phase === "role-reveal" ? (
        <section className={styles.panel}>
          <span className={styles.eyebrow}>Otkrivanje uloga</span>
          {snapshot.hostControls.canAdvanceRoleReveal ? (
            <button
              type="button"
              className={styles.button}
              disabled={isBusy}
              onClick={() => {
                void postAction(`/api/party/${activeCode}/advance`, {});
              }}
            >
              Svi su videli uloge
            </button>
          ) : (
            <div className={styles.banner}>Ceka se da host pokrene prvu noc.</div>
          )}
        </section>
      ) : null}

      {(snapshot?.phase === "night-role" || snapshot?.phase === "night-transition") ? (
        <section className={styles.panel}>
          <span className={styles.eyebrow}>Noc</span>
          {snapshot.actionState.note ? <div className={styles.banner}>{snapshot.actionState.note}</div> : null}
          {snapshot.actionState.canAct ? (
            <div className={styles.choiceGrid}>
              {snapshot.availableTargets.map((target) => (
                <button
                  key={target.id}
                  type="button"
                  className={styles.choiceButton}
                  disabled={isBusy}
                  onClick={() => {
                    void postAction(`/api/party/${activeCode}/action`, {
                      targetId: target.id,
                    });
                  }}
                >
                  {target.nickname}
                </button>
              ))}
            </div>
          ) : snapshot.actionState.hasSubmitted ? (
            <div className={styles.banner}>
              Akcija je poslata
              {snapshot.actionState.submittedTargetName
                ? `: ${snapshot.actionState.submittedTargetName}.`
                : "."}
            </div>
          ) : (
            <div className={styles.banner}>Cekaj sledeci prompt.</div>
          )}
        </section>
      ) : null}

      {snapshot?.phase === "day-summary" ? (
        <section className={styles.panel}>
          <span className={styles.eyebrow}>Dan</span>
          <div className={styles.summary}>
            <strong>Rezultat noci {snapshot.daySummary?.round}</strong>
            <span>
              {snapshot.daySummary?.victimName
                ? `${snapshot.daySummary.victimName} je ubijen.`
                : "Niko nije ubijen."}
            </span>
            <span>
              {snapshot.daySummary?.silencedName
                ? `${snapshot.daySummary.silencedName} je ucutkan.`
                : "Nema ucutkanog igraca."}
            </span>
          </div>

          {snapshot.hostControls.canResolveDay ? (
            <div className={styles.choiceGrid}>
              {snapshot.hostControls.voteCandidates.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  className={styles.choiceButton}
                  disabled={isBusy}
                  onClick={() => {
                    void postAction(`/api/party/${activeCode}/day`, {
                      votedOutPlayerId: candidate.id,
                    });
                  }}
                >
                  {candidate.nickname} je izglasan
                </button>
              ))}

              <button
                type="button"
                className={styles.secondaryButton}
                disabled={isBusy}
                onClick={() => {
                  void postAction(`/api/party/${activeCode}/day`, {
                    votedOutPlayerId: null,
                  });
                }}
              >
                Niko nije izglasan
              </button>
            </div>
          ) : (
            <div className={styles.banner}>Ceka se host.</div>
          )}
        </section>
      ) : null}

      <section className={styles.panel}>
        <span className={styles.eyebrow}>Akcije</span>
        <div className={styles.actions}>
          <button type="button" className={styles.ghostButton} onClick={disconnect}>
            Promeni nadimak
          </button>
          {snapshot?.hostControls.canStop ? (
            <button
              type="button"
              className={styles.dangerButton}
              disabled={isBusy}
              onClick={() => {
                void handleStopGame();
              }}
            >
              Zaustavi partiju
            </button>
          ) : null}
          <button type="button" className={styles.ghostButton} onClick={goHome}>
            Nazad na pocetak
          </button>
        </div>
      </section>

      {error ? <div className={styles.errorBanner}>{error}</div> : null}
      {actionError ? <div className={styles.errorBanner}>{actionError}</div> : null}
    </main>
  );
}
