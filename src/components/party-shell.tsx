"use client";

import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useRef, useState, useTransition } from "react";

import type { PartySnapshot, PlayerStatus } from "@/lib/game";
import { clearActivePartyCode, readActivePartyCode } from "@/lib/party-session";

import styles from "./party-shell.module.css";

const STATUS_LABELS: Record<PlayerStatus, string> = {
  alive: "Ziv",
  dead: "Mrtav",
  "voted-out": "Izglasan",
};

const ROLE_LABELS: Record<string, string> = {
  citizen: "Građanin",
  doctor: "Lekar",
  police: "Policajac",
  mafia: "Mafija",
  lady: "Dama",
};

type MobileSection = "game" | "players" | "rules" | "moderator";

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

function statusTone(status: PlayerStatus) {
  if (status === "alive") {
    return styles.statusAlive;
  }

  if (status === "dead") {
    return styles.statusDead;
  }

  return styles.statusOut;
}

function prettyRole(role: string | null | undefined) {
  if (!role) {
    return "Nepoznata";
  }

  return ROLE_LABELS[role] ?? role;
}

function phaseHint(snapshot: PartySnapshot) {
  if (snapshot.phase === "lobby") {
    return "Host u lobby-ju podesava uloge, a broj igraca se uzima iz trenutno povezanih ljudi.";
  }

  if (snapshot.phase === "role-reveal") {
    return "Svako sada zadrzava klik na kartici svoje uloge, a host nakon toga pokrece prvu noc.";
  }

  if (snapshot.phase === "night-role" || snapshot.phase === "night-transition") {
    return "Svi vide isti prompt, ali samo odgovarajuca uloga moze da reaguje.";
  }

  if (snapshot.phase === "day-summary") {
    return "Host sada zatvara dan: bira igraca koji je izglasan ili nastavlja u novi krug.";
  }

  return "Aplikacija je predala partiju novom moderatoru.";
}

export function PartyShell() {
  const router = useRouter();
  const [isRefreshing, startRefreshTransition] = useTransition();
  const [activeCode, setActiveCode] = useState<string | null>(null);
  const [sessionNickname, setSessionNickname] = useState<string | null>(null);
  const [reconnectNickname, setReconnectNickname] = useState("");
  const [snapshot, setSnapshot] = useState<PartySnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRoleVisible, setIsRoleVisible] = useState(false);
  const [mobileSection, setMobileSection] = useState<MobileSection>("game");
  const [isConfigDirty, setIsConfigDirty] = useState(false);
  const [mafiaCount, setMafiaCount] = useState(2);
  const [hasDoctor, setHasDoctor] = useState(true);
  const [hasPolice, setHasPolice] = useState(true);
  const [hasLady, setHasLady] = useState(false);
  const configRequestId = useRef(0);
  const lastPromptKey = useRef<string | null>(null);
  const fetchSnapshotRef = useRef<(() => Promise<void>) | null>(null);
  const hasInitializedTts = useRef(false);
  const partyCode = activeCode ?? "";

  useEffect(() => {
    const storedCode = readActivePartyCode();
    setActiveCode(storedCode);

    if (!storedCode) {
      return;
    }

    const session = readSession(storedCode);
    setSessionNickname(session?.nickname ?? null);
    setReconnectNickname(session?.nickname ?? "");
  }, []);

  useEffect(() => {
    if (!snapshot || snapshot.phase !== "lobby" || isConfigDirty) {
      return;
    }

    setMafiaCount(snapshot.config.mafiaCount);
    setHasDoctor(snapshot.config.hasDoctor);
    setHasPolice(snapshot.config.hasPolice);
    setHasLady(snapshot.config.hasLady);
  }, [isConfigDirty, snapshot]);

  useEffect(() => {
    if (!snapshot?.requester.isHost || snapshot.phase !== "lobby" || !sessionNickname) {
      return;
    }

    const configMatchesSnapshot =
      mafiaCount === snapshot.config.mafiaCount &&
      hasDoctor === snapshot.config.hasDoctor &&
      hasPolice === snapshot.config.hasPolice &&
      hasLady === snapshot.config.hasLady;

    if (configMatchesSnapshot) {
      if (isConfigDirty) {
        setIsConfigDirty(false);
      }

      return;
    }

    const requestId = configRequestId.current + 1;
    configRequestId.current = requestId;
    const timeoutId = window.setTimeout(() => {
      void (async () => {
        setActionError(null);
        setIsSubmitting(true);

        try {
          const response = await fetch(`/api/party/${partyCode}/config`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              nickname: sessionNickname,
              mafiaCount,
              hasDoctor,
              hasPolice,
              hasLady,
            }),
          });

          const payload = (await response.json()) as {
            party?: PartySnapshot;
            error?: string;
          };

          if (requestId !== configRequestId.current) {
            return;
          }

          if (!response.ok || !payload.party) {
            setActionError(payload.error ?? "Cuvanje konfiguracije nije uspelo.");
            return;
          }

          setSnapshot(payload.party);
          setIsConfigDirty(false);
          void fetchSnapshotRef.current?.();
        } catch {
          if (requestId === configRequestId.current) {
            setActionError("Cuvanje konfiguracije nije uspelo.");
          }
        } finally {
          if (requestId === configRequestId.current) {
            setIsSubmitting(false);
          }
        }
      })();
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    hasDoctor,
    hasLady,
    hasPolice,
    isConfigDirty,
    mafiaCount,
    partyCode,
    sessionNickname,
    snapshot?.config.hasDoctor,
    snapshot?.config.hasLady,
    snapshot?.config.hasPolice,
    snapshot?.config.mafiaCount,
    snapshot?.phase,
    snapshot?.requester.isHost,
  ]);

  useEffect(() => {
    if (!snapshot || hasInitializedTts.current) {
      return;
    }

    setTtsEnabled(snapshot.requester.isHost);
    hasInitializedTts.current = true;
  }, [snapshot]);

  async function fetchSnapshot() {
    if (!sessionNickname || !activeCode) {
      return;
    }

    const response = await fetch(
      `/api/party/${activeCode}?nickname=${encodeURIComponent(sessionNickname)}`,
      {
        cache: "no-store",
      },
    );

    const payload = (await response.json()) as {
      party?: PartySnapshot;
      error?: string;
    };

    if (!response.ok || !payload.party) {
      if (response.status === 404) {
        removeSession(activeCode);
        clearActivePartyCode();
        setSnapshot(null);
        setSessionNickname(null);
        setReconnectNickname("");
        setError(null);
        setActionError(null);
        setTtsEnabled(false);
        hasInitializedTts.current = false;
        return;
      }

      setSnapshot(null);
      setError(payload.error ?? "Partija nije dostupna.");
      return;
    }

    startRefreshTransition(() => {
      setSnapshot(payload.party ?? null);
      setError(null);
    });
  }

  fetchSnapshotRef.current = fetchSnapshot;

  const speakPrompt = useEffectEvent((text: string) => {
    if (!("speechSynthesis" in window)) {
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "hr-HR";
    utterance.rate = 0.96;

    const matchingVoice = window
      .speechSynthesis
      .getVoices()
      .find((voice) => voice.lang.toLowerCase().startsWith("hr"));

    if (matchingVoice) {
      utterance.voice = matchingVoice;
    }

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  });

  useEffect(() => {
    if (!sessionNickname || !activeCode) {
      return;
    }

    void fetchSnapshotRef.current?.();
    const interval = window.setInterval(() => {
      void fetchSnapshotRef.current?.();
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [activeCode, sessionNickname]);

  useEffect(() => {
    if (!ttsEnabled || !snapshot?.promptText || !snapshot.promptKey) {
      return;
    }

    if (lastPromptKey.current === snapshot.promptKey) {
      return;
    }

    lastPromptKey.current = snapshot.promptKey;

    if (snapshot.promptKey.includes("police-result")) {
      return;
    }

    speakPrompt(snapshot.promptText);
  }, [snapshot?.promptKey, snapshot?.promptText, ttsEnabled]);

  useEffect(() => {
    setIsRoleVisible(false);
  }, [snapshot?.phase, snapshot?.promptKey]);

  async function postAction(
    path: string,
    body: Record<string, string | number | boolean | null>,
  ) {
    if (!sessionNickname) {
      return;
    }

    setActionError(null);
    setIsSubmitting(true);

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

      if (!response.ok) {
        setActionError(payload.error ?? "Akcija nije uspela.");
        return;
      }

      if (payload.party) {
        setSnapshot(payload.party);
      }

      if (path.endsWith("/config")) {
        setIsConfigDirty(false);
      }

      void fetchSnapshot();
    } catch {
      setActionError("Akcija nije uspela.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function reconnectToParty() {
    setActionError(null);

    if (!activeCode) {
      setActionError("Partija nije izabrana na ovom uređaju.");
      return;
    }

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

    if (!response.ok || !payload.nickname) {
      setActionError(payload.error ?? "Reconnect nije uspeo.");
      return;
    }

    saveSession(activeCode, payload.nickname);
    setSessionNickname(payload.nickname);
    setError(null);
    router.refresh();
  }

  function disconnect() {
    if (activeCode) {
      removeSession(activeCode);
    }

    setSnapshot(null);
    setSessionNickname(null);
    setReconnectNickname("");
    setTtsEnabled(false);
    hasInitializedTts.current = false;
  }

  function returnHome() {
    clearActivePartyCode();
  }

  async function handleStopGame() {
    if (!window.confirm("Da li sigurno zelis da zaustavis partiju i vratis sve u lobby?")) {
      return;
    }

    setIsRoleVisible(false);
    setActionError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/party/${partyCode}/stop`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nickname: sessionNickname,
        }),
      });

      const payload = (await response.json()) as {
        party?: PartySnapshot;
        error?: string;
      };

      if (!response.ok || !payload.party) {
        setActionError(payload.error ?? "Stopiranje partije nije uspelo.");
        return;
      }

      setSnapshot(payload.party);
      setError(null);
      setActionError(null);
      void fetchSnapshot();
    } catch {
      setActionError("Stopiranje partije nije uspelo.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const joinedPlayers = snapshot?.lobby.joinedCount ?? 1;
  const citizenCount =
    joinedPlayers -
    mafiaCount -
    Number(hasDoctor) -
    Number(hasPolice) -
    Number(hasLady);
  const configInvalid = citizenCount < 1;
  const hasEnoughPlayersToStart = joinedPlayers >= 5;
  const canStartWithDraft = hasEnoughPlayersToStart && !configInvalid;
  const resolvedMobileSection =
    mobileSection === "moderator" && !snapshot?.moderatorView
      ? "rules"
      : mobileSection;

  function renderGamePanel() {
    if (!snapshot) {
      return null;
    }

    return (
      <article className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.kicker}>Tok partije</span>
          <h3>Akcija za ovaj ekran</h3>
        </div>

        <div className={styles.promptInline}>
          <strong>{snapshot.promptText ?? "Partija se priprema."}</strong>
          <span>{phaseHint(snapshot)}</span>
          <span className={styles.pollingHint}>
            {isRefreshing ? "Osvezavam stanje..." : "Stanje se osvezava automatski."}
          </span>
        </div>

        {snapshot.phase === "lobby" ? (
          <div className={styles.stack}>
            <p className={styles.copy}>Povezano je {snapshot.lobby.joinedCount} igraca.</p>
            {snapshot.hostControls.canUpdateConfig ? (
              <div className={styles.configForm}>
                <div className={styles.choiceGrid}>
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
                      required
                    />
                  </label>
                </div>

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

                <div className={styles.summaryPanel}>
                  <strong>Gradjana ostaje: {citizenCount}</strong>
                  <span>
                    {citizenCount < 1
                      ? "Mora ostati makar jedan gradjanin."
                      : joinedPlayers < 5
                        ? "Za pokretanje partije potrebno je najmanje 5 igraca."
                        : "Konfiguracija je spremna za random dodelu."}
                  </span>
                </div>

                <span className={styles.pollingHint}>
                  {isConfigDirty ? "Primenjujem promene..." : "Promene se cuvaju automatski."}
                </span>

                <div className={styles.actionRow}>
                  <button
                    type="button"
                    className={styles.primaryButton}
                    disabled={
                      isSubmitting ||
                      isConfigDirty ||
                      !canStartWithDraft ||
                      !snapshot.hostControls.canStart
                    }
                    onClick={() => postAction(`/api/party/${partyCode}/start`, {})}
                  >
                    Pokreni partiju
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className={styles.copy}>
                  Konfiguracija: {snapshot.config.mafiaCount} mafijasa,{" "}
                  {snapshot.config.hasDoctor ? "1 lekar" : "bez lekara"},{" "}
                  {snapshot.config.hasPolice ? "1 policajac" : "bez policajca"},{" "}
                  {snapshot.config.hasLady ? "1 dama" : "bez dame"}.
                </p>
                <div className={styles.subtleBlock}>
                  Ceka se da host podesi uloge i pokrene partiju.
                </div>
              </>
            )}
          </div>
        ) : null}

        {snapshot.phase === "role-reveal" ? (
          <div className={styles.stack}>
            <div className={styles.notePanel}>
              Svako sada treba da zadrzi klik na svojoj kartici i proveri ulogu.
            </div>

            {snapshot.hostControls.canAdvanceRoleReveal ? (
              <button
                type="button"
                className={styles.primaryButton}
                disabled={isSubmitting}
                onClick={() => postAction(`/api/party/${partyCode}/advance`, {})}
              >
                Svi su videli uloge, pokreni prvu noc
              </button>
            ) : (
              <div className={styles.subtleBlock}>
                Ceka se da host potvrdi da su svi pogledali svoje uloge.
              </div>
            )}
          </div>
        ) : null}

        {(snapshot.phase === "night-role" || snapshot.phase === "night-transition") ? (
          <div className={styles.stack}>
            {snapshot.actionState.note ? (
              <div className={styles.notePanel}>{snapshot.actionState.note}</div>
            ) : null}

            {snapshot.actionState.canAct ? (
              <>
                <p className={styles.copy}>Na potezu si. Izaberi metu na telefonu.</p>
                <div className={styles.choiceGrid}>
                  {snapshot.availableTargets.map((target) => (
                    <button
                      key={target.id}
                      type="button"
                      className={styles.choiceButton}
                      disabled={isSubmitting}
                      onClick={() =>
                        postAction(`/api/party/${partyCode}/action`, {
                          targetId: target.id,
                        })
                      }
                    >
                      {target.nickname}
                    </button>
                  ))}
                </div>
              </>
            ) : snapshot.actionState.hasSubmitted ? (
              <div className={styles.notePanel}>
                Tvoja akcija je zabelezena
                {snapshot.actionState.submittedTargetName
                  ? `: ${snapshot.actionState.submittedTargetName}.`
                  : "."}
              </div>
            ) : (
              <div className={styles.subtleBlock}>
                Ovaj ekran sada samo slusa komandu i ceka sledeci prompt.
              </div>
            )}
          </div>
        ) : null}

        {snapshot.phase === "day-summary" ? (
          <div className={styles.stack}>
            <div className={styles.summaryPanel}>
              <strong>Rezultat noci {snapshot.daySummary?.round}</strong>
              <span>
                {snapshot.daySummary?.victimName
                  ? `${snapshot.daySummary.victimName} je ubijen tokom noci.`
                  : "Tokom noci niko nije ubijen."}
              </span>
              <span>
                {snapshot.daySummary?.silencedName
                  ? `${snapshot.daySummary.silencedName} je ucutkan za danas.`
                  : "Nema ucutkanog igraca u ovom krugu."}
              </span>
            </div>

            {snapshot.hostControls.canResolveDay ? (
              <>
                <p className={styles.copy}>
                  Host sada oznacava da li je neko prvi put izglasan.
                </p>
                <div className={styles.choiceGrid}>
                  {snapshot.hostControls.voteCandidates.map((candidate) => (
                    <button
                      key={candidate.id}
                      type="button"
                      className={styles.choiceButton}
                      disabled={isSubmitting}
                      onClick={() =>
                        postAction(`/api/party/${partyCode}/day`, {
                          votedOutPlayerId: candidate.id,
                        })
                      }
                    >
                      {candidate.nickname} je izglasan
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  className={styles.secondaryButton}
                  disabled={isSubmitting}
                  onClick={() =>
                    postAction(`/api/party/${partyCode}/day`, {
                      votedOutPlayerId: null,
                    })
                  }
                >
                  Niko nije izglasan, vodi sledeci krug
                </button>
              </>
            ) : (
              <div className={styles.subtleBlock}>
                Ceka se da host zatvori dnevni ishod.
              </div>
            )}
          </div>
        ) : null}

        {snapshot.phase === "handoff" ? (
          <div className={styles.stack}>
            {snapshot.requester.isModerator ? (
              <div className={styles.notePanel}>
                Ti sada preuzimas partiju kao moderator. Ispod imas kompletan
                pregled uloga i dosadasnjih ishoda.
              </div>
            ) : (
              <div className={styles.subtleBlock}>
                Aplikacija je zavrsila svoj deo. Novi moderator sada vodi
                partiju uz pomoc svog prikaza.
              </div>
            )}
          </div>
        ) : null}
      </article>
    );
  }

  function renderPlayersPanel() {
    if (!snapshot) {
      return null;
    }

    return (
      <article className={`${styles.panel} ${styles.scrollPanel}`}>
        <div className={styles.panelHeader}>
          <span className={styles.kicker}>Igraci</span>
          <h3>Trenutno stanje za ovu partiju</h3>
        </div>

        <div className={styles.playerList}>
          {snapshot.players.map((player) => (
            <div key={player.id} className={styles.playerRow}>
              <div>
                <strong>{player.nickname}</strong>
                <div className={styles.playerMeta}>
                  {player.isHost ? "Host" : "Igrac"}
                  {snapshot.requester.isModerator && player.role
                    ? ` • ${prettyRole(player.role)}`
                    : ""}
                </div>
              </div>

              <div className={styles.rowAside}>
                <span className={`${styles.badge} ${statusTone(player.status)}`}>
                  {STATUS_LABELS[player.status]}
                </span>
                <span
                  className={`${styles.dot} ${
                    player.isConnected ? styles.dotOn : styles.dotOff
                  }`}
                />
              </div>
            </div>
          ))}
        </div>
      </article>
    );
  }

  function renderRulesPanel() {
    if (!snapshot) {
      return null;
    }

    return (
      <article className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.kicker}>Rezime pravila</span>
          <h3>Aktivna konfiguracija</h3>
        </div>

        <div className={styles.ruleGrid}>
          <div className={styles.ruleCard}>
            <strong>{snapshot.config.totalPlayers}</strong>
            <span>ukupno igraca</span>
          </div>
          <div className={styles.ruleCard}>
            <strong>{snapshot.config.mafiaCount}</strong>
            <span>mafijasa</span>
          </div>
          <div className={styles.ruleCard}>
            <strong>{snapshot.config.hasDoctor ? "Da" : "Ne"}</strong>
            <span>lekar</span>
          </div>
          <div className={styles.ruleCard}>
            <strong>{snapshot.config.hasPolice ? "Da" : "Ne"}</strong>
            <span>policajac</span>
          </div>
          <div className={styles.ruleCard}>
            <strong>{snapshot.config.hasLady ? "Da" : "Ne"}</strong>
            <span>dama</span>
          </div>
          <div className={styles.ruleCard}>
            <strong>{snapshot.config.citizenCount}</strong>
            <span>gradjana</span>
          </div>
        </div>
      </article>
    );
  }

  function renderModeratorPanel() {
    if (!snapshot) {
      return null;
    }

    if (snapshot.moderatorView) {
      return (
        <article className={`${styles.panel} ${styles.scrollPanel}`}>
          <div className={styles.panelHeader}>
            <span className={styles.kicker}>Moderator</span>
            <h3>Kompletan pregled partije</h3>
          </div>

          <div className={styles.stack}>
            <div className={styles.playerList}>
              {snapshot.moderatorView.players.map((player) => (
                <div key={player.id} className={styles.playerRow}>
                  <div>
                    <strong>{player.nickname}</strong>
                    <div className={styles.playerMeta}>
                      {prettyRole(player.role)}
                      {player.isHost ? " • Host" : ""}
                    </div>
                  </div>
                  <span className={`${styles.badge} ${statusTone(player.status)}`}>
                    {STATUS_LABELS[player.status]}
                  </span>
                </div>
              ))}
            </div>

            <div className={styles.history}>
              {snapshot.moderatorView.history.map((item) => (
                <div key={item.round} className={styles.historyCard}>
                  <strong>Noc {item.round}</strong>
                  <span>
                    {item.victimName ? `Ubijen: ${item.victimName}` : "Niko nije ubijen"}
                  </span>
                  <span>
                    {item.silencedName
                      ? `Ucutkan: ${item.silencedName}`
                      : "Bez ucutkanog igraca"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </article>
      );
    }

    return (
      <article className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.kicker}>Napomena</span>
          <h3>Tajnost uloga ostaje sacuvana</h3>
        </div>
        <p className={styles.copy}>
          Dok ne dodje do prvog izglasavanja, ovaj ekran krije tudje uloge i
          prikazuje samo ono sto bi igrac legitimno znao u toku partije.
        </p>
      </article>
    );
  }

  if (!activeCode) {
    return (
      <main className={styles.shell}>
        <section className={styles.centerCard}>
          <span className={styles.kicker}>Party</span>
          <h1>Na ovom uređaju nema aktivne partije.</h1>
          <p>Vrati se na početak, unesi kod tamo i zatim otvori ovaj ekran.</p>

          <button type="button" className={styles.linkBack} onClick={returnHome}>
            Nazad na pocetak
          </button>
        </section>
      </main>
    );
  }

  if (!sessionNickname) {
    return (
      <main className={styles.shell}>
        <section className={styles.centerCard}>
          <span className={styles.kicker}>Party {partyCode}</span>
          <h1>Unesi nadimak za reconnect ili ulazak u lobby.</h1>
          <p>
            Ako partija jos nije pocela, novi igrac moze da se pridruzi. Ako jeste,
            isti nadimak vraca postojeceg igraca u partiju.
          </p>

          <div className={styles.form}>
            <input
              value={reconnectNickname}
              onChange={(event) => setReconnectNickname(event.target.value)}
              minLength={2}
              maxLength={24}
              placeholder="Tvoj nadimak"
              required
            />
            <button
              type="button"
              onClick={() => {
                void reconnectToParty();
              }}
            >
              Udji u partiju
            </button>
          </div>

          {actionError ? <div className={styles.errorBanner}>{actionError}</div> : null}

          <button type="button" className={styles.linkBack} onClick={returnHome}>
            Nazad na pocetak
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.shell}>
      <section className={styles.headerCard}>
        <div className={styles.identity}>
          <span className={styles.kicker}>Kod partije</span>
          <h1>{partyCode}</h1>
          <p>
            Igrac <strong>{sessionNickname}</strong> je povezan.{" "}
            {snapshot?.requester.role ? (
              "Tvoja uloga je sakrivena i vidi se samo dok drzis karticu ispod."
            ) : (
              "Host sada u lobby-ju podesava partiju. Uloga ce se pojaviti nakon starta."
            )}
          </p>
        </div>

        <div className={styles.headerActions}>
          <div className={styles.badges}>
            <span className={`${styles.badge} ${snapshot ? statusTone(snapshot.requester.status) : ""}`}>
              {snapshot ? STATUS_LABELS[snapshot.requester.status] : "Bez stanja"}
            </span>

            <button
              type="button"
              className={styles.toggleButton}
              onClick={() => setTtsEnabled((value) => !value)}
            >
              {ttsEnabled ? "TTS ukljucen" : "TTS iskljucen"}
            </button>
          </div>

          <button type="button" className={styles.linkButton} onClick={disconnect}>
            Promeni nadimak
          </button>
          {snapshot?.hostControls.canStop ? (
            <button
              type="button"
              className={styles.stopButton}
              onClick={() => {
                void handleStopGame();
              }}
            >
              Zaustavi partiju
            </button>
          ) : null}
        </div>
      </section>

      {error ? <div className={styles.errorBanner}>{error}</div> : null}
      {actionError ? <div className={styles.errorBanner}>{actionError}</div> : null}

      {snapshot ? (
        <>
          {snapshot.requester.role ? (
            <section className={styles.secretCard}>
              <span className={styles.kicker}>Tajna uloga</span>
              <button
                type="button"
                className={`${styles.roleHoldButton} ${
                  isRoleVisible ? styles.roleHoldButtonVisible : ""
                }`}
                onPointerDown={() => setIsRoleVisible(true)}
                onPointerUp={() => setIsRoleVisible(false)}
                onPointerLeave={() => setIsRoleVisible(false)}
                onPointerCancel={() => setIsRoleVisible(false)}
                onContextMenu={(event) => event.preventDefault()}
              >
                <span className={styles.roleHoldHint}>
                  {isRoleVisible ? "Pusti klik da ponovo sakrijes ulogu." : "Drzi klik da vidis svoju ulogu."}
                </span>
                <strong>{isRoleVisible ? prettyRole(snapshot.requester.role) : "Tajna uloga"}</strong>
              </button>
            </section>
          ) : null}

          <section className={styles.mobileTabs}>
            <div className={styles.tabRow}>
              <button
                type="button"
                className={`${styles.tabButton} ${
                  resolvedMobileSection === "game" ? styles.tabButtonActive : ""
                }`}
                onClick={() => setMobileSection("game")}
              >
                Tok
              </button>
              <button
                type="button"
                className={`${styles.tabButton} ${
                  resolvedMobileSection === "players" ? styles.tabButtonActive : ""
                }`}
                onClick={() => setMobileSection("players")}
              >
                Igrači
              </button>
              <button
                type="button"
                className={`${styles.tabButton} ${
                  resolvedMobileSection === "rules" ? styles.tabButtonActive : ""
                }`}
                onClick={() => setMobileSection("rules")}
              >
                Pravila
              </button>
              {snapshot.moderatorView ? (
                <button
                  type="button"
                  className={`${styles.tabButton} ${
                    resolvedMobileSection === "moderator" ? styles.tabButtonActive : ""
                  }`}
                  onClick={() => setMobileSection("moderator")}
                >
                  Moderator
                </button>
              ) : null}
            </div>
          </section>

          <section className={styles.mobileLayout}>
            {resolvedMobileSection === "game" ? renderGamePanel() : null}
            {resolvedMobileSection === "players" ? renderPlayersPanel() : null}
            {resolvedMobileSection === "rules" ? (
              <>
                {renderRulesPanel()}
                {renderModeratorPanel()}
              </>
            ) : null}
            {resolvedMobileSection === "moderator" ? renderModeratorPanel() : null}
          </section>

          <section className={`${styles.layout} ${styles.desktopLayout}`}>
            <div className={styles.column}>
              {renderGamePanel()}
              {renderPlayersPanel()}
            </div>

            <div className={styles.column}>
              {renderRulesPanel()}
              {renderModeratorPanel()}
            </div>
          </section>
        </>
      ) : (
        <section className={styles.centerCard}>
          <span className={styles.kicker}>Party {partyCode}</span>
          <h1>Ucitavam stanje partije...</h1>
          <p>Ako je sesija istekla, vrati se sa istim nadimkom.</p>
          <button type="button" className={styles.linkBack} onClick={returnHome}>
            Nazad na pocetak
          </button>
        </section>
      )}
    </main>
  );
}
