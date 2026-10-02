export const INTERACTION_STATES = Object.freeze({
  WAITING_FOR_ROLL: "WAITING_FOR_ROLL",
  ROLLING: "ROLLING",
  WAITING_FOR_PIECE: "WAITING_FOR_PIECE",
  MOVING: "MOVING",
  JUMPING: "JUMPING",
  FLYING: "FLYING",
  CAPTURING: "CAPTURING",
  TURN_END: "TURN_END",
  FINISHED: "FINISHED",
});

function clamp(value, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value));
}

export class FlightChessAnimationController {
  constructor({ onFrame = () => {}, onPhase = () => {}, onAction = () => {}, reducedMotion = false } = {}) {
    this.onFrame = onFrame;
    this.onPhase = onPhase;
    this.onAction = onAction;
    this.reducedMotion = reducedMotion;
    this.phase = INTERACTION_STATES.WAITING_FOR_ROLL;
    this.overrides = new Map();
    this.effects = [];
    this.diceValue = 0;
    this.diceRolling = false;
    this.queue = [];
    this.playing = false;
    this.currentAction = null;
    this.lastSeenActionId = "";
    this.latestRoom = null;
  }

  get locked() {
    return this.playing || this.queue.length > 0;
  }

  snapshot() {
    return {
      phase: this.phase,
      locked: this.locked,
      overrides: this.overrides,
      effects: this.effects,
      diceValue: this.diceValue,
      diceRolling: this.diceRolling,
      currentAction: this.currentAction,
      now: performance.now(),
    };
  }

  syncRoom(room, { animate = true } = {}) {
    this.latestRoom = room;
    const action = room?.gameState?.lastAction;
    if (!action || action.id === this.lastSeenActionId) {
      if (!this.locked) this.syncLogicalPhase();
      this.onFrame();
      return;
    }
    this.lastSeenActionId = action.id;
    if (!animate) {
      this.diceValue = room?.gameState?.dice ?? 0;
      this.syncLogicalPhase();
      this.onFrame();
      return;
    }
    this.queue.push({ action, room });
    this.playQueue().catch(() => {
      this.queue = [];
      this.playing = false;
      this.currentAction = null;
      this.overrides.clear();
      this.effects = [];
      this.syncLogicalPhase();
      this.onFrame();
    });
  }

  syncLogicalPhase() {
    const state = this.latestRoom?.gameState;
    if (!state || state.status === "finished") {
      this.setPhase(state ? INTERACTION_STATES.FINISHED : INTERACTION_STATES.WAITING_FOR_ROLL);
    } else if (state.phase === "await-move") {
      this.setPhase(INTERACTION_STATES.WAITING_FOR_PIECE);
    } else {
      this.setPhase(INTERACTION_STATES.WAITING_FOR_ROLL);
    }
    this.diceValue = state?.dice ?? this.diceValue;
  }

  setPhase(phase) {
    if (this.phase === phase) return;
    this.phase = phase;
    this.onPhase(phase);
  }

  scaledDuration(milliseconds) {
    return this.reducedMotion ? Math.min(80, milliseconds * 0.18) : milliseconds;
  }

  async playQueue() {
    if (this.playing) return;
    this.playing = true;
    while (this.queue.length) {
      const item = this.queue.shift();
      this.latestRoom = item.room;
      await this.playAction(item.action);
    }
    this.playing = false;
    this.currentAction = null;
    this.overrides.clear();
    this.effects = [];
    this.syncLogicalPhase();
    this.onFrame();
  }

  prepareOverrides(action) {
    const firstPieceSegment = action.sequence?.find((segment) =>
      ["TAKEOFF", "MOVE", "JUMP", "FLIGHT"].includes(segment.type) && segment.pieceId === action.pieceId,
    );
    if (firstPieceSegment?.from) this.overrides.set(action.pieceId, firstPieceSegment.from);
    for (const segment of action.sequence ?? []) {
      if (segment.type === "RETURN" && segment.from) this.overrides.set(segment.pieceId, segment.from);
    }
  }

  async playAction(action) {
    this.currentAction = action;
    this.prepareOverrides(action);
    this.onAction(action);
    for (const segment of action.sequence ?? []) {
      if (segment.type === "ROLL") await this.playRoll(segment);
      else if (segment.type === "TAKEOFF") await this.playDirectMove(segment, INTERACTION_STATES.MOVING, { arc: 0.65, scaleBoost: 0.08 });
      else if (segment.type === "MOVE") await this.playStepMove(segment);
      else if (segment.type === "JUMP") await this.playJump(segment);
      else if (segment.type === "FLIGHT") await this.playFlight(segment);
      else if (segment.type === "CAPTURE") await this.playCapture(segment, action);
      else if (segment.type === "RETURN") await this.playReturn(segment);
      else if (segment.type === "FINISH") await this.playFinish(segment);
      else if (segment.type === "TURN_END") await this.playTurnEnd();
    }
  }

  async playRoll(segment) {
    this.setPhase(INTERACTION_STATES.ROLLING);
    this.diceRolling = true;
    this.diceValue = 1;
    const duration = this.scaledDuration(segment.durationMs ?? 650);
    await this.animate(duration, (progress) => {
      this.diceValue = (Math.floor(progress * 18) % 6) + 1;
    });
    this.diceValue = segment.dice;
    this.diceRolling = false;
    this.onFrame();
    await this.sleep(this.scaledDuration(110));
  }

  async playStepMove(segment) {
    this.setPhase(INTERACTION_STATES.MOVING);
    let from = segment.from;
    for (const destination of segment.path ?? []) {
      await this.tweenPiece(segment.pieceId, from, destination, segment.durationPerStepMs ?? 145, {
        arc: 0.09,
        scaleBoost: 0.035,
      });
      from = destination;
      this.overrides.set(segment.pieceId, destination);
      this.onFrame();
    }
  }

  async playJump(segment) {
    this.setPhase(INTERACTION_STATES.JUMPING);
    await this.sleep(this.scaledDuration(segment.pauseMs ?? 210));
    await this.tweenPiece(segment.pieceId, segment.from, segment.to, segment.durationMs ?? 440, {
      arc: 0.72,
      scaleBoost: 0.12,
      rotation: 0.16,
      style: "jump",
    });
    this.overrides.set(segment.pieceId, segment.to);
  }

  async playFlight(segment) {
    this.setPhase(INTERACTION_STATES.FLYING);
    await this.sleep(this.scaledDuration(segment.pauseMs ?? 240));
    await this.tweenPiece(segment.pieceId, segment.from, segment.to, segment.durationMs ?? 620, {
      arc: 0.34,
      scaleBoost: 0.2,
      rotation: 0.3,
      style: "flight",
    });
    this.overrides.set(segment.pieceId, segment.to);
  }

  async playCapture(segment, action) {
    this.setPhase(INTERACTION_STATES.CAPTURING);
    const victimIds = segment.capturedPieceIds ?? [];
    const victimReturns = (action.sequence ?? []).filter((item) => item.type === "RETURN" && victimIds.includes(item.pieceId));
    victimReturns.forEach((item) => {
      this.overrides.set(item.pieceId, {
        zone: "transition",
        from: item.from,
        to: item.from,
        progress: 0,
        shake: 0,
      });
    });
    this.effects = [{ type: "capture", at: segment.at, progress: 0 }];
    const duration = this.scaledDuration(segment.durationMs ?? 300);
    await this.animate(duration, (progress) => {
      this.effects[0].progress = progress;
      victimReturns.forEach((item) => {
        this.overrides.set(item.pieceId, {
          zone: "transition",
          from: item.from,
          to: item.from,
          progress,
          shake: Math.sin(progress * Math.PI * 8) * (1 - progress) * 0.13,
        });
      });
    });
    this.effects = [];
    victimReturns.forEach((item) => this.overrides.set(item.pieceId, item.from));
  }

  async playReturn(segment) {
    this.setPhase(INTERACTION_STATES.CAPTURING);
    await this.tweenPiece(segment.pieceId, segment.from, segment.to, segment.durationMs ?? 430, {
      arc: 1.05,
      scaleBoost: 0.12,
      rotation: -0.34,
      style: "flight",
    });
    this.overrides.set(segment.pieceId, segment.to);
  }

  async playFinish(segment) {
    this.effects = [{ type: "finish", at: segment.at, progress: 0 }];
    const duration = this.scaledDuration(segment.durationMs ?? 620);
    await this.animate(duration, (progress) => {
      this.effects[0].progress = progress;
    });
    this.effects = [];
  }

  async playTurnEnd() {
    this.setPhase(INTERACTION_STATES.TURN_END);
    await this.sleep(this.scaledDuration(180));
  }

  async playDirectMove(segment, phase, options) {
    this.setPhase(phase);
    await this.tweenPiece(segment.pieceId, segment.from, segment.to, segment.durationMs ?? 420, options);
    this.overrides.set(segment.pieceId, segment.to);
  }

  async tweenPiece(pieceId, from, to, durationMs, options = {}) {
    const duration = this.scaledDuration(durationMs);
    await this.animate(duration, (progress) => {
      this.overrides.set(pieceId, {
        zone: "transition",
        from,
        to,
        progress,
        arc: options.arc ?? 0,
        scaleBoost: options.scaleBoost ?? 0,
        rotation: options.rotation ?? 0,
        style: options.style ?? "move",
        shake: 0,
      });
    });
  }

  animate(duration, update) {
    if (duration <= 0) {
      update(1);
      this.onFrame();
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const startedAt = performance.now();
      const frame = (now) => {
        const progress = clamp((now - startedAt) / duration);
        update(progress);
        this.onFrame();
        if (progress < 1) requestAnimationFrame(frame);
        else resolve();
      };
      requestAnimationFrame(frame);
    });
  }

  sleep(duration) {
    if (duration <= 0) return Promise.resolve();
    return new Promise((resolve) => globalThis.setTimeout(resolve, duration));
  }
}
