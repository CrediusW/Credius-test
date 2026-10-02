export function reconstructReplay(replay, step) {
  const pieces = structuredClone(replay?.initialPieces ?? []);
  const moves = replay?.moves ?? [];
  const count = Math.max(0, Math.min(Number(step) || 0, moves.length));
  for (const move of moves.slice(0, count)) {
    if (move.pieceId) {
      const piece = pieces.find((item) => item.id === move.pieceId);
      if (piece) {
        piece.nodeId = move.toNodeId;
        piece.moved = true;
      }
    }
    for (const pieceId of move.removedPieceIds ?? []) {
      const removed = pieces.find((item) => item.id === pieceId);
      if (removed) {
        removed.alive = false;
        removed.nodeId = null;
      }
    }
  }
  return { pieces, step: count, move: count > 0 ? moves[count - 1] : null };
}

export class ArmyReplayController {
  constructor({ onChange = () => {} } = {}) {
    this.onChange = onChange;
    this.replay = null;
    this.step = 0;
    this.timer = 0;
  }

  get total() {
    return this.replay?.moves?.length ?? 0;
  }

  load(replay) {
    this.pause();
    this.replay = replay;
    this.step = 0;
    this.emit();
  }

  setStep(step) {
    this.step = Math.max(0, Math.min(Number(step) || 0, this.total));
    this.emit();
  }

  previous() {
    this.pause();
    this.setStep(this.step - 1);
  }

  next() {
    this.pause();
    this.setStep(this.step + 1);
  }

  play() {
    if (!this.replay || this.timer) return;
    if (this.step >= this.total) this.step = 0;
    this.timer = globalThis.setInterval(() => {
      if (this.step >= this.total) {
        this.pause();
        return;
      }
      this.step += 1;
      this.emit();
    }, 850);
    this.emit();
  }

  pause() {
    if (this.timer) globalThis.clearInterval(this.timer);
    this.timer = 0;
    this.emit();
  }

  emit() {
    this.onChange({
      ...reconstructReplay(this.replay, this.step),
      total: this.total,
      playing: Boolean(this.timer),
    });
  }
}
