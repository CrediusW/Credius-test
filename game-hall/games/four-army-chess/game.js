// @ts-check

import { FOUR_ARMY_GAME_TYPE, FOUR_ARMY_NODE_BY_ID } from "../../src/fourArmyChessBoardMap.js";
import { ARMY_RANK_LABELS, ARMY_RANKS } from "../../src/fourArmyChessPieces.js";
import {
  ARMY_DEPLOYMENT_SCHEMES,
  applyArmyDeploymentPlacements,
  buildArmyDeploymentPlacements,
} from "../../src/fourArmyChessDeployment.js";
import {
  ARMY_SEAT_COLORS,
  ARMY_SEAT_NAMES,
  FourArmyBoardRenderer,
} from "./boardRenderer.js";
import { ArmyReplayController } from "./replayController.js";

const AVATAR_LABELS = {
  mint: "薄荷",
  coral: "珊瑚",
  sun: "暖阳",
  sky: "晴空",
  violet: "紫藤",
  graphite: "石墨",
};

const TEAM_NAMES = ["北南同盟", "东西同盟"];
const BATTLE_LABELS = {
  ATTACKER_WINS: "进攻方胜出",
  DEFENDER_WINS: "守方守住阵地",
  BOTH_DIE: "双方同归于尽",
};
const ANNOTATION_GROUPS = [
  { label: "高阶主力", tier: "high", choices: ["司", "军", "师"] },
  { label: "中阶主力", tier: "middle", choices: ["旅", "团", "营"] },
  { label: "基层与工兵", tier: "low", choices: ["连", "排", "工"] },
  { label: "特殊与判断", tier: "special", choices: ["炸", "雷", "旗", "大", "中", "小", "?"] },
];

const elements = {
  backLobby: document.getElementById("backLobby"),
  connectionState: document.getElementById("connectionState"),
  rulesButton: document.getElementById("rulesButton"),
  profileButton: document.getElementById("profileButton"),
  profileAvatar: document.getElementById("profileAvatar"),
  profileName: document.getElementById("profileName"),
  conflictScreen: document.getElementById("conflictScreen"),
  leaveOtherRoom: document.getElementById("leaveOtherRoom"),
  entryScreen: document.getElementById("entryScreen"),
  previewBoard: /** @type {HTMLCanvasElement} */ (document.getElementById("previewBoard")),
  createRoom: /** @type {HTMLButtonElement} */ (document.getElementById("createRoom")),
  joinForm: /** @type {HTMLFormElement} */ (document.getElementById("joinForm")),
  roomCode: /** @type {HTMLInputElement} */ (document.getElementById("roomCode")),
  roomScreen: document.getElementById("roomScreen"),
  roomCodeValue: document.getElementById("roomCodeValue"),
  copyRoomCode: document.getElementById("copyRoomCode"),
  leaveRoom: document.getElementById("leaveRoom"),
  roomPlayers: document.getElementById("roomPlayers"),
  addBotButton: /** @type {HTMLButtonElement} */ (document.getElementById("addBotButton")),
  readyButton: /** @type {HTMLButtonElement} */ (document.getElementById("readyButton")),
  startButton: /** @type {HTMLButtonElement} */ (document.getElementById("startButton")),
  roomHint: document.getElementById("roomHint"),
  gameScreen: document.getElementById("gameScreen"),
  turnPlayers: document.getElementById("turnPlayers"),
  armyBoard: /** @type {HTMLCanvasElement} */ (document.getElementById("armyBoard")),
  annotationMenu: document.getElementById("annotationMenu"),
  finishBanner: document.getElementById("finishBanner"),
  finishTitle: document.getElementById("finishTitle"),
  finishText: document.getElementById("finishText"),
  openReplay: /** @type {HTMLButtonElement} */ (document.getElementById("openReplay")),
  gameRoomCode: document.getElementById("gameRoomCode"),
  gameLeaveRoom: document.getElementById("gameLeaveRoom"),
  turnLabel: document.getElementById("turnLabel"),
  turnCountdown: document.getElementById("turnCountdown"),
  actionLabel: document.getElementById("actionLabel"),
  selectionLabel: document.getElementById("selectionLabel"),
  deploymentPanel: document.getElementById("deploymentPanel"),
  deploymentSchemes: document.getElementById("deploymentSchemes"),
  deploymentHint: document.getElementById("deploymentHint"),
  confirmDeployment: /** @type {HTMLButtonElement} */ (document.getElementById("confirmDeployment")),
  battleFeed: document.getElementById("battleFeed"),
  replayControls: document.getElementById("replayControls"),
  closeReplay: document.getElementById("closeReplay"),
  replayRange: /** @type {HTMLInputElement} */ (document.getElementById("replayRange")),
  replayPrevious: /** @type {HTMLButtonElement} */ (document.getElementById("replayPrevious")),
  replayPlay: /** @type {HTMLButtonElement} */ (document.getElementById("replayPlay")),
  replayNext: /** @type {HTMLButtonElement} */ (document.getElementById("replayNext")),
  replayLabel: document.getElementById("replayLabel"),
  profileLayer: document.getElementById("profileLayer"),
  profileForm: /** @type {HTMLFormElement} */ (document.getElementById("profileForm")),
  nickname: /** @type {HTMLInputElement} */ (document.getElementById("nickname")),
  avatarChoices: document.getElementById("avatarChoices"),
  profileError: document.getElementById("profileError"),
  cancelProfile: /** @type {HTMLButtonElement} */ (document.getElementById("cancelProfile")),
  ruleLayer: document.getElementById("ruleLayer"),
  closeRules: document.getElementById("closeRules"),
  toast: document.getElementById("toast"),
};

let identity = globalThis.CrediusPlayerIdentity.getOrCreate();
let client = null;
let room = null;
let busy = false;
let selectedAvatar = identity.avatar;
let selectedPieceId = null;
let toastTimer = 0;
let receivedInitialRoomState = false;
let lastActionId = null;
let animationLocked = false;
let animationPieces = null;
let movement = null;
let battleEffect = null;
let replaySnapshot = null;
let replayOpen = false;
let lastPulseDraw = 0;
let deploymentDraft = null;
let deploymentSchemeId = null;
let deploymentSwapPieceId = null;
let annotationPieceId = null;
let annotations = {};
let annotationRoomCode = null;
let audioContext = null;
const animationQueue = [];

const debugMode = new URLSearchParams(location.search).get("debugArmyChess") === "true";
const reducedMotion = globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches;
const previewRenderer = new FourArmyBoardRenderer(elements.previewBoard, { debugMode });
const boardRenderer = new FourArmyBoardRenderer(elements.armyBoard, { debugMode });
const replayController = new ArmyReplayController({
  onChange(snapshot) {
    replaySnapshot = snapshot;
    renderReplayControls();
    drawBoard();
  },
});

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function initials(name) {
  return String(name || "W").trim().slice(0, 1).toUpperCase();
}

function avatarMarkup(player) {
  return `<span class="avatar avatar-${escapeHtml(player.avatar)}">${player.isBot ? "AI" : escapeHtml(initials(player.nickname))}</span>`;
}

function playerById(playerId) {
  return room?.players.find((player) => player.playerId === playerId) ?? null;
}

function currentPlayer() {
  return playerById(identity.playerId);
}

function annotationStorageKey(code) {
  return `crediusArcade.fourArmyAnnotations.v1.${code}`;
}

function loadAnnotations(code) {
  annotationRoomCode = code ?? null;
  annotationPieceId = null;
  annotations = {};
  if (!code) return;
  try {
    annotations = JSON.parse(globalThis.localStorage.getItem(annotationStorageKey(code)) || "{}") ?? {};
  } catch {
    annotations = {};
  }
}

function saveAnnotations() {
  if (!annotationRoomCode) return;
  globalThis.localStorage.setItem(annotationStorageKey(annotationRoomCode), JSON.stringify(annotations));
}

function ensureAudioContext() {
  if (!audioContext) {
    const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (AudioContextClass) audioContext = new AudioContextClass();
  }
  if (audioContext?.state === "suspended") audioContext.resume().catch(() => {});
  return audioContext;
}

function playTone(frequency, start, duration, type, gainValue) {
  const context = ensureAudioContext();
  if (!context) return;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, context.currentTime + start);
  gain.gain.setValueAtTime(0.0001, context.currentTime + start);
  gain.gain.exponentialRampToValueAtTime(gainValue, context.currentTime + start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + start + duration);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(context.currentTime + start);
  oscillator.stop(context.currentTime + start + duration + 0.02);
}

function playSweep(startFrequency, endFrequency, start, duration, type, gainValue) {
  const context = ensureAudioContext();
  if (!context) return;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const startsAt = context.currentTime + start;
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(startFrequency, startsAt);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), startsAt + duration);
  gain.gain.setValueAtTime(0.0001, startsAt);
  gain.gain.exponentialRampToValueAtTime(gainValue, startsAt + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, startsAt + duration);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(startsAt);
  oscillator.stop(startsAt + duration + 0.02);
}

function playNoiseBurst(start, duration, gainValue) {
  const context = ensureAudioContext();
  if (!context) return;
  const frameCount = Math.max(1, Math.floor(context.sampleRate * duration));
  const buffer = context.createBuffer(1, frameCount, context.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let index = 0; index < frameCount; index += 1) {
    const envelope = (1 - index / frameCount) ** 3;
    channel[index] = (Math.random() * 2 - 1) * envelope;
  }
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  const startsAt = context.currentTime + start;
  source.buffer = buffer;
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(900, startsAt);
  gain.gain.setValueAtTime(gainValue, startsAt);
  gain.gain.exponentialRampToValueAtTime(0.0001, startsAt + duration);
  source.connect(filter).connect(gain).connect(context.destination);
  source.start(startsAt);
}

function playCommanderDeathSound(start = 0.18) {
  playTone(146, start, 0.5, "sine", 0.095);
  playTone(110, start + 0.12, 0.58, "triangle", 0.07);
  playSweep(420, 92, start, 0.72, "sawtooth", 0.035);
}

function playBattleSound(outcome, commanderDied = false) {
  if (outcome === "ATTACKER_WINS") {
    playNoiseBurst(0, 0.09, 0.22);
    playSweep(120, 58, 0, 0.16, "sine", 0.16);
  } else if (outcome === "DEFENDER_WINS") {
    playSweep(145, 480, 0, 0.15, "sine", 0.11);
    playSweep(480, 118, 0.14, 0.3, "triangle", 0.085);
  } else {
    playNoiseBurst(0, 0.18, 0.2);
    playSweep(180, 54, 0, 0.38, "sawtooth", 0.09);
    playTone(72, 0.06, 0.34, "square", 0.055);
  }
  if (commanderDied) playCommanderDeathSound();
}

function deploymentConfirmed(state = room?.gameState) {
  return Boolean(state?.deploymentConfirmedPlayerIds?.includes(identity.playerId));
}

function ensureDeploymentDraft() {
  const state = room?.gameState;
  const me = currentPlayer();
  if (!state || state.phase !== "deployment" || !me || deploymentConfirmed(state)) return;
  if (!deploymentDraft) {
    deploymentDraft = state.pieces
      .filter((piece) => piece.playerId === identity.playerId)
      .map((piece) => ({ pieceId: piece.id, nodeId: piece.nodeId }));
  }
}

function canDeployAt(piece, targetNodeId) {
  const node = FOUR_ARMY_NODE_BY_ID.get(targetNodeId);
  if (!piece || !node) return false;
  if (piece.rank === ARMY_RANKS.FLAG) return node.type === "HEADQUARTERS";
  if (piece.rank === ARMY_RANKS.MINE) return node.row >= 4;
  if (piece.rank === ARMY_RANKS.BOMB) return node.row > 0;
  return true;
}

function setConnection(connected) {
  elements.connectionState.dataset.state = connected ? "online" : "offline";
  elements.connectionState.querySelector("strong").textContent = connected ? "已连接" : "重连中";
}

function showToast(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  toastTimer = globalThis.setTimeout(() => {
    elements.toast.hidden = true;
  }, 2600);
}

function setBusy(value) {
  busy = value;
  render();
}

async function runAction(action) {
  if (busy || animationLocked || !client) return null;
  setBusy(true);
  try {
    return await action();
  } catch (error) {
    showToast(error?.message || "操作失败，请重试。");
    if (error?.code === "VERSION_CONFLICT") client.reconnect().catch(() => {});
    return null;
  } finally {
    setBusy(false);
  }
}

function connect() {
  if (!identity.profileComplete) {
    openProfile(true);
    return;
  }
  if (client) {
    client.updateIdentity(identity).catch((error) => showToast(error.message));
    return;
  }
  client = new globalThis.CrediusMultiplayer.MultiplayerClient(identity);
  client.addEventListener("connection", (event) => setConnection(event.detail.connected));
  client.addEventListener("room", (event) => receiveRoom(event.detail.room));
  client.addEventListener("error", (event) => showToast(event.detail.error.message));
  client.connect();
}

function receiveRoom(nextRoom) {
  const previousRoom = room;
  room = nextRoom;
  selectedPieceId = null;
  if (room?.code !== annotationRoomCode) loadAnnotations(room?.code);
  if (room?.gameState?.phase === "deployment") {
    ensureDeploymentDraft();
  } else {
    deploymentDraft = null;
    deploymentSchemeId = null;
    deploymentSwapPieceId = null;
  }
  if (!room) {
    elements.annotationMenu.hidden = true;
    annotationPieceId = null;
  }
  if (room?.gameType === FOUR_ARMY_GAME_TYPE && receivedInitialRoomState) {
    enqueueAnimation(previousRoom?.gameState, room.gameState);
  }
  receivedInitialRoomState = true;
  if (room?.status !== "finished") closeReplay();
  render();
}

function enqueueAnimation(previousState, nextState) {
  const action = nextState?.lastAction;
  if (!action?.id || action.id === lastActionId) return;
  lastActionId = action.id;
  if (action.type !== "move" || !previousState?.pieces?.length) return;
  const sourcePiece = previousState.pieces.find((piece) => piece.id === action.pieceId);
  if (!sourcePiece?.nodeId || sourcePiece.nodeId !== action.fromNodeId) return;
  animationQueue.push({
    action,
    beforePieces: structuredClone(previousState.pieces),
    afterPieces: structuredClone(nextState.pieces),
  });
  playAnimationQueue();
}

function wait(milliseconds) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds));
}

function animate(duration, onFrame) {
  if (reducedMotion) {
    onFrame(1);
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const start = performance.now();
    const frame = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      onFrame(progress);
      drawBoard();
      if (progress < 1) requestAnimationFrame(frame);
      else resolve();
    };
    requestAnimationFrame(frame);
  });
}

async function playAnimationQueue() {
  if (animationLocked || !animationQueue.length) return;
  animationLocked = true;
  selectedPieceId = null;
  renderGameHud();
  while (animationQueue.length) {
    const item = animationQueue.shift();
    animationPieces = item.beforePieces;
    movement = {
      pieceId: item.action.pieceId,
      fromNodeId: item.action.fromNodeId,
      toNodeId: item.action.toNodeId,
      pathNodeIds: item.action.travelPath,
      progress: 0,
    };
    const segmentCount = Math.max(1, (item.action.travelPath?.length ?? 2) - 1);
    const movementDuration = Math.min(900, Math.max(300, segmentCount * 92));
    await animate(movementDuration, (progress) => { movement.progress = progress; });
    movement = null;
    animationPieces = item.afterPieces;
    if (item.action.battleOutcome) {
      battleEffect = { nodeId: item.action.toNodeId, outcome: item.action.battleOutcome, progress: 0 };
      playBattleSound(item.action.battleOutcome, Boolean(item.action.commanderDiedSeats?.length));
      const effectDuration = item.action.battleOutcome === "ATTACKER_WINS" ? 300 : item.action.battleOutcome === "DEFENDER_WINS" ? 420 : 560;
      await animate(effectDuration, (progress) => { battleEffect.progress = progress; });
      battleEffect = null;
      await wait(reducedMotion ? 0 : 90);
    }
  }
  animationPieces = null;
  animationLocked = false;
  render();
}

function openProfile(required = false) {
  selectedAvatar = identity.avatar;
  elements.nickname.value = identity.nickname;
  elements.cancelProfile.hidden = required;
  elements.profileError.textContent = "";
  renderAvatarChoices();
  elements.profileLayer.hidden = false;
  globalThis.setTimeout(() => elements.nickname.focus(), 0);
}

function renderAvatarChoices() {
  elements.avatarChoices.innerHTML = globalThis.CrediusPlayerIdentity.AVATARS.map((avatar) => `
    <button class="avatar-choice avatar-${avatar} ${selectedAvatar === avatar ? "selected" : ""}"
      type="button" data-avatar="${avatar}" aria-label="${AVATAR_LABELS[avatar]}头像"
      aria-pressed="${selectedAvatar === avatar}"></button>
  `).join("");
}

function render() {
  elements.profileAvatar.className = `avatar avatar-${identity.avatar}`;
  elements.profileAvatar.textContent = initials(identity.nickname);
  elements.profileName.textContent = identity.nickname || "玩家";

  const conflict = Boolean(room && room.gameType !== FOUR_ARMY_GAME_TYPE);
  const waiting = room?.gameType === FOUR_ARMY_GAME_TYPE && room.status === "waiting";
  const inGame = room?.gameType === FOUR_ARMY_GAME_TYPE && ["playing", "finished"].includes(room.status);
  elements.conflictScreen.hidden = !conflict;
  elements.entryScreen.hidden = conflict || Boolean(room);
  elements.roomScreen.hidden = !waiting;
  elements.gameScreen.hidden = !inGame;
  elements.createRoom.disabled = busy || !client?.connected;
  if (waiting) renderWaitingRoom();
  if (inGame) renderGame();
}

function renderWaitingRoom() {
  const me = currentPlayer();
  const isHost = room.hostId === identity.playerId;
  elements.roomCodeValue.textContent = room.code;
  elements.roomPlayers.innerHTML = Array.from({ length: 4 }, (_, seat) => {
    const player = room.players.find((item) => item.seat === seat);
    if (!player) {
      return `<article class="room-player empty" style="--seat-color:${ARMY_SEAT_COLORS[seat]}"><span>${ARMY_SEAT_NAMES[seat]}</span><strong>等待玩家</strong></article>`;
    }
    const remove = isHost && player.isBot
      ? `<button class="remove-bot" type="button" data-remove-bot="${escapeHtml(player.playerId)}" aria-label="移除机器人 ${escapeHtml(player.nickname)}" title="移除机器人">×</button>`
      : "";
    return `
      <article class="room-player" style="--seat-color:${ARMY_SEAT_COLORS[seat]}">
        ${remove}
        <div class="room-player-head">${avatarMarkup(player)}<div><strong>${escapeHtml(player.nickname)}</strong><small>${ARMY_SEAT_NAMES[seat]} · ${player.isBot ? "机器人" : seat % 2 ? "东西同盟" : "北南同盟"}${player.playerId === room.hostId ? " · 房主" : ""}</small></div></div>
        <div class="room-player-state"><span class="${player.online ? "" : "offline"}">${player.isBot ? "自动行动" : player.online ? "在线" : "离线"}</span><span class="${player.ready ? "ready" : ""}">${player.ready ? "已准备" : "未准备"}</span></div>
      </article>`;
  }).join("");
  elements.readyButton.textContent = me?.ready ? "取消准备" : "准备";
  elements.readyButton.disabled = busy || !me;
  elements.addBotButton.hidden = !isHost || room.players.length >= 4;
  elements.addBotButton.disabled = busy;
  elements.startButton.hidden = !isHost;
  const allReady = room.players.length === 4 && room.players.every((player) => player.isBot || (player.ready && player.online));
  elements.startButton.disabled = busy || !allReady;
  elements.roomHint.textContent = room.players.length < 4
    ? (isHost ? `还差 ${4 - room.players.length} 位玩家，可添加机器人或分享房间码` : `还差 ${4 - room.players.length} 位玩家，等待房主补位或朋友加入`)
    : allReady
      ? (isHost ? "四方就绪，可以开始战役" : "四方就绪，等待房主开始")
      : "四人已到齐，等待所有玩家准备";
}

function renderGame() {
  const state = room.gameState;
  if (!state) return;
  elements.gameRoomCode.textContent = room.code;
  elements.turnPlayers.innerHTML = room.players.map((player) => {
    const active = state.turnPlayerId === player.playerId && state.status === "playing" && state.phase === "await-move";
    const eliminated = state.eliminatedPlayerIds.includes(player.playerId);
    const aliveCount = state.pieces.filter((piece) => piece.playerId === player.playerId && piece.alive).length;
    const timeoutCount = state.timeoutCounts?.[player.playerId] ?? 0;
    return `<div class="turn-player ${active ? "active" : ""} ${eliminated ? "eliminated" : ""}" style="--seat-color:${ARMY_SEAT_COLORS[player.seat]}">
      ${avatarMarkup(player)}<strong>${escapeHtml(player.nickname)}</strong><small>${ARMY_SEAT_NAMES[player.seat]} · ${eliminated ? "已退出" : `${aliveCount} 子`}${player.isBot ? " · AI" : player.online ? "" : " · 离线"}${timeoutCount ? ` · 超时 ${timeoutCount}` : ""}</small>
    </div>`;
  }).join("");
  renderDeploymentPanel();
  renderGameHud();
  updateCountdown();
  renderBattleFeed();
  drawBoard();

  const finished = state.status === "finished";
  elements.finishBanner.hidden = !finished || replayOpen;
  if (finished) {
    const won = state.winnerTeam !== null && currentPlayer()?.seat % 2 === state.winnerTeam;
    elements.finishTitle.textContent = state.winnerTeam === null ? "本局和棋" : `${TEAM_NAMES[state.winnerTeam]}获胜`;
    elements.finishText.textContent = state.drawReason ? "连续 70 步没有发生交锋" : won ? "你和对家赢得了这场战役" : "所有棋子已经公开，可以查看完整战局";
    elements.openReplay.hidden = !state.replay;
    recordFinishedGame(state, won);
  }
}

function renderGameHud() {
  const state = room?.gameState;
  if (!state) return;
  const turnPlayer = playerById(state.turnPlayerId);
  const isMyTurn = state.status === "playing" && state.turnPlayerId === identity.playerId;
  if (state.phase === "deployment") {
    const confirmed = deploymentConfirmed(state);
    elements.turnLabel.textContent = "排兵布阵";
    elements.actionLabel.textContent = confirmed ? "阵型已锁定，等待其他玩家" : deploymentSchemeId ? "可继续互换棋子位置" : "请先选择一个布阵方案";
    elements.selectionLabel.textContent = confirmed ? `已有 ${state.deploymentConfirmedPlayerIds.length}/4 方确认` : deploymentSwapPieceId ? "再点一枚棋子进行互换" : "依次点击两枚己方棋子即可调换";
  } else if (replayOpen) {
    elements.turnLabel.textContent = "明棋复盘";
    elements.actionLabel.textContent = "双方全部军衔已经公开";
    elements.selectionLabel.textContent = "使用下方控制逐步查看战局";
  } else if (animationLocked) {
    elements.turnLabel.textContent = "正在行军";
    elements.actionLabel.textContent = "棋子正在抵达目标位置";
    elements.selectionLabel.textContent = "动画结束后继续操作";
  } else if (state.status === "finished") {
    elements.turnLabel.textContent = "战役结束";
    elements.actionLabel.textContent = state.winnerTeam === null ? "本局和棋" : `${TEAM_NAMES[state.winnerTeam]}获胜`;
    elements.selectionLabel.textContent = "可进入明棋复盘查看每一次交锋";
  } else if (isMyTurn) {
    const legalPieces = state.legalMoves.length;
    elements.turnLabel.textContent = "轮到你了";
    elements.actionLabel.textContent = selectedPieceId ? "请选择发光的目标位置" : `你有 ${legalPieces} 枚棋子可以移动`;
    elements.selectionLabel.textContent = selectedPieceId ? "再次点击其他己方棋子可改选" : "点击发光描边的己方棋子";
  } else {
    elements.turnLabel.textContent = `${turnPlayer?.nickname ?? "玩家"}的回合`;
    elements.actionLabel.textContent = turnPlayer?.isBot ? `${turnPlayer.nickname}正在研判路线` : `${ARMY_SEAT_NAMES[turnPlayer?.seat ?? 0]}正在部署行动`;
    elements.selectionLabel.textContent = turnPlayer?.isBot ? "机器人由服务端自动走子" : turnPlayer?.online ? "等待服务端同步走子" : "该玩家暂时离线，回来后可继续";
  }
}

function renderDeploymentPanel() {
  const state = room?.gameState;
  const active = state?.status === "playing" && state.phase === "deployment";
  elements.deploymentPanel.hidden = !active;
  if (!active) return;
  const confirmed = deploymentConfirmed(state);
  elements.deploymentSchemes.innerHTML = ARMY_DEPLOYMENT_SCHEMES.map((scheme) => `
    <button class="deployment-scheme ${deploymentSchemeId === scheme.id ? "selected" : ""}" type="button" data-deployment-scheme="${scheme.id}" ${confirmed ? "disabled" : ""}>
      <strong>${escapeHtml(scheme.name)}</strong><small>${escapeHtml(scheme.description)}</small>
    </button>`).join("");
  elements.deploymentHint.textContent = confirmed
    ? `阵型已确认，等待其他玩家（${state.deploymentConfirmedPlayerIds.length}/4）`
    : deploymentSwapPieceId
      ? "已选中一枚棋子，再点另一枚即可互换。"
      : "选好方案后，可在棋盘上依次点击两枚己方棋子互换。";
  elements.confirmDeployment.disabled = busy || confirmed || !deploymentSchemeId;
  elements.confirmDeployment.textContent = confirmed ? "阵型已确认" : "确认阵型";
}

function updateCountdown() {
  const state = room?.gameState;
  const visible = state?.status === "playing" && state.phase === "await-move" && state.turnDeadlineAt;
  elements.turnCountdown.hidden = !visible;
  if (!visible) return;
  const seconds = Math.max(0, Math.ceil((Date.parse(state.turnDeadlineAt) - Date.now()) / 1000));
  elements.turnCountdown.textContent = String(seconds).padStart(2, "0");
  elements.turnCountdown.classList.toggle("danger", seconds <= 5);
  elements.turnCountdown.setAttribute("aria-label", `本回合剩余 ${seconds} 秒`);
}

function outcomeText(entry, revealRanks) {
  const attacker = playerById(entry.playerId);
  const defenderPiece = room.gameState.pieces.find((piece) => piece.id === entry.battle?.defenderPieceId);
  const defender = playerById(defenderPiece?.playerId);
  if (entry.type === "TIMEOUT") return `${attacker?.nickname ?? "玩家"}超时，本回合跳过（累计 ${entry.timeoutCount}/3）`;
  if (entry.type === "FORFEIT") return entry.reason === "TURN_TIMEOUT"
    ? `${attacker?.nickname ?? "玩家"}超时超过 3 次，判定投降`
    : `${attacker?.nickname ?? "玩家"}退出战役`;
  if (!entry.battle) return `${attacker?.nickname ?? "玩家"}移动了一枚棋子`;
  const rankText = revealRanks && entry.battle.attackerRank
    ? `（${ARMY_RANK_LABELS[entry.battle.attackerRank]} 对 ${ARMY_RANK_LABELS[entry.battle.defenderRank]}）`
    : "";
  return `${attacker?.nickname ?? "进攻方"}与${defender?.nickname ?? "守方"}交锋，${BATTLE_LABELS[entry.battle.outcome]}${rankText}`;
}

function renderBattleFeed() {
  const state = room?.gameState;
  if (!state) return;
  const entries = state.history.slice(-7).reverse();
  elements.battleFeed.innerHTML = entries.length
    ? entries.map((entry) => `<li><span>第 ${entry.step} 步</span><strong>${escapeHtml(outcomeText(entry, state.status === "finished"))}</strong>${entry.capturedFlagSeat !== null && entry.capturedFlagSeat !== undefined ? `<em>${ARMY_SEAT_NAMES[entry.capturedFlagSeat]}军旗失守</em>` : ""}</li>`).join("")
    : "<li class=\"empty-feed\">战场尚未发生行动</li>";
}

function legalMoveForSelected() {
  return room?.gameState?.legalMoves.find((move) => move.pieceId === selectedPieceId) ?? null;
}

function displayedPieces(state) {
  if (state.phase === "deployment" && deploymentDraft && !deploymentConfirmed(state)) {
    return applyArmyDeploymentPlacements(state.pieces, deploymentDraft);
  }
  return state.pieces;
}

function drawBoard() {
  const state = room?.gameState;
  if (!state) return;
  const isMyTurn = state.status === "playing" && state.phase === "await-move" && state.turnPlayerId === identity.playerId;
  const inputEnabled = isMyTurn && !busy && !animationLocked && !replayOpen;
  const deploymentInput = state.phase === "deployment" && !deploymentConfirmed(state) && !busy;
  const pieces = replayOpen && replaySnapshot ? replaySnapshot.pieces : animationPieces ?? displayedPieces(state);
  const inspectablePieceIds = state.phase === "await-move"
    ? pieces.filter((piece) => piece.alive && piece.playerId !== identity.playerId && !piece.rank).map((piece) => piece.id)
    : [];
  boardRenderer.draw({ pieces }, {
    now: performance.now(),
    selectedPieceId: deploymentInput ? deploymentSwapPieceId : inputEnabled ? selectedPieceId : null,
    selectablePieceIds: deploymentInput
      ? pieces.filter((piece) => piece.playerId === identity.playerId && piece.alive).map((piece) => piece.id)
      : inputEnabled ? state.legalMoves.map((move) => move.pieceId) : [],
    inspectablePieceIds,
    legalTargetIds: inputEnabled ? legalMoveForSelected()?.destinations ?? [] : [],
    annotations,
    movement,
    battleEffect,
  });
}

function selectBoardTarget(target) {
  const state = room?.gameState;
  if (!state || busy || animationLocked || replayOpen || state.status !== "playing") return;
  if (state.phase === "deployment" && !deploymentConfirmed(state) && target.type === "piece") {
    const pieces = displayedPieces(state);
    const targetPiece = pieces.find((piece) => piece.id === target.pieceId);
    if (!targetPiece || targetPiece.playerId !== identity.playerId) return;
    if (!deploymentSwapPieceId) {
      deploymentSwapPieceId = targetPiece.id;
    } else if (deploymentSwapPieceId === targetPiece.id) {
      deploymentSwapPieceId = null;
    } else {
      const firstPiece = pieces.find((piece) => piece.id === deploymentSwapPieceId);
      const firstPlacement = deploymentDraft.find((placement) => placement.pieceId === firstPiece.id);
      const secondPlacement = deploymentDraft.find((placement) => placement.pieceId === targetPiece.id);
      if (!canDeployAt(firstPiece, secondPlacement.nodeId) || !canDeployAt(targetPiece, firstPlacement.nodeId)) {
        showToast("军旗、地雷和炸弹必须遵守布阵位置限制。");
      } else {
        [firstPlacement.nodeId, secondPlacement.nodeId] = [secondPlacement.nodeId, firstPlacement.nodeId];
      }
      deploymentSwapPieceId = null;
    }
    renderDeploymentPanel();
    renderGameHud();
    drawBoard();
    return;
  }
  if (target.type === "piece") {
    const piece = state.pieces.find((item) => item.id === target.pieceId);
    if (piece && piece.playerId !== identity.playerId && !piece.rank) {
      openAnnotationMenu(piece.id);
      return;
    }
  }
  if (state.phase !== "await-move" || state.turnPlayerId !== identity.playerId) return;
  if (target.type === "piece") {
    if (!state.legalMoves.some((move) => move.pieceId === target.pieceId)) return;
    selectedPieceId = target.pieceId;
    renderGameHud();
    drawBoard();
    return;
  }
  if (target.type === "node" && selectedPieceId && legalMoveForSelected()?.destinations.includes(target.nodeId)) {
    const pieceId = selectedPieceId;
    selectedPieceId = null;
    runAction(() => client.moveArmyPiece(pieceId, target.nodeId, state.version));
  }
}

function openAnnotationMenu(pieceId) {
  annotationPieceId = pieceId;
  const selected = annotations[pieceId] ?? "";
  const groups = ANNOTATION_GROUPS.map((group) => `
    <section class="annotation-row annotation-${group.tier}" aria-label="${group.label}">
      <span>${group.label}</span>
      <div>${group.choices.map((label) => `<button type="button" data-annotation="${label}" aria-pressed="${selected === label}">${label}</button>`).join("")}</div>
    </section>`).join("");
  elements.annotationMenu.innerHTML = `
    <div class="annotation-title"><span><strong>判断敌方暗棋</strong><small>标记只保存在本机</small></span><button type="button" data-close-annotation aria-label="关闭标注">×</button></div>
    <div class="annotation-groups">${groups}</div>
    <button class="annotation-clear" type="button" data-annotation="">清除当前标记</button>`;
  elements.annotationMenu.hidden = false;
}

function openReplay() {
  const replay = room?.gameState?.replay;
  if (!replay) return;
  replayOpen = true;
  selectedPieceId = null;
  elements.replayControls.hidden = false;
  elements.finishBanner.hidden = true;
  replayController.load(replay);
  renderGameHud();
}

function closeReplay() {
  if (!replayOpen && !replaySnapshot) return;
  replayOpen = false;
  replayController.pause();
  replaySnapshot = null;
  elements.replayControls.hidden = true;
  render();
}

function renderReplayControls() {
  if (!replaySnapshot) return;
  elements.replayRange.max = String(replaySnapshot.total);
  elements.replayRange.value = String(replaySnapshot.step);
  elements.replayPrevious.disabled = replaySnapshot.step <= 0;
  elements.replayNext.disabled = replaySnapshot.step >= replaySnapshot.total;
  elements.replayPlay.textContent = replaySnapshot.playing ? "Ⅱ" : "▶";
  if (!replaySnapshot.move) {
    elements.replayLabel.textContent = "初始明棋阵型";
  } else {
    elements.replayLabel.textContent = `第 ${replaySnapshot.step}/${replaySnapshot.total} 步 · ${outcomeText(replaySnapshot.move, true)}`;
  }
}

function recordFinishedGame(state, won) {
  const key = `crediusArcade.fourArmyRecorded.${room.code}.${state.startedAt}`;
  if (globalThis.sessionStorage.getItem(key)) return;
  const record = globalThis.CrediusArcadeStorage.getGameRecord(FOUR_ARMY_GAME_TYPE);
  const wins = record.highScore + (won ? 1 : 0);
  const duration = Math.max(1, Math.round((Date.now() - Date.parse(state.startedAt)) / 1000));
  globalThis.CrediusArcadeStorage.saveGameResult(FOUR_ARMY_GAME_TYPE, { score: wins, duration, level: 1 });
  globalThis.sessionStorage.setItem(key, "1");
}

async function copyRoomCode() {
  if (!room?.code) return;
  try {
    await navigator.clipboard.writeText(room.code);
    showToast(`房间码 ${room.code} 已复制`);
  } catch {
    showToast(`房间码：${room.code}`);
  }
}

async function leaveRoom() {
  const response = await runAction(() => client.leaveRoom());
  if (response) {
    room = null;
    selectedPieceId = null;
    deploymentDraft = null;
    deploymentSchemeId = null;
    deploymentSwapPieceId = null;
    loadAnnotations(null);
    elements.annotationMenu.hidden = true;
    closeReplay();
    render();
  }
}

elements.backLobby.addEventListener("click", () => {
  if (new URLSearchParams(location.search).get("from") === "lobby") globalThis.parent.postMessage({ type: "credius:close-game" }, "*");
  else location.href = "../../index.html";
});
elements.rulesButton.addEventListener("click", () => { elements.ruleLayer.hidden = false; });
elements.closeRules.addEventListener("click", () => { elements.ruleLayer.hidden = true; });
elements.ruleLayer.addEventListener("click", (event) => {
  if (event.target === elements.ruleLayer) elements.ruleLayer.hidden = true;
});
elements.profileButton.addEventListener("click", () => openProfile(false));
elements.cancelProfile.addEventListener("click", () => { elements.profileLayer.hidden = true; });
elements.avatarChoices.addEventListener("click", (event) => {
  const button = event.target.closest("[data-avatar]");
  if (!button) return;
  selectedAvatar = button.dataset.avatar;
  renderAvatarChoices();
});
elements.profileForm.addEventListener("submit", (event) => {
  event.preventDefault();
  try {
    identity = globalThis.CrediusPlayerIdentity.updateProfile({ nickname: elements.nickname.value, avatar: selectedAvatar });
    elements.profileLayer.hidden = true;
    render();
    connect();
  } catch (error) {
    elements.profileError.textContent = error.message;
  }
});
elements.createRoom.addEventListener("click", () => runAction(() => client.createRoom(FOUR_ARMY_GAME_TYPE)));
elements.joinForm.addEventListener("submit", (event) => {
  event.preventDefault();
  runAction(() => client.joinRoom(elements.roomCode.value, FOUR_ARMY_GAME_TYPE));
});
elements.roomCode.addEventListener("input", () => {
  elements.roomCode.value = elements.roomCode.value.replace(/\D/g, "").slice(0, 6);
});
elements.copyRoomCode.addEventListener("click", copyRoomCode);
elements.gameRoomCode.addEventListener("click", copyRoomCode);
elements.leaveRoom.addEventListener("click", leaveRoom);
elements.gameLeaveRoom.addEventListener("click", leaveRoom);
elements.leaveOtherRoom.addEventListener("click", leaveRoom);
elements.addBotButton.addEventListener("click", () => runAction(() => client.addBot()));
elements.roomPlayers.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove-bot]");
  if (button) runAction(() => client.removeBot(button.dataset.removeBot));
});
elements.readyButton.addEventListener("click", () => runAction(() => client.ready(!currentPlayer()?.ready)));
elements.startButton.addEventListener("click", () => runAction(() => client.startGame()));
elements.deploymentSchemes.addEventListener("click", (event) => {
  const button = event.target.closest("[data-deployment-scheme]");
  const state = room?.gameState;
  const me = currentPlayer();
  if (!button || !state || !me || state.phase !== "deployment" || deploymentConfirmed(state)) return;
  deploymentSchemeId = button.dataset.deploymentScheme;
  deploymentDraft = buildArmyDeploymentPlacements(state.pieces, me.seat, deploymentSchemeId);
  deploymentSwapPieceId = null;
  renderDeploymentPanel();
  renderGameHud();
  drawBoard();
});
elements.confirmDeployment.addEventListener("click", () => {
  const state = room?.gameState;
  if (!state || !deploymentDraft || !deploymentSchemeId || deploymentConfirmed(state)) return;
  runAction(() => client.confirmArmyDeployment(deploymentDraft, deploymentSchemeId, state.version));
});
elements.annotationMenu.addEventListener("click", (event) => {
  if (event.target.closest("[data-close-annotation]")) {
    annotationPieceId = null;
    elements.annotationMenu.hidden = true;
    return;
  }
  const button = event.target.closest("[data-annotation]");
  if (!button || !annotationPieceId) return;
  const label = button.dataset.annotation;
  if (label) annotations[annotationPieceId] = label;
  else delete annotations[annotationPieceId];
  saveAnnotations();
  annotationPieceId = null;
  elements.annotationMenu.hidden = true;
  drawBoard();
});
elements.armyBoard.addEventListener("pointerdown", () => ensureAudioContext());
elements.armyBoard.addEventListener("pointerup", (event) => {
  const rect = elements.armyBoard.getBoundingClientRect();
  const x = (event.clientX - rect.left) * elements.armyBoard.width / rect.width;
  const y = (event.clientY - rect.top) * elements.armyBoard.height / rect.height;
  const target = boardRenderer.hitTest(x, y);
  if (target) selectBoardTarget(target);
});
elements.openReplay.addEventListener("click", openReplay);
elements.closeReplay.addEventListener("click", closeReplay);
elements.replayPrevious.addEventListener("click", () => replayController.previous());
elements.replayNext.addEventListener("click", () => replayController.next());
elements.replayPlay.addEventListener("click", () => replaySnapshot?.playing ? replayController.pause() : replayController.play());
elements.replayRange.addEventListener("input", () => replayController.setStep(elements.replayRange.value));
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && client) {
    if (client.connected) client.reconnect().catch(() => {});
    else client.connect();
  }
});
globalThis.addEventListener("beforeunload", () => client?.close());

function pulseLoop(now) {
  if (room?.gameState && !animationLocked && !replayOpen && now - lastPulseDraw > 50) {
    lastPulseDraw = now;
    updateCountdown();
    drawBoard();
  }
  requestAnimationFrame(pulseLoop);
}

previewRenderer.draw(null);
requestAnimationFrame(pulseLoop);
render();
connect();
