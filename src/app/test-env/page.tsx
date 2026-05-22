"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { NightRole, Party, Role } from "@/lib/game";

const DEFAULT_NAMES = ["Marko", "Ana", "Luka", "Mina", "Ivan", "Sonja", "Nikola", "Tea"];

const ROLE_LABEL: Record<Role, string> = {
  citizen: "Građanin",
  doctor: "Lekar",
  police: "Policajac",
  mafia: "Mafija",
  lady: "Dama",
};

const ROLE_COLOR: Record<Role, string> = {
  citizen: "#9ca3af",
  doctor: "#34d399",
  police: "#60a5fa",
  mafia: "#f87171",
  lady: "#c084fc",
};

function getPreferredVoice() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang.toLowerCase().startsWith("sr")) ??
    voices.find((v) => v.lang.toLowerCase().startsWith("hr")) ??
    voices[0] ??
    null
  );
}

function speakText(text: string, voiceUri?: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.96;
  const voice = voiceUri
    ? (window.speechSynthesis.getVoices().find((v) => v.voiceURI === voiceUri) ?? getPreferredVoice())
    : getPreferredVoice();
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
  } else {
    utterance.lang = "sr-RS";
  }
  window.speechSynthesis.cancel();
  window.speechSynthesis.resume();
  window.speechSynthesis.speak(utterance);
}

function getTargets(party: Party, actorId: string, role: NightRole) {
  const alive = party.players.filter((p) => p.status === "alive");
  if (role === "doctor" || role === "lady") return alive;
  if (role === "mafia") return alive.filter((p) => p.role !== "mafia");
  return alive.filter((p) => p.id !== actorId); // police
}

const s = {
  page: {
    minHeight: "100vh",
    padding: "24px",
    fontFamily: "inherit",
    color: "var(--text-main)",
  } as React.CSSProperties,

  card: {
    background: "var(--panel)",
    border: "1px solid var(--panel-border)",
    borderRadius: "12px",
    padding: "20px",
    marginBottom: "16px",
  } as React.CSSProperties,

  row: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap" as const,
  } as React.CSSProperties,

  label: {
    fontSize: "11px",
    fontWeight: 600,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    color: "var(--text-muted)",
    marginBottom: "6px",
  } as React.CSSProperties,

  btn: (variant: "primary" | "danger" | "ghost" = "ghost") =>
    ({
      background:
        variant === "primary"
          ? "var(--accent)"
          : variant === "danger"
            ? "#7f1d1d"
            : "var(--panel-soft)",
      border: "1px solid var(--panel-border)",
      color: "var(--text-main)",
      borderRadius: "8px",
      padding: "8px 16px",
      fontSize: "13px",
      cursor: "pointer",
    }) as React.CSSProperties,

  input: {
    background: "var(--panel-soft)",
    border: "1px solid var(--panel-border)",
    borderRadius: "8px",
    color: "var(--text-main)",
    padding: "7px 12px",
    fontSize: "13px",
    width: "120px",
  } as React.CSSProperties,

  select: {
    background: "#1a0f15",
    border: "1px solid var(--panel-border)",
    borderRadius: "8px",
    color: "var(--text-main)",
    padding: "7px 12px",
    fontSize: "13px",
  } as React.CSSProperties,

  badge: (color: string) =>
    ({
      display: "inline-block",
      background: `${color}22`,
      border: `1px solid ${color}55`,
      color,
      borderRadius: "6px",
      padding: "2px 8px",
      fontSize: "12px",
      fontWeight: 600,
    }) as React.CSSProperties,

  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
    fontSize: "13px",
  } as React.CSSProperties,

  th: {
    textAlign: "left" as const,
    padding: "8px 12px",
    borderBottom: "1px solid var(--panel-border)",
    color: "var(--text-muted)",
    fontSize: "11px",
    letterSpacing: "0.06em",
    textTransform: "uppercase" as const,
  } as React.CSSProperties,

  td: {
    padding: "8px 12px",
    borderBottom: "1px solid rgba(255,255,255,0.04)",
  } as React.CSSProperties,

  h1: {
    fontFamily: "inherit",
    fontSize: "22px",
    fontWeight: 700,
    marginBottom: "20px",
    color: "var(--accent-strong)",
  } as React.CSSProperties,

  h2: {
    fontFamily: "inherit",
    fontSize: "14px",
    fontWeight: 700,
    marginBottom: "12px",
    color: "var(--text-muted)",
    letterSpacing: "0.05em",
    textTransform: "uppercase" as const,
  } as React.CSSProperties,

  prompt: {
    background: "rgba(244,141,82,0.08)",
    border: "1px solid rgba(244,141,82,0.24)",
    borderRadius: "10px",
    padding: "14px 18px",
    fontSize: "14px",
    lineHeight: 1.5,
    marginBottom: "16px",
    color: "var(--accent-strong)",
  } as React.CSSProperties,
};

export default function TestEnvPage() {
  const [count, setCount] = useState(6);
  const [names, setNames] = useState(DEFAULT_NAMES.slice(0, 6));
  const [code, setCode] = useState<string | null>(null);
  const [party, setParty] = useState<Party | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [targetId, setTargetId] = useState("");
  const [voteId, setVoteId] = useState("");
  const [mafiaCount, setMafiaCount] = useState(2);
  const [hasLady, setHasLady] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [voiceUri, setVoiceUri] = useState("");
  const [voices, setVoices] = useState<{ label: string; value: string }[]>([]);
  const [busy, setBusy] = useState(false);

  const codeRef = useRef(code);
  const partyRef = useRef(party);
  const busyRef = useRef(busy);
  const autoRef = useRef(autoPlay);
  const namesRef = useRef(names);
  const lastAutoKeyRef = useRef("");
  const lastSpokenKeyRef = useRef<string | null>(null);
  const voiceUriRef = useRef(voiceUri);
  codeRef.current = code;
  partyRef.current = party;
  busyRef.current = busy;
  autoRef.current = autoPlay;
  namesRef.current = names;
  voiceUriRef.current = voiceUri;

  const fetchParty = useCallback(async (partyCode: string) => {
    const res = await fetch(`/api/test-env/${partyCode}`);
    const data = (await res.json()) as { party?: Party; error?: string };
    if (!res.ok || data.error) throw new Error(data.error ?? "Failed");
    return data.party!;
  }, []);

  const poll = useCallback(async () => {
    const c = codeRef.current;
    if (!c) return;
    try {
      const p = await fetchParty(c);
      setParty(p);
    } catch {}
  }, [fetchParty]);

  useEffect(() => {
    if (!code) return;
    const delay = party?.phase === "night-transition" ? 300 : 1000;
    const id = setInterval(() => void poll(), delay);
    return () => clearInterval(id);
  }, [code, party?.phase, poll]);

  // Load available voices
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const sync = () => {
      const loaded = window.speechSynthesis.getVoices().map((v) => ({
        label: `${v.name} (${v.lang})`,
        value: v.voiceURI,
      }));
      setVoices(loaded);
      if (!voiceUriRef.current) {
        const preferred = getPreferredVoice();
        if (preferred) setVoiceUri(preferred.voiceURI);
      }
    };
    sync();
    window.speechSynthesis.addEventListener("voiceschanged", sync);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", sync);
  }, []);

  // Auto-speak when prompt changes
  useEffect(() => {
    if (!ttsEnabled || !party?.promptText || !party.promptKey) return;
    if (lastSpokenKeyRef.current === party.promptKey) return;
    if (party.promptKey.includes("police-result")) {
      lastSpokenKeyRef.current = party.promptKey;
      return;
    }
    lastSpokenKeyRef.current = party.promptKey;
    speakText(party.promptText, voiceUriRef.current);
  }, [ttsEnabled, party?.promptKey, party?.promptText]);

  // auto-play runner
  const runAutoPlay = useCallback(async () => {
    if (!autoRef.current || busyRef.current) return;
    const p = partyRef.current;
    if (!p) return;

    const key = `${p.round}:${p.phase}:${p.stepIndex}:${p.currentRole}`;
    if (lastAutoKeyRef.current === key) return;

    if (p.phase === "night-role" && p.currentRole) {
      const role = p.currentRole;
      if (p.actions[role]?.targetId) return;
      const actor = p.players.find((pl) => pl.status === "alive" && pl.role === role);
      if (!actor) return;
      const targets = getTargets(p, actor.id, role);
      if (!targets.length) return;
      const pick = targets[Math.floor(Math.random() * targets.length)];
      lastAutoKeyRef.current = key;
      setBusy(true);
      try {
        await fetch(`/api/party/${p.code}/action`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nickname: actor.nickname, targetId: pick.id }),
        });
        await poll();
      } finally {
        setBusy(false);
      }
    } else if (p.phase === "day-summary") {
      const host = p.players.find((pl) => pl.isHost)?.nickname ?? namesRef.current[0];
      lastAutoKeyRef.current = key;
      setBusy(true);
      try {
        await fetch(`/api/party/${p.code}/day`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nickname: host, votedOutPlayerId: null }),
        });
        await poll();
      } finally {
        setBusy(false);
      }
    }
  }, [poll]);

  useEffect(() => {
    if (autoPlay && !busy) void runAutoPlay();
  }, [party?.phase, party?.stepIndex, party?.round, party?.currentRole, autoPlay, busy, runAutoPlay]);

  async function apiPost(url: string, body: unknown) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { error?: string };
    if (data.error) throw new Error(data.error);
  }

  async function createAndStart() {
    setBusy(true);
    setErr(null);
    try {
      const [host, ...rest] = names.slice(0, count);

      const createRes = await fetch("/api/party/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: host, mafiaCount, hasLady, hasDoctor: true, hasPolice: true }),
      });
      const createData = (await createRes.json()) as { code?: string; error?: string };
      if (createData.error || !createData.code) throw new Error(createData.error ?? "Create failed");
      const newCode = createData.code;

      for (const name of rest) {
        await apiPost("/api/party/join", { code: newCode, nickname: name });
      }
      await apiPost(`/api/party/${newCode}/start`, { nickname: host });
      await apiPost(`/api/party/${newCode}/advance`, { nickname: host });

      const p = await fetchParty(newCode);
      setCode(newCode);
      setParty(p);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleStop() {
    if (!party) return;
    const host = party.players.find((p) => p.isHost)?.nickname ?? names[0];
    setBusy(true);
    try {
      await apiPost(`/api/party/${party.code}/stop`, { nickname: host });
    } catch {}
    setCode(null);
    setParty(null);
    setBusy(false);
  }

  async function submitAction() {
    if (!party || !party.currentRole || !targetId || busy) return;
    const role = party.currentRole;
    const actor = party.players.find((p) => p.status === "alive" && p.role === role);
    if (!actor) return;
    setBusy(true);
    try {
      await apiPost(`/api/party/${party.code}/action`, {
        nickname: actor.nickname,
        targetId,
      });
      setTargetId("");
      await poll();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  async function resolveDay(playerId: string | null) {
    if (!party || busy) return;
    const host = party.players.find((p) => p.isHost)?.nickname ?? names[0];
    setBusy(true);
    try {
      await apiPost(`/api/party/${party.code}/day`, {
        nickname: host,
        votedOutPlayerId: playerId,
      });
      setVoteId("");
      await poll();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Day resolve failed");
    } finally {
      setBusy(false);
    }
  }

  // ---- Setup Screen ----
  if (!code) {
    return (
      <main style={{ maxWidth: 640, margin: "0 auto", padding: "40px 24px" }}>
        <div style={s.h1}>Test Environment</div>

        <div style={s.card}>
          <div style={s.h2}>Konfiguracija igre</div>

          <div style={{ marginBottom: 20 }}>
            <div style={s.label}>Broj igrača</div>
            <div style={s.row}>
              {[5, 6, 7, 8].map((n) => (
                <button
                  key={n}
                  style={{
                    ...s.btn(count === n ? "primary" : "ghost"),
                    padding: "8px 20px",
                  }}
                  onClick={() => {
                    setCount(n);
                    setNames(DEFAULT_NAMES.slice(0, n));
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={s.label}>Broj mafije</div>
            <div style={s.row}>
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  style={{ ...s.btn(mafiaCount === n ? "primary" : "ghost"), padding: "8px 20px" }}
                  onClick={() => setMafiaCount(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={s.label}>Specijalne uloge</div>
            <label style={{ ...s.row, gap: 8, cursor: "pointer", fontSize: 13 }}>
              <input
                type="checkbox"
                checked={hasLady}
                onChange={(e) => setHasLady(e.target.checked)}
              />
              Dama
            </label>
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={s.label}>Igrači</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              {names.map((name, i) => (
                <div key={i} style={s.row}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", width: 20 }}>
                    {i === 0 ? "H" : i + 1}
                  </span>
                  <input
                    style={{ ...s.input, width: "100%" }}
                    value={name}
                    onChange={(e) => {
                      const updated = [...names];
                      updated[i] = e.target.value;
                      setNames(updated);
                    }}
                  />
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
              H = host
            </div>
          </div>

          {err && (
            <div style={{ color: "var(--danger)", marginBottom: 12, fontSize: 13 }}>
              {err}
            </div>
          )}

          <button
            style={{ ...s.btn("primary"), padding: "10px 28px", fontSize: 14 }}
            onClick={() => void createAndStart()}
            disabled={busy}
          >
            {busy ? "Pokrećem..." : "Kreiraj i pokreni igru →"}
          </button>
        </div>
      </main>
    );
  }

  if (!party) {
    return (
      <main style={s.page}>
        <div style={{ color: "var(--text-muted)" }}>Učitavam...</div>
      </main>
    );
  }

  // ---- Active Game Screen ----
  const host = party.players.find((p) => p.isHost);
  const hostName = host?.nickname ?? names[0];
  const currentRoleActor =
    party.currentRole
      ? party.players.find((p) => p.status === "alive" && p.role === party.currentRole)
      : null;
  const availableTargets = currentRoleActor && party.currentRole
    ? getTargets(party, currentRoleActor.id, party.currentRole)
    : [];
  const aliveVoteCandidates = party.players.filter((p) => p.status === "alive");

  return (
    <main style={{ ...s.page, maxWidth: 900, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ ...s.row, justifyContent: "space-between", marginBottom: 16 }}>
        <div style={s.h1}>Test Environment</div>
        <div style={s.row}>
          <label style={{ ...s.row, gap: 8, cursor: "pointer", fontSize: 13 }}>
            <input
              type="checkbox"
              checked={ttsEnabled}
              onChange={(e) => {
                setTtsEnabled(e.target.checked);
                if (!e.target.checked) window.speechSynthesis?.cancel();
                else if (party?.promptText) {
                  lastSpokenKeyRef.current = party.promptKey ?? null;
                  speakText(party.promptText, voiceUri);
                }
              }}
            />
            TTS
          </label>
          {ttsEnabled && (
            <>
              <select
                style={{ ...s.select, fontSize: 12, padding: "4px 8px" }}
                value={voiceUri}
                onChange={(e) => setVoiceUri(e.target.value)}
              >
                {voices.length === 0 ? (
                  <option value="">Default</option>
                ) : (
                  voices.map((v) => (
                    <option key={v.value} value={v.value}>{v.label}</option>
                  ))
                )}
              </select>
              <button
                style={{ ...s.btn("ghost"), padding: "5px 12px", fontSize: 12 }}
                onClick={() => party?.promptText && speakText(party.promptText, voiceUri)}
              >
                ▶ ponovi
              </button>
            </>
          )}
          <label style={{ ...s.row, gap: 8, cursor: "pointer", fontSize: 13 }}>
            <input
              type="checkbox"
              checked={autoPlay}
              onChange={(e) => setAutoPlay(e.target.checked)}
            />
            Auto-play
          </label>
          <button
            style={s.btn("danger")}
            onClick={() => void handleStop()}
            disabled={busy}
          >
            Reset
          </button>
        </div>
      </div>

      {/* Status bar */}
      <div style={{ ...s.card, padding: "12px 20px" }}>
        <div style={s.row}>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Kod:</span>
          <strong style={{ fontFamily: "monospace", letterSpacing: "0.15em" }}>{party.code}</strong>
          <span
            style={{
              background: "rgba(244,141,82,0.15)",
              border: "1px solid rgba(244,141,82,0.3)",
              borderRadius: 6,
              padding: "2px 10px",
              fontSize: 12,
              fontWeight: 600,
              color: "var(--accent-strong)",
            }}
          >
            {party.phase}
          </span>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Runda {party.round}
          </span>
          {party.phase === "night-transition" && (
            <span style={{ fontSize: 12, color: "var(--warn)" }}>
              ⏳ prelaz...
            </span>
          )}
          {busy && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>...</span>}
        </div>
      </div>

      {/* Prompt */}
      {party.promptText && (
        <div style={s.prompt}>{party.promptText}</div>
      )}

      {/* Error */}
      {err && (
        <div
          style={{
            background: "#7f1d1d44",
            border: "1px solid var(--danger)",
            borderRadius: 8,
            padding: "10px 16px",
            fontSize: 13,
            color: "var(--danger)",
            marginBottom: 16,
          }}
        >
          {err}
          <button
            style={{ marginLeft: 12, background: "none", border: "none", color: "inherit", cursor: "pointer" }}
            onClick={() => setErr(null)}
          >
            ✕
          </button>
        </div>
      )}

      {/* Action Panel */}
      <div style={s.card}>
        <div style={s.h2}>Akcije</div>

        {/* night-role */}
        {party.phase === "night-role" && party.currentRole && (
          <div>
            <div style={{ marginBottom: 12 }}>
              <span style={s.badge(ROLE_COLOR[party.currentRole as Role] ?? "#9ca3af")}>
                {ROLE_LABEL[party.currentRole as Role] ?? party.currentRole}
              </span>{" "}
              <span style={{ fontSize: 13 }}>
                {currentRoleActor
                  ? `→ ${currentRoleActor.nickname} bira metu`
                  : "nema živih sa ovom ulogom"}
              </span>
              {party.actions[party.currentRole]?.targetId && (
                <span style={{ marginLeft: 12, color: "var(--ok)", fontSize: 13 }}>
                  ✓ akcija poslata
                </span>
              )}
            </div>
            {!party.actions[party.currentRole]?.targetId && currentRoleActor && (
              <div style={s.row}>
                <select
                  style={s.select}
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                >
                  <option value="">-- izaberi metu --</option>
                  {availableTargets.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nickname}
                    </option>
                  ))}
                </select>
                <button
                  style={s.btn("primary")}
                  onClick={() => void submitAction()}
                  disabled={busy || !targetId}
                >
                  Potvrdi
                </button>
              </div>
            )}
          </div>
        )}

        {/* day-summary */}
        {party.phase === "day-summary" && (
          <div>
            <div style={{ marginBottom: 12, fontSize: 13, color: "var(--text-muted)" }}>
              Host ({hostName}) zaključuje dan.
            </div>
            <div style={s.row}>
              <select
                style={s.select}
                value={voteId}
                onChange={(e) => setVoteId(e.target.value)}
              >
                <option value="">-- glasaj za eliminaciju --</option>
                {aliveVoteCandidates.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nickname}
                  </option>
                ))}
              </select>
              <button
                style={s.btn("danger")}
                onClick={() => void resolveDay(voteId || null)}
                disabled={busy || !voteId}
              >
                Izbaci igrača
              </button>
              <button
                style={s.btn("ghost")}
                onClick={() => void resolveDay(null)}
                disabled={busy}
              >
                Bez eliminacije → noć
              </button>
            </div>
          </div>
        )}

        {/* handoff */}
        {party.phase === "handoff" && (
          <div>
            <div style={{ marginBottom: 12, fontSize: 13 }}>
              Moderator izabran. Igra se nastavlja ručno.
            </div>
            <button
              style={s.btn("ghost")}
              onClick={() => void handleStop()}
              disabled={busy}
            >
              Završi partiju → nova igra
            </button>
          </div>
        )}

        {/* night-transition */}
        {party.phase === "night-transition" && (
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Čekam prelaz... (automatski se nastavlja)
          </div>
        )}

        {/* role-reveal */}
        {party.phase === "role-reveal" && (
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Uloge dodeljene. (Host je već pokrenuo prvu noć)
          </div>
        )}

        {/* lobby */}
        {party.phase === "lobby" && (
          <div style={s.row}>
            <button
              style={s.btn("primary")}
              onClick={() => void (async () => {
                setBusy(true);
                try {
                  await apiPost(`/api/party/${party.code}/start`, { nickname: hostName });
                  await apiPost(`/api/party/${party.code}/advance`, { nickname: hostName });
                  await poll();
                } catch (e) {
                  setErr(e instanceof Error ? e.message : "Start failed");
                } finally {
                  setBusy(false);
                }
              })()}
              disabled={busy}
            >
              Pokreni igru
            </button>
          </div>
        )}
      </div>

      {/* Players Table */}
      <div style={s.card}>
        <div style={s.h2}>Igrači</div>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Igrač</th>
              <th style={s.th}>Uloga</th>
              <th style={s.th}>Status</th>
              <th style={s.th}>Noćna akcija</th>
            </tr>
          </thead>
          <tbody>
            {party.players.map((p) => {
              const isActor = party.currentRole && p.role === party.currentRole && p.status === "alive";
              const nightAction = p.role && p.role !== "citizen"
                ? party.actions[p.role as NightRole]
                : null;
              const actedTarget = nightAction?.actorId === p.id
                ? party.players.find((t) => t.id === nightAction.targetId)
                : null;
              // for mafia any member counts
              const mafiaActed =
                p.role === "mafia" &&
                party.currentRole === "mafia" &&
                party.actions.mafia?.targetId;

              return (
                <tr
                  key={p.id}
                  style={{
                    opacity: p.status !== "alive" ? 0.45 : 1,
                    background: isActor ? "rgba(244,141,82,0.06)" : undefined,
                  }}
                >
                  <td style={s.td}>
                    <div style={s.row}>
                      {p.isHost && (
                        <span style={{ fontSize: 10, color: "var(--warn)", fontWeight: 700 }}>
                          HOST
                        </span>
                      )}
                      {party.moderatorId === p.id && (
                        <span style={{ fontSize: 10, color: "var(--ok)", fontWeight: 700 }}>
                          MOD
                        </span>
                      )}
                      <span>{p.nickname}</span>
                      {isActor && (
                        <span style={{ fontSize: 11, color: "var(--accent-strong)" }}>▶</span>
                      )}
                    </div>
                  </td>
                  <td style={s.td}>
                    {p.role ? (
                      <span style={s.badge(ROLE_COLOR[p.role])}>
                        {ROLE_LABEL[p.role]}
                      </span>
                    ) : (
                      <span style={{ color: "var(--text-muted)", fontSize: 12 }}>—</span>
                    )}
                  </td>
                  <td style={s.td}>
                    <span
                      style={{
                        fontSize: 12,
                        color:
                          p.status === "alive"
                            ? "var(--ok)"
                            : p.status === "dead"
                              ? "var(--danger)"
                              : "var(--warn)",
                      }}
                    >
                      {p.status === "alive" ? "živ" : p.status === "dead" ? "mrtav" : "izglasan"}
                    </span>
                  </td>
                  <td style={s.td}>
                    {actedTarget ? (
                      <span style={{ fontSize: 12 }}>→ {actedTarget.nickname}</span>
                    ) : mafiaActed ? (
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        → {party.players.find((t) => t.id === party.actions.mafia?.targetId)?.nickname}
                      </span>
                    ) : (
                      <span style={{ color: "var(--text-muted)", fontSize: 12 }}>—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Night History */}
      {party.history.length > 0 && (
        <div style={s.card}>
          <div style={s.h2}>Istorija noći</div>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Runda</th>
                <th style={s.th}>Ubijen</th>
                <th style={s.th}>Ućutkan</th>
                <th style={s.th}>Proveravan</th>
              </tr>
            </thead>
            <tbody>
              {party.history.map((h) => {
                const victim = party.players.find((p) => p.id === h.victimId);
                const silenced = party.players.find((p) => p.id === h.silencedId);
                const inspected = party.players.find((p) => p.id === h.inspectedPlayerId);
                return (
                  <tr key={h.round}>
                    <td style={s.td}>{h.round}</td>
                    <td style={s.td}>
                      {victim ? (
                        <span style={{ color: "var(--danger)" }}>{victim.nickname}</span>
                      ) : (
                        <span style={{ color: "var(--text-muted)" }}>niko</span>
                      )}
                    </td>
                    <td style={s.td}>
                      {silenced ? (
                        <span style={{ color: "var(--warn)" }}>{silenced.nickname}</span>
                      ) : (
                        <span style={{ color: "var(--text-muted)" }}>—</span>
                      )}
                    </td>
                    <td style={s.td}>
                      {inspected ? (
                        <span>
                          {inspected.nickname}{" "}
                          <span
                            style={{
                              fontSize: 11,
                              color: h.inspectedIsMafia ? "var(--danger)" : "var(--ok)",
                            }}
                          >
                            ({h.inspectedIsMafia ? "mafija" : "nije mafija"})
                          </span>
                        </span>
                      ) : (
                        <span style={{ color: "var(--text-muted)" }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
