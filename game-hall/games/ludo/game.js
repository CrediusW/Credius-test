// @ts-check

import { FlightChessAnimationController, INTERACTION_STATES } from "./animationController.js";
import {
  BOARD_COLORS,
  BOARD_COLOR_NAMES,
  FlightChessBoardRenderer,
} from "./boardRenderer.js";

const AVATAR_LABELS = {
  mint: "薄荷",
  coral: "珊瑚",
  sun: "暖阳",
  sky: "晴空",
  violet: "紫藤",
  graphite: "石墨",
};

const elements = {
  backLobby: document.getElementById("backLobby"),
  connectionState: document.getElementById("connectionState"),
  rulesButton: document.getElementById("rulesButton"),
  profileButton: document.getElementById("profileButton"),
  profileAvatar: document.getElementById("profileAvatar"),
  profileName: document.getElementById("profileName"),
  entryScreen: document.getElementById("entryScreen"),
  previewBoard: /** @type {HTMLCanvasElement} */ (document.getElementById("previewBoard")),
  createRoom: document.getElementById("createRoom"),
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
  ludoBoard: /** @type {HTMLCanvasElement} */ (document.getElementById("ludoBoard")),
  gameRoomCode: document.getElementById("gameRoomCode"),
  gameLeaveRoom: document.getElementById("gameLeaveRoom"),
  turnPlayers: document.getElementById("turnPlayers"),
  turnLabel: document.getElementById("turnLabel"),
  dice: /** @type {HTMLButtonElement} */ (document.getElementById("dice")),
  actionLabel: document.getElementById("actionLabel"),
  rollDice: /** @type {HTMLButtonElement} */ (document.getElementById("rollDice")),
  pieceChoices: document.getElementById("pieceChoices"),
  winnerOverlay: document.getElementById("winnerOverlay"),
  winnerText: document.getElementById("winnerText"),
  playAgain: /** @type {HTMLButtonElement} */ (document.getElementById("playAgain")),
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
let toastTimer = 0;
let receivedInitialRoomState = false;
let lastPulseDraw = 0;

const debugMode = new URLSearchParams(location.search).get("debugFlightChess") === "true";
const previewRenderer = new FlightChessBoardRenderer(elements.previewBoard, { debugMode });
const boardRenderer = new FlightChessBoardRenderer(elements.ludoBoard, { debugMode });
const animationController = new FlightChessAnimationController({
  reducedMotion: globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches,
  onFrame: renderAnimationFrame,
  onPhase: renderGameHud,
  onAction: announceAction,
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

function avatarMarkup(player, sizeClass = "") {
  return `<span class="avatar avatar-${player.avatar} ${sizeClass}">${player.isBot ? "AI" : escapeHtml(initials(player.nickname))}</span>`;
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
  }, 2400);
}

function announceAction(action) {
  if (action.tripleSixPenalty) showToast("连续三次掷出 6，本回合飞机返航");
  else if (action.flew) showToast("命中飞行线，跨越棋盘");
  else if (action.jumped) showToast("落在同色格，自动跳跃");
  else if (action.capturedPieceIds?.length) showToast("撞机，对方返回机场");
  else if (action.bounced) showToast("超过终点，按剩余步数反弹");
}

function setBusy(value) {
  busy = value;
  render();
}

async function runAction(action) {
  if (busy || animationController.locked || !client) return null;
  setBusy(true);
  try {
    const response = await action();
    if (response?.room !== undefined) room = response.room;
    render();
    return response;
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
  client.addEventListener("room", (event) => {
    room = event.detail.room;
    animationController.syncRoom(room, { animate: receivedInitialRoomState });
    receivedInitialRoomState = true;
    render();
  });
  client.addEventListener("error", (event) => showToast(event.detail.error.message));
  client.connect();
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
    <button
      class="avatar-choice avatar-${avatar} ${selectedAvatar === avatar ? "selected" : ""}"
      type="button"
      data-avatar="${avatar}"
      aria-label="${AVATAR_LABELS[avatar]}头像"
      aria-pressed="${selectedAvatar === avatar}"
    ></button>
  `).join("");
}

function currentPlayer() {
  return room?.players.find((player) => player.playerId === identity.playerId) ?? null;
}

function render() {
  elements.profileAvatar.className = `avatar avatar-${identity.avatar}`;
  elements.profileAvatar.textContent = initials(identity.nickname);
  elements.profileName.textContent = identity.nickname || "玩家";
  const waiting = room?.status === "waiting";
  const inGame = room?.status === "playing" || room?.status === "finished";
  elements.entryScreen.hidden = Boolean(room);
  elements.roomScreen.hidden = !waiting;
  elements.gameScreen.hidden = !inGame;
  if (waiting) renderWaitingRoom();
  if (inGame) renderGame();
}

function renderWaitingRoom() {
  const me = currentPlayer();
  const activePlayers = room.players;
  const isHost = room.hostId === identity.playerId;
  elements.roomCodeValue.textContent = room.code;
  elements.roomPlayers.innerHTML = Array.from({ length: 4 }, (_, seat) => {
    const player = activePlayers.find((item) => item.seat === seat);
    if (!player) return `<div class="room-player empty"><span>${BOARD_COLOR_NAMES[seat]}座位</span></div>`;
    const remove = isHost && player.isBot
      ? `<button class="remove-bot" type="button" data-remove-bot="${escapeHtml(player.playerId)}" aria-label="移除机器人 ${escapeHtml(player.nickname)}" title="移除机器人">×</button>`
      : "";
    return `
      <article class="room-player" style="--player-color:${BOARD_COLORS[seat]}">
        ${remove}
        <div class="room-player-head">
          ${avatarMarkup(player)}
          <div>
            <strong>${escapeHtml(player.nickname)}</strong>
            <small>${player.isBot ? "机器人" : player.playerId === room.hostId ? "房主" : BOARD_COLOR_NAMES[seat]}</small>
          </div>
        </div>
        <div class="room-player-state">
          <span class="${player.online ? "" : "offline"}">${player.isBot ? "自动行动" : player.online ? "在线" : "离线"}</span>
          <span class="${player.ready ? "ready" : ""}">${player.ready ? "已准备" : "未准备"}</span>
        </div>
      </article>
    `;
  }).join("");
  elements.readyButton.textContent = me?.ready ? "取消准备" : "准备";
  elements.readyButton.disabled = busy;
  elements.addBotButton.hidden = !isHost || room.players.length >= 4;
  elements.addBotButton.disabled = busy;
  elements.startButton.hidden = !isHost;
  const humansReady = room.players.filter((player) => !player.isBot).every((player) => player.ready && player.online);
  const canStart = room.players.length >= 2 && humansReady;
  elements.startButton.disabled = busy || !canStart;
  elements.roomHint.textContent = room.players.length < 2
    ? (isHost ? "邀请朋友，或添加机器人" : "等待其他玩家加入")
    : canStart
      ? (isHost ? "席位就绪，可以开始" : "等待房主开始")
      : "等待真人玩家准备";
}

function renderGame() {
  const state = room.gameState;
  if (!state) return;
  elements.gameRoomCode.textContent = room.code;
  elements.turnPlayers.innerHTML = room.players.map((player) => {
    const finished = state.pieces.filter((piece) => piece.playerId === player.playerId && piece.status === "finished").length;
    const displayTurnId = animationController.snapshot().currentAction?.playerId ?? state.turnPlayerId;
    return `
      <div class="turn-player ${player.playerId === displayTurnId ? "active" : ""}" style="--player-color:${BOARD_COLORS[player.seat]}">
        ${avatarMarkup(player)}
        <strong>${escapeHtml(player.nickname)}</strong>
        <small>${finished}/4${player.isBot ? " · AI" : player.online ? "" : " · 离线"}</small>
      </div>
    `;
  }).join("");
  renderGameHud();
  drawGameBoard();

  const winner = room.players.find((player) => player.playerId === state.winnerId);
  elements.winnerOverlay.hidden = state.status !== "finished" || animationController.locked;
  if (state.status === "finished") {
    elements.winnerText.textContent = winner ? `${winner.nickname}率先完成全部航程` : "房主结束了本局";
    elements.playAgain.hidden = room.hostId !== identity.playerId;
    recordFinishedGame(state, winner?.playerId === identity.playerId);
  }
}

function renderGameHud() {
  const state = room?.gameState;
  if (!state) return;
  const visual = animationController.snapshot();
  const actionPlayerId = visual.currentAction?.playerId ?? state.turnPlayerId;
  const turnPlayer = room.players.find((player) => player.playerId === actionPlayerId);
  const isMyTurn = state.turnPlayerId === identity.playerId && state.status === "playing";
  elements.turnLabel.textContent = animationController.locked
    ? `${turnPlayer?.nickname ?? "玩家"}正在行动`
    : isMyTurn ? "轮到你了" : `${turnPlayer?.nickname ?? "玩家"}的回合`;
  const inputLocked = busy || animationController.locked;
  elements.dice.dataset.value = String(visual.diceValue || 0);
  elements.dice.classList.toggle("rolling", visual.diceRolling);
  elements.dice.disabled = inputLocked || !isMyTurn || state.phase !== "await-roll" || state.status !== "playing";
  elements.dice.setAttribute("aria-label", visual.diceRolling ? "骰子滚动中" : visual.diceValue ? `骰子 ${visual.diceValue} 点` : "骰子尚未掷出");
  elements.rollDice.hidden = state.phase !== "await-roll" || state.status !== "playing";
  elements.rollDice.disabled = inputLocked || !isMyTurn;
  elements.actionLabel.textContent = actionText(visual.phase, state, isMyTurn, turnPlayer);
  const canChoose = state.phase === "await-move" && isMyTurn && !inputLocked;
  elements.pieceChoices.innerHTML = canChoose
    ? state.movablePieceIds.map((pieceId) => {
        const pieceNumber = Number(pieceId.split(":").at(-1)) + 1;
        return `<button type="button" data-piece-id="${escapeHtml(pieceId)}">${pieceNumber} 号</button>`;
      }).join("")
    : "";
}

function actionText(phase, state, isMyTurn, turnPlayer) {
  if (state.status === "finished") return "本局已经完成";
  if (phase === INTERACTION_STATES.ROLLING) return "骰子滚动中";
  if (phase === INTERACTION_STATES.MOVING) return "飞机正在逐格前进";
  if (phase === INTERACTION_STATES.JUMPING) return "命中同色格，准备跳跃";
  if (phase === INTERACTION_STATES.FLYING) return "进入飞行航线";
  if (phase === INTERACTION_STATES.CAPTURING) return "发生撞机，飞机返航";
  if (phase === INTERACTION_STATES.TURN_END) return "回合结束";
  if (turnPlayer?.isBot) return `${turnPlayer.nickname}正在选择航线`;
  if (state.phase === "await-roll") return isMyTurn ? "点击骰子开始本回合" : `等待${turnPlayer?.nickname ?? "对手"}掷骰子`;
  if (state.phase === "await-move") {
    if (!isMyTurn) return `等待${turnPlayer?.nickname ?? "对手"}选择飞机`;
    return state.movablePieceIds.length === 1 ? `掷出 ${state.dice} 点，请点击发光的飞机` : `掷出 ${state.dice} 点，选择一架飞机`;
  }
  return "同步棋局中";
}

function drawGameBoard() {
  const state = room?.gameState;
  if (!state) return;
  const visual = animationController.snapshot();
  const isMyTurn = state.turnPlayerId === identity.playerId && state.status === "playing";
  const waitingForPiece = visual.phase === INTERACTION_STATES.WAITING_FOR_PIECE && state.phase === "await-move";
  boardRenderer.draw(room, {
    ...visual,
    inputEnabled: waitingForPiece && isMyTurn && !busy && !animationController.locked,
    waitingForPiece,
    movablePieceIds: new Set(state.movablePieceIds),
    turnPlayerId: state.turnPlayerId,
  });
}

function renderAnimationFrame() {
  if (!room?.gameState) return;
  const visual = animationController.snapshot();
  elements.dice.dataset.value = String(visual.diceValue || 0);
  elements.dice.classList.toggle("rolling", visual.diceRolling);
  elements.winnerOverlay.hidden = room.gameState.status !== "finished" || animationController.locked;
  drawGameBoard();
}

function pulseLoop(now) {
  if (room?.gameState && !animationController.locked && room.gameState.phase === "await-move" && now - lastPulseDraw > 45) {
    lastPulseDraw = now;
    drawGameBoard();
  }
  requestAnimationFrame(pulseLoop);
}

function recordFinishedGame(state, won) {
  const key = `crediusArcade.ludoRecorded.${room.code}.${state.startedAt}`;
  if (globalThis.sessionStorage.getItem(key)) return;
  const record = globalThis.CrediusArcadeStorage.getGameRecord("ludo");
  const wins = record.highScore + (won ? 1 : 0);
  const duration = Math.max(1, Math.round((Date.now() - Date.parse(state.startedAt)) / 1000));
  globalThis.CrediusArcadeStorage.saveGameResult("ludo", { score: wins, duration, level: 1 });
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
elements.profileForm.addEventListener("submit", async (event) => {
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
elements.createRoom.addEventListener("click", () => runAction(() => client.createRoom("ludo")));
elements.joinForm.addEventListener("submit", (event) => {
  event.preventDefault();
  runAction(() => client.joinRoom(elements.roomCode.value, "ludo"));
});
elements.roomCode.addEventListener("input", () => {
  elements.roomCode.value = elements.roomCode.value.replace(/\D/g, "").slice(0, 6);
});
elements.copyRoomCode.addEventListener("click", copyRoomCode);
elements.gameRoomCode.addEventListener("click", copyRoomCode);
elements.leaveRoom.addEventListener("click", leaveRoom);
elements.gameLeaveRoom.addEventListener("click", leaveRoom);
elements.addBotButton.addEventListener("click", () => runAction(() => client.addBot()));
elements.roomPlayers.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove-bot]");
  if (button) runAction(() => client.removeBot(button.dataset.removeBot));
});
elements.readyButton.addEventListener("click", () => runAction(() => client.ready(!currentPlayer()?.ready)));
elements.startButton.addEventListener("click", () => runAction(() => client.startGame()));
elements.rollDice.addEventListener("click", () => {
  if (room?.gameState) runAction(() => client.rollDice(room.gameState.version));
});
elements.dice.addEventListener("click", () => {
  if (room?.gameState) runAction(() => client.rollDice(room.gameState.version));
});
elements.pieceChoices.addEventListener("click", (event) => {
  const button = event.target.closest("[data-piece-id]");
  if (button && room?.gameState) runAction(() => client.movePiece(button.dataset.pieceId, room.gameState.version));
});
elements.ludoBoard.addEventListener("pointerup", (event) => {
  if (!room?.gameState || busy || animationController.locked) return;
  const rect = elements.ludoBoard.getBoundingClientRect();
  const x = (event.clientX - rect.left) * elements.ludoBoard.width / rect.width;
  const y = (event.clientY - rect.top) * elements.ludoBoard.height / rect.height;
  const target = boardRenderer.hitTest(x, y);
  if (target) runAction(() => client.movePiece(target.pieceId, room.gameState.version));
});
elements.playAgain.addEventListener("click", () => runAction(() => client.resetRoom()));
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && client) {
    if (client.connected) client.reconnect().catch(() => {});
    else client.connect();
  }
});
globalThis.addEventListener("beforeunload", () => client?.close());

previewRenderer.draw(null);
requestAnimationFrame(pulseLoop);
render();
connect();
