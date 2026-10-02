// @ts-check

(function () {
  "use strict";

  function socketUrl() {
    const override = globalThis.localStorage?.getItem("crediusArcade.multiplayerServerUrl.v1");
    if (override) {
      return override;
    }
    const protocol = globalThis.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${globalThis.location.host}/multiplayer`;
  }

  class MultiplayerClient extends EventTarget {
    constructor(identity) {
      super();
      this.identity = identity;
      this.socket = null;
      this.room = null;
      this.connected = false;
      this.closedByUser = false;
      this.retryCount = 0;
      this.pending = new Map();
      this.reconnectTimer = 0;
    }

    connect() {
      if (this.socket && [WebSocket.OPEN, WebSocket.CONNECTING].includes(this.socket.readyState)) {
        return;
      }
      this.closedByUser = false;
      const socket = new WebSocket(socketUrl());
      this.socket = socket;
      socket.addEventListener("open", async () => {
        try {
          const welcome = await this.request("HELLO", { identity: this.identity }, 8_000);
          this.connected = true;
          this.retryCount = 0;
          this.room = welcome.room ?? null;
          this.emit("connection", { connected: true });
          this.emit("room", { room: this.room });
        } catch (error) {
          this.emit("error", { error });
        }
      });
      socket.addEventListener("message", (event) => this.handleMessage(event.data));
      socket.addEventListener("close", () => {
        this.connected = false;
        this.emit("connection", { connected: false });
        for (const [requestId, pending] of this.pending) {
          clearTimeout(pending.timer);
          pending.reject(new Error("连接已中断，正在尝试重连。"));
          this.pending.delete(requestId);
        }
        if (!this.closedByUser) {
          this.scheduleReconnect();
        }
      });
      socket.addEventListener("error", () => {
        this.emit("connection", { connected: false });
      });
    }

    close() {
      this.closedByUser = true;
      clearTimeout(this.reconnectTimer);
      this.socket?.close(1000, "client closed");
    }

    scheduleReconnect() {
      clearTimeout(this.reconnectTimer);
      const delay = Math.min(10_000, 600 * 2 ** Math.min(this.retryCount, 4));
      this.retryCount += 1;
      this.reconnectTimer = globalThis.setTimeout(() => this.connect(), delay);
    }

    updateIdentity(identity) {
      this.identity = identity;
      if (this.connected) {
        return this.request("HELLO", { identity });
      }
      this.connect();
      return Promise.resolve(null);
    }

    handleMessage(raw) {
      let message;
      try {
        message = JSON.parse(raw);
      } catch {
        return;
      }
      if (message.type === "ROOM_STATE") {
        this.room = message.room;
        this.emit("room", { room: this.room });
        return;
      }
      if (message.type === "ROOM_LEFT") {
        this.room = null;
        this.emit("room", { room: null });
        return;
      }
      if (message.room !== undefined) {
        this.room = message.room;
      }
      const pending = message.requestId ? this.pending.get(message.requestId) : null;
      if (pending) {
        clearTimeout(pending.timer);
        this.pending.delete(message.requestId);
        if (message.type === "ERROR") {
          const error = new Error(message.error?.message || "操作失败。");
          error.code = message.error?.code;
          pending.reject(error);
        } else {
          pending.resolve(message);
        }
      } else if (message.type === "ERROR") {
        const error = new Error(message.error?.message || "操作失败。");
        error.code = message.error?.code;
        this.emit("error", { error });
      }
    }

    request(type, payload = {}, timeout = 6_000) {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
        return Promise.reject(new Error("联机服务尚未连接。"));
      }
      const requestId = globalThis.crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
      return new Promise((resolve, reject) => {
        const timer = globalThis.setTimeout(() => {
          this.pending.delete(requestId);
          reject(new Error("服务端响应超时，请检查网络后重试。"));
        }, timeout);
        this.pending.set(requestId, { resolve, reject, timer });
        this.socket.send(JSON.stringify({ type, requestId, ...payload }));
      });
    }

    createRoom(gameType = "ludo") {
      return this.request("CREATE_ROOM", { gameType });
    }

    joinRoom(roomCode, gameType = null) {
      return this.request("JOIN_ROOM", { roomCode, gameType });
    }

    leaveRoom() {
      return this.request("LEAVE_ROOM");
    }

    ready(ready) {
      return this.request("READY", { ready });
    }

    addBot() {
      return this.request("ADD_BOT");
    }

    removeBot(botPlayerId) {
      return this.request("REMOVE_BOT", { botPlayerId });
    }

    startGame() {
      return this.request("START_GAME");
    }

    reconnect() {
      return this.request("RECONNECT");
    }

    endGame() {
      return this.request("END_GAME");
    }

    resetRoom() {
      return this.request("RESET_ROOM");
    }

    rollDice(expectedVersion) {
      return this.request("GAME_ACTION", {
        action: { type: "ROLL_DICE", expectedVersion },
      });
    }

    movePiece(pieceId, expectedVersion) {
      return this.request("GAME_ACTION", {
        action: { type: "MOVE_PIECE", pieceId, expectedVersion },
      });
    }

    moveArmyPiece(pieceId, toNodeId, expectedVersion) {
      return this.request("GAME_ACTION", {
        action: { type: "MOVE_ARMY_PIECE", pieceId, toNodeId, expectedVersion },
      });
    }

    confirmArmyDeployment(placements, schemeId, expectedVersion) {
      return this.request("GAME_ACTION", {
        action: { type: "CONFIRM_ARMY_DEPLOYMENT", placements, schemeId, expectedVersion },
      });
    }

    emit(type, detail) {
      this.dispatchEvent(new CustomEvent(type, { detail }));
    }
  }

  globalThis.CrediusMultiplayer = {
    MultiplayerClient,
    socketUrl,
  };
})();
