export type Role = "citizen" | "doctor" | "police" | "mafia" | "lady";

export type NightRole = Extract<Role, "doctor" | "police" | "mafia" | "lady">;

export type PlayerStatus = "alive" | "dead" | "voted-out";

export type PartyPhase =
  | "lobby"
  | "role-reveal"
  | "night-role"
  | "night-transition"
  | "day-summary"
  | "handoff";

export interface PartyConfigInput {
  mafiaCount: number;
  hasDoctor: boolean;
  hasPolice: boolean;
  hasLady: boolean;
}

export interface PartyConfig extends PartyConfigInput {
  totalPlayers: number;
  citizenCount: number;
}

export interface Player {
  id: string;
  nickname: string;
  role: Role | null;
  status: PlayerStatus;
  isHost: boolean;
  joinedAt: number;
  lastSeenAt: number;
}

export interface NightAction {
  actorId: string | null;
  targetId: string | null;
  submittedAt: number | null;
}

export interface NightSummary {
  round: number;
  victimId: string | null;
  silencedId: string | null;
  inspectedPlayerId: string | null;
  inspectedIsMafia: boolean | null;
  createdAt: number;
}

interface TransitionQueueItem {
  text: string;
  keyId: string;
  role: NightRole | null;
  delayMs: number;
}

interface TransitionCompletion {
  type: "begin-step" | "resolve-night";
  stepIndex?: number;
}

export interface Party {
  code: string;
  config: PartyConfig;
  createdAt: number;
  updatedAt: number;
  phase: PartyPhase;
  round: number;
  hostId: string;
  moderatorId: string | null;
  players: Player[];
  nightOrder: NightRole[];
  stepIndex: number;
  currentRole: NightRole | null;
  transitionToStepIndex: number | null;
  transitionEndsAt: number | null;
  transitionQueue: TransitionQueueItem[];
  transitionCompletion: TransitionCompletion | null;
  promptText: string | null;
  promptKey: string | null;
  actions: Partial<Record<NightRole, NightAction>>;
  latestSummary: NightSummary | null;
  history: NightSummary[];
}

export interface SnapshotPlayer {
  id: string;
  nickname: string;
  status: PlayerStatus;
  isHost: boolean;
  isConnected: boolean;
  role?: Role | null;
}

export interface PartySnapshot {
  code: string;
  phase: PartyPhase;
  round: number;
  promptText: string | null;
  promptKey: string | null;
  config: PartyConfig;
  requester: {
    id: string;
    nickname: string;
    role: Role | null;
    status: PlayerStatus;
    isHost: boolean;
    isModerator: boolean;
    isAlive: boolean;
  };
  players: SnapshotPlayer[];
  lobby: {
    joinedCount: number;
    totalPlayers: number;
    canStart: boolean;
  };
  daySummary: {
    round: number;
    victimName: string | null;
    silencedName: string | null;
  } | null;
  availableTargets: Array<{ id: string; nickname: string }>;
  actionState: {
    canAct: boolean;
    hasSubmitted: boolean;
    submittedTargetName: string | null;
    note: string | null;
  };
  hostControls: {
    canUpdateConfig: boolean;
    canStart: boolean;
    canAdvanceRoleReveal: boolean;
    canResolveDay: boolean;
    canStop: boolean;
    voteCandidates: Array<{ id: string; nickname: string }>;
  };
  moderatorView: {
    players: Array<{
      id: string;
      nickname: string;
      role: Role | null;
      status: PlayerStatus;
      isHost: boolean;
    }>;
    history: Array<{
      round: number;
      victimName: string | null;
      silencedName: string | null;
    }>;
  } | null;
}

const TURN_ORDER: NightRole[] = ["lady", "mafia", "doctor", "police"];
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const PRESENCE_WINDOW_MS = 15_000;
const NIGHT_PROMPT_DELAY_MS = 5_000;

export const DEFAULT_PARTY_CONFIG_INPUT: PartyConfigInput = {
  mafiaCount: 2,
  hasDoctor: true,
  hasPolice: true,
  hasLady: false,
};

export const ROLE_LABELS: Record<Role, string> = {
  citizen: "Građanin",
  doctor: "Lekar",
  police: "Policajac",
  mafia: "Mafija",
  lady: "Dama",
};

const ROLE_WAKE_TEXT: Record<NightRole, string> = {
  lady: "Dama se budi.",
  mafia: "Mafija se budi.",
  doctor: "Lekar se budi.",
  police: "Policajac se budi.",
};

const ROLE_SLEEP_TEXT: Record<NightRole, string> = {
  lady: "Dama spava.",
  mafia: "Mafija spava.",
  doctor: "Lekar spava.",
  police: "Policajac spava.",
};

function now() {
  return Date.now();
}

function randomId() {
  return `${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

function normalizeNickname(rawNickname: string) {
  return rawNickname.trim().replace(/\s+/g, " ").slice(0, 24);
}

function normalizeCode(rawCode: string) {
  return rawCode.trim().toUpperCase();
}

function shuffle<T>(items: T[]) {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
}

function buildRolePool(config: PartyConfig) {
  return shuffle<Role>([
    ...Array.from({ length: config.mafiaCount }, () => "mafia" as const),
    ...(config.hasDoctor ? (["doctor"] as const) : []),
    ...(config.hasPolice ? (["police"] as const) : []),
    ...(config.hasLady ? (["lady"] as const) : []),
    ...Array.from({ length: config.citizenCount }, () => "citizen" as const),
  ]);
}

function buildNightOrder(config: PartyConfig) {
  return TURN_ORDER.filter((role) => {
    if (role === "lady") {
      return config.hasLady;
    }

    if (role === "doctor") {
      return config.hasDoctor;
    }

    if (role === "police") {
      return config.hasPolice;
    }

    return config.mafiaCount > 0;
  });
}

function getRoleText(role: NightRole, sleeping: boolean) {
  return sleeping ? ROLE_SLEEP_TEXT[role] : ROLE_WAKE_TEXT[role];
}

function buildLobbyPrompt(party: Party) {
  return `Partija je kreirana. Trenutno je povezano ${party.players.length} igrača.`;
}

function buildConfigForTotalPlayers(input: PartyConfigInput, totalPlayers: number) {
  const mafiaCount = Number(input.mafiaCount);
  const hasDoctor = Boolean(input.hasDoctor);
  const hasPolice = Boolean(input.hasPolice);
  const hasLady = Boolean(input.hasLady);
  const specialCount =
    mafiaCount + Number(hasDoctor) + Number(hasPolice) + Number(hasLady);

  return {
    totalPlayers,
    mafiaCount,
    hasDoctor,
    hasPolice,
    hasLady,
    citizenCount: totalPlayers - specialCount,
  };
}

function getEffectiveConfig(party: Party) {
  if (party.phase !== "lobby") {
    return party.config;
  }

  return buildConfigForTotalPlayers(party.config, party.players.length);
}

function findPlayerByNickname(party: Party, nickname: string) {
  const normalizedNickname = normalizeNickname(nickname).toLowerCase();

  return party.players.find(
    (player) => player.nickname.toLowerCase() === normalizedNickname,
  );
}

function findPlayerById(party: Party, playerId: string | null) {
  if (!playerId) {
    return null;
  }

  return party.players.find((player) => player.id === playerId) ?? null;
}

function assertRequesterPlayer(party: Party, nickname: string) {
  const player = findPlayerByNickname(party, nickname);

  if (!player) {
    throw new Error("Igrac nije pronadjen u ovoj partiji.");
  }

  return player;
}

function assertHost(party: Party, nickname: string) {
  const player = assertRequesterPlayer(party, nickname);

  if (!player.isHost) {
    throw new Error("Samo host moze da izvrsi ovu akciju.");
  }

  return player;
}

function assertTarget(party: Party, targetId: string) {
  const target = findPlayerById(party, targetId);

  if (!target) {
    throw new Error("Izabrani igrac ne postoji.");
  }

  return target;
}

function partyTouched(party: Party) {
  party.updatedAt = now();
}

function getConnected(player: Player) {
  return now() - player.lastSeenAt <= PRESENCE_WINDOW_MS;
}

function promptKey(round: number, id: string) {
  return `round-${round}-${id}`;
}

function setPrompt(
  party: Party,
  text: string | null,
  keyId: string | null,
  role: NightRole | null,
) {
  party.promptText = text;
  party.promptKey = keyId ? promptKey(party.round, keyId) : null;
  party.currentRole = role;
  partyTouched(party);
}

function startTransitionSequence(
  party: Party,
  items: TransitionQueueItem[],
  completion: TransitionCompletion,
) {
  if (items.length === 0) {
    if (completion.type === "begin-step") {
      beginNightStep(party, completion.stepIndex ?? 0);
      return;
    }

    resolveNight(party);
    return;
  }

  const [currentItem, ...remainingItems] = items;
  party.phase = "night-transition";
  party.transitionQueue = remainingItems;
  party.transitionCompletion = completion;
  party.transitionToStepIndex =
    completion.type === "begin-step" ? (completion.stepIndex ?? null) : null;
  party.transitionEndsAt = now() + currentItem.delayMs;
  setPrompt(party, currentItem.text, currentItem.keyId, currentItem.role);
}

function advanceTransitionSequence(party: Party) {
  if (party.transitionQueue.length > 0) {
    const [currentItem, ...remainingItems] = party.transitionQueue;
    party.transitionQueue = remainingItems;
    party.transitionEndsAt = now() + currentItem.delayMs;
    setPrompt(party, currentItem.text, currentItem.keyId, currentItem.role);
    return;
  }

  const completion = party.transitionCompletion;
  party.transitionCompletion = null;

  if (completion?.type === "begin-step") {
    beginNightStep(party, completion.stepIndex ?? 0);
    return;
  }

  resolveNight(party);
}

function queueSleepTransition(party: Party, role: NightRole, nextStepIndex: number) {
  startTransitionSequence(
    party,
    [
      {
        text: getRoleText(role, true),
        keyId: `${role}-sleep-${nextStepIndex}`,
        role,
        delayMs: NIGHT_PROMPT_DELAY_MS,
      },
    ],
    { type: "begin-step", stepIndex: nextStepIndex },
  );
}

function startNightRound(party: Party) {
  startTransitionSequence(
    party,
    [
      {
        text: "Grad spava.",
        keyId: `city-sleep-${party.round}`,
        role: null,
        delayMs: NIGHT_PROMPT_DELAY_MS,
      },
    ],
    { type: "begin-step", stepIndex: 0 },
  );
}

function beginNightStep(party: Party, stepIndex: number) {
  if (stepIndex >= party.nightOrder.length) {
    resolveNight(party);
    return;
  }

  const role = party.nightOrder[stepIndex];
  party.phase = "night-role";
  party.stepIndex = stepIndex;
  party.transitionEndsAt = null;
  party.transitionToStepIndex = null;
  setPrompt(party, getRoleText(role, false), `${role}-wake-${stepIndex}`, role);

  if (getEligibleActors(party, role).length === 0) {
    queueSleepTransition(party, role, stepIndex + 1);
  }
}

function resetRoundState(party: Party) {
  party.actions = {};
  party.latestSummary = null;
  party.nightOrder = buildNightOrder(party.config);
  party.stepIndex = 0;
  party.currentRole = null;
  party.transitionToStepIndex = null;
  party.transitionEndsAt = null;
  party.transitionQueue = [];
  party.transitionCompletion = null;
}

function resetPartyForLobby(party: Party, promptText?: string) {
  party.phase = "lobby";
  party.round = 0;
  party.moderatorId = null;
  party.nightOrder = [];
  party.stepIndex = 0;
  party.currentRole = null;
  party.transitionToStepIndex = null;
  party.transitionEndsAt = null;
  party.transitionQueue = [];
  party.transitionCompletion = null;
  party.promptText = promptText ?? buildLobbyPrompt(party);
  party.promptKey = promptKey(0, "lobby");
  party.actions = {};
  party.latestSummary = null;
  party.history = [];

  party.players.forEach((player) => {
    player.role = null;
    player.status = "alive";
  });

  partyTouched(party);
}

function getEligibleActors(party: Party, role: NightRole) {
  return party.players.filter(
    (player) => player.status === "alive" && player.role === role,
  );
}

function getAlivePlayers(party: Party) {
  return party.players.filter((player) => player.status === "alive");
}

function getTargetOptions(party: Party, player: Player, role: NightRole) {
  const alivePlayers = getAlivePlayers(party);

  if (role === "doctor") {
    return alivePlayers;
  }

  if (role === "mafia") {
    return alivePlayers.filter((candidate) => candidate.role !== "mafia");
  }

  return alivePlayers.filter((candidate) => candidate.id !== player.id);
}

function getPoliceNote(party: Party, requester: Player) {
  const policeAction = party.actions.police;

  if (
    requester.role !== "police" ||
    requester.status !== "alive" ||
    !policeAction?.targetId ||
    policeAction.actorId !== requester.id
  ) {
    return null;
  }

  const inspectedPlayer = findPlayerById(party, policeAction.targetId);

  if (!inspectedPlayer) {
    return null;
  }

  return inspectedPlayer.role === "mafia"
    ? `${inspectedPlayer.nickname} jeste mafija.`
    : `${inspectedPlayer.nickname} nije mafija.`;
}

function buildSummaryPrompt(summary: NightSummary, party: Party) {
  const victim = findPlayerById(party, summary.victimId);
  const silenced = findPlayerById(party, summary.silencedId);

  const parts = [
    "Svanuo je dan.",
    victim
      ? `Tokom noći je ubijen ${victim.nickname}.`
      : "Tokom noći niko nije ubijen.",
  ];

  if (silenced) {
    parts.push(`${silenced.nickname} je ućutkan za današnji dan.`);
  }

  return parts.join(" ");
}

function buildAutoModeratorPrompt(summary: NightSummary, party: Party, moderator: Player) {
  const silenced = findPlayerById(party, summary.silencedId);
  const parts = [
    `${moderator.nickname} je ubijen tokom noći i odmah postaje moderator.`,
  ];

  if (silenced) {
    parts.push(`${silenced.nickname} je ućutkan za današnji dan.`);
  }

  return parts.join(" ");
}

function resolveNight(party: Party) {
  const mafiaTargetId = party.actions.mafia?.targetId ?? null;
  const doctorSaveId = party.actions.doctor?.targetId ?? null;
  const silencedId = party.actions.lady?.targetId ?? null;
  const inspectedPlayerId = party.actions.police?.targetId ?? null;
  const inspectedPlayer = findPlayerById(party, inspectedPlayerId);

  const victimId =
    mafiaTargetId && mafiaTargetId !== doctorSaveId ? mafiaTargetId : null;
  const victim = findPlayerById(party, victimId);

  if (victim && victim.status === "alive") {
    victim.status = "dead";
  }

  const effectiveSilencedId =
    silencedId && silencedId !== victimId ? silencedId : null;

  const summary: NightSummary = {
    round: party.round,
    victimId,
    silencedId: effectiveSilencedId,
    inspectedPlayerId,
    inspectedIsMafia: inspectedPlayer ? inspectedPlayer.role === "mafia" : null,
    createdAt: now(),
  };

  party.latestSummary = summary;
  party.history.push(summary);
  party.transitionEndsAt = null;
  party.transitionToStepIndex = null;
  party.transitionQueue = [];
  party.transitionCompletion = null;

  if (victim && !party.moderatorId) {
    party.moderatorId = victim.id;
    party.phase = "handoff";
    setPrompt(
      party,
      buildAutoModeratorPrompt(summary, party, victim),
      `handoff-${victim.id}`,
      null,
    );
    return;
  }

  party.phase = "day-summary";
  setPrompt(party, buildSummaryPrompt(summary, party), "day-summary", null);
}

export function ensurePartyProgress(party: Party) {
  if (
    party.phase === "night-transition" &&
    party.transitionEndsAt &&
    now() >= party.transitionEndsAt
  ) {
    advanceTransitionSequence(party);
  }
}

export function validateConfig(
  input: PartyConfigInput,
  totalPlayers: number,
  options?: { requireMinimumPlayers?: boolean },
) {
  const config = buildConfigForTotalPlayers(input, Number(totalPlayers));

  if (!Number.isInteger(config.totalPlayers) || config.totalPlayers < 1 || config.totalPlayers > 20) {
    throw new Error("Broj igraca mora biti izmedju 1 i 20.");
  }

  if (!Number.isInteger(config.mafiaCount) || config.mafiaCount < 1 || config.mafiaCount > 5) {
    throw new Error("Broj mafijasa mora biti izmedju 1 i 5.");
  }

  if (options?.requireMinimumPlayers && config.totalPlayers < 5) {
    throw new Error("Za pokretanje partije potrebno je najmanje 5 igraca.");
  }

  if (config.citizenCount < 1) {
    throw new Error("Mora ostati makar jedan gradjanin.");
  }

  return config;
}

export function generateCode(existingCodes: Set<string>) {
  let generatedCode = "";

  do {
    generatedCode = Array.from({ length: 5 }, () => {
      const index = Math.floor(Math.random() * CODE_ALPHABET.length);
      return CODE_ALPHABET[index];
    }).join("");
  } while (existingCodes.has(generatedCode));

  return generatedCode;
}

export function createParty(
  existingCodes: Set<string>,
  nickname: string,
  configInput: PartyConfigInput = DEFAULT_PARTY_CONFIG_INPUT,
) {
  const normalizedNickname = normalizeNickname(nickname);

  if (normalizedNickname.length < 2) {
    throw new Error("Nadimak mora imati bar 2 karaktera.");
  }

  const createdAt = now();
  const host: Player = {
    id: randomId(),
    nickname: normalizedNickname,
    role: null,
    status: "alive",
    isHost: true,
    joinedAt: createdAt,
    lastSeenAt: createdAt,
  };

  const party: Party = {
    code: generateCode(existingCodes),
    config: validateConfig(configInput, 10),
    createdAt,
    updatedAt: createdAt,
    phase: "lobby",
    round: 0,
    hostId: host.id,
    moderatorId: null,
    players: [host],
    nightOrder: [],
    stepIndex: 0,
    currentRole: null,
    transitionToStepIndex: null,
    transitionEndsAt: null,
    transitionQueue: [],
    transitionCompletion: null,
    promptText: "Partija je kreirana. Host sada čeka igrače i podešava uloge.",
    promptKey: "lobby-created",
    actions: {},
    latestSummary: null,
    history: [],
  };

  return party;
}

export function joinParty(party: Party, nickname: string) {
  ensurePartyProgress(party);

  const normalizedNickname = normalizeNickname(nickname);

  if (normalizedNickname.length < 2) {
    throw new Error("Nadimak mora imati bar 2 karaktera.");
  }

  const existingPlayer = findPlayerByNickname(party, normalizedNickname);

  if (existingPlayer) {
    existingPlayer.lastSeenAt = now();
    partyTouched(party);
    return existingPlayer;
  }

  if (party.phase !== "lobby") {
    throw new Error(
      "Partija je vec pocela. Reconnect je moguc samo sa vec postojecim nadimkom.",
    );
  }

  if (party.players.length >= 20) {
    throw new Error("Dostignut je maksimalan broj igraca.");
  }

  const player: Player = {
    id: randomId(),
    nickname: normalizedNickname,
    role: null,
    status: "alive",
    isHost: false,
    joinedAt: now(),
    lastSeenAt: now(),
  };

  party.players.push(player);
  party.promptText = buildLobbyPrompt(party);
  party.promptKey = promptKey(0, "lobby-join");
  partyTouched(party);
  return player;
}

export function touchPlayer(party: Party, nickname: string) {
  ensurePartyProgress(party);
  const requester = assertRequesterPlayer(party, nickname);
  requester.lastSeenAt = now();
  partyTouched(party);
  return requester;
}

export function startGame(party: Party, nickname: string) {
  assertHost(party, nickname);

  if (party.phase !== "lobby") {
    throw new Error("Partija je vec pokrenuta.");
  }

  const config = validateConfig(party.config, party.players.length, {
    requireMinimumPlayers: true,
  });
  const roles = buildRolePool(config);

  party.config = config;

  party.players.forEach((player, index) => {
    player.role = roles[index];
    player.status = "alive";
  });

  party.round = 1;
  resetRoundState(party);
  party.phase = "role-reveal";
  setPrompt(
    party,
    "Zadržite klik na polju sa ulogom da je vidite. Host zatim pokreće prvu noć.",
    "role-reveal",
    null,
  );
}

export function updatePartyConfig(
  party: Party,
  nickname: string,
  configInput: PartyConfigInput,
) {
  assertHost(party, nickname);

  if (party.phase !== "lobby") {
    throw new Error("Konfiguracija moze da se menja samo dok je partija u lobby-ju.");
  }

  const config = validateConfig(configInput, party.players.length);
  party.config = config;
  party.promptText = buildLobbyPrompt(party);
  party.promptKey = promptKey(0, "lobby-config");
  partyTouched(party);
}

export function beginFirstNight(party: Party, nickname: string) {
  assertHost(party, nickname);

  if (party.phase !== "role-reveal") {
    throw new Error("Prva noc moze da krene tek nakon otkrivanja uloga.");
  }

  startNightRound(party);
}

export function stopGame(party: Party, nickname: string) {
  assertHost(party, nickname);
  resetPartyForLobby(
    party,
    "Partija je zaustavljena. Host može da promeni konfiguraciju i pokrene novu partiju.",
  );
}

export function submitNightAction(
  party: Party,
  nickname: string,
  targetId: string,
) {
  ensurePartyProgress(party);

  if (party.phase !== "night-role" || !party.currentRole) {
    throw new Error("Nocna akcija trenutno nije otvorena.");
  }

  const requester = assertRequesterPlayer(party, nickname);

  if (requester.status !== "alive") {
    throw new Error("Samo zivi igraci mogu da igraju nocne poteze.");
  }

  if (requester.role !== party.currentRole) {
    throw new Error("Trenutno nije na redu tvoja uloga.");
  }

  if (party.currentRole === "mafia" && party.actions.mafia?.targetId) {
    throw new Error("Meta mafije je vec izabrana.");
  }

  const target = assertTarget(party, targetId);
  const validTargets = getTargetOptions(party, requester, party.currentRole);

  if (!validTargets.some((option) => option.id === target.id)) {
    throw new Error("Taj izbor nije dozvoljen za ovu ulogu.");
  }

  party.actions[party.currentRole] = {
    actorId: requester.id,
    targetId: target.id,
    submittedAt: now(),
  };

  if (party.currentRole === "police") {
    startTransitionSequence(
      party,
      [
        {
          text: "Policajac proverava rezultat.",
          keyId: "police-result",
          role: "police",
          delayMs: NIGHT_PROMPT_DELAY_MS,
        },
        {
          text: getRoleText("police", true),
          keyId: `police-sleep-${party.stepIndex + 1}`,
          role: "police",
          delayMs: NIGHT_PROMPT_DELAY_MS,
        },
      ],
      { type: "begin-step", stepIndex: party.stepIndex + 1 },
    );
    return;
  }

  queueSleepTransition(party, party.currentRole, party.stepIndex + 1);
}

export function resolveDayVote(
  party: Party,
  nickname: string,
  votedOutPlayerId: string | null,
) {
  ensurePartyProgress(party);
  assertHost(party, nickname);

  if (party.phase !== "day-summary") {
    throw new Error("Dnevni ishod trenutno nije moguce zakljuciti.");
  }

  if (!votedOutPlayerId) {
    party.round += 1;
    resetRoundState(party);
    startNightRound(party);
    return;
  }

  const votedOutPlayer = assertTarget(party, votedOutPlayerId);

  if (votedOutPlayer.status !== "alive") {
    throw new Error("Izglasan igrac mora biti ziv.");
  }

  votedOutPlayer.status = "voted-out";
  party.moderatorId = votedOutPlayer.id;
  party.phase = "handoff";
  party.transitionEndsAt = null;
  party.transitionToStepIndex = null;
  setPrompt(
    party,
    `${votedOutPlayer.nickname} postaje moderator i preuzima vođenje partije.`,
    `handoff-${votedOutPlayer.id}`,
    null,
  );
}

export function getPartySnapshot(party: Party, nickname: string): PartySnapshot {
  const requester = touchPlayer(party, nickname);
  const effectiveConfig = getEffectiveConfig(party);
  const isModerator = requester.id === party.moderatorId;
  const currentAction = party.currentRole ? party.actions[party.currentRole] : null;
  const canAct =
    party.phase === "night-role" &&
    requester.status === "alive" &&
    requester.role === party.currentRole &&
    (!currentAction?.targetId || party.currentRole !== "mafia");
  const submittedTarget = currentAction?.targetId
    ? findPlayerById(party, currentAction.targetId)
    : null;

  return {
    code: party.code,
    phase: party.phase,
    round: party.round,
    promptText: party.promptText,
    promptKey: party.promptKey,
    config: effectiveConfig,
    requester: {
      id: requester.id,
      nickname: requester.nickname,
      role: requester.role,
      status: requester.status,
      isHost: requester.isHost,
      isModerator,
      isAlive: requester.status === "alive",
    },
    players: party.players.map((player) => ({
      id: player.id,
      nickname: player.nickname,
      status: player.status,
      isHost: player.isHost,
      isConnected: getConnected(player),
      role:
        isModerator || player.id === requester.id
          ? player.role
          : undefined,
    })),
    lobby: {
      joinedCount: party.players.length,
      totalPlayers: effectiveConfig.totalPlayers,
      canStart:
        requester.isHost &&
        party.phase === "lobby" &&
        effectiveConfig.totalPlayers >= 5 &&
        effectiveConfig.citizenCount >= 1,
    },
    daySummary: party.latestSummary
      ? {
          round: party.latestSummary.round,
          victimName: findPlayerById(party, party.latestSummary.victimId)?.nickname ?? null,
          silencedName:
            findPlayerById(party, party.latestSummary.silencedId)?.nickname ?? null,
        }
      : null,
    availableTargets:
      canAct && party.currentRole
        ? getTargetOptions(party, requester, party.currentRole).map((player) => ({
            id: player.id,
            nickname: player.nickname,
          }))
        : [],
    actionState: {
      canAct,
      hasSubmitted:
        Boolean(currentAction?.targetId) &&
        ((currentAction?.actorId === requester.id && requester.role === party.currentRole) ||
          (requester.role === "mafia" && party.currentRole === "mafia")),
      submittedTargetName: submittedTarget?.nickname ?? null,
      note: getPoliceNote(party, requester),
    },
    hostControls: {
      canUpdateConfig: requester.isHost && party.phase === "lobby",
      canStart:
        requester.isHost &&
        party.phase === "lobby" &&
        effectiveConfig.totalPlayers >= 5 &&
        effectiveConfig.citizenCount >= 1,
      canAdvanceRoleReveal: requester.isHost && party.phase === "role-reveal",
      canResolveDay: requester.isHost && party.phase === "day-summary",
      canStop: requester.isHost,
      voteCandidates:
        requester.isHost && party.phase === "day-summary"
          ? getAlivePlayers(party).map((player) => ({
              id: player.id,
              nickname: player.nickname,
            }))
          : [],
    },
    moderatorView: isModerator
      ? {
          players: party.players.map((player) => ({
            id: player.id,
            nickname: player.nickname,
            role: player.role,
            status: player.status,
            isHost: player.isHost,
          })),
          history: party.history.map((summary) => ({
            round: summary.round,
            victimName: findPlayerById(party, summary.victimId)?.nickname ?? null,
            silencedName:
              findPlayerById(party, summary.silencedId)?.nickname ?? null,
          })),
        }
      : null,
  };
}

export function getPartyCode(input: string) {
  const code = normalizeCode(input);

  if (!code) {
    throw new Error("Kod partije je obavezan.");
  }

  return code;
}
