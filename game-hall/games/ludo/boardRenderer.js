import {
  CELL_TYPES,
  FINISH_CELL,
  FLIGHT_ROUTE_BY_SEAT,
  HANGAR_POSITIONS_BY_SEAT,
  HOME_ROUTE_START_STEP,
  HOME_PATHS,
  MAIN_PATH,
  PLAYER_COLORS,
  TAKEOFF_CELLS,
  cellForPlayerStep,
  debugLabelForCell,
} from "../../src/flightChessBoardMap.js";

export const BOARD_COLORS = ["#ee5c64", "#4388df", "#3fb174", "#efb83e"];
export const BOARD_DARK_COLORS = ["#9e2733", "#235995", "#207348", "#956611"];
export const BOARD_LIGHT_COLORS = ["#ffd9d9", "#d8e9fb", "#d5f1df", "#fbe8b7"];
export const BOARD_COLOR_NAMES = ["红方", "蓝方", "绿方", "黄方"];

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

function easeOutCubic(value) {
  return 1 - (1 - value) ** 3;
}

function lerp(left, right, progress) {
  return left + (right - left) * progress;
}

export class FlightChessBoardRenderer {
  constructor(canvas, { debugMode = false } = {}) {
    this.canvas = canvas;
    this.debugMode = debugMode;
    this.hitTargets = [];
  }

  draw(boardRoom, visual = {}) {
    const ctx = this.canvas.getContext("2d");
    const size = this.canvas.width;
    const cell = size / 15;
    ctx.clearRect(0, 0, size, size);
    this.drawSurface(ctx, size, cell);
    this.drawHangars(ctx, cell);
    this.drawFlightLines(ctx, cell);
    this.drawMainPath(ctx, cell);
    this.drawTakeoffPads(ctx, cell);
    this.drawHomePaths(ctx, cell);
    this.drawCenter(ctx, cell);
    if (this.debugMode) this.drawDebugMap(ctx, cell);

    const state = boardRoom?.gameState;
    if (!state) {
      this.drawPreviewPieces(ctx, cell);
      this.hitTargets = [];
      return;
    }
    this.drawPieces(ctx, cell, state, visual);
    this.drawEffects(ctx, cell, visual.effects ?? []);
  }

  hitTest(x, y) {
    return this.hitTargets.find((target) => Math.hypot(target.x - x, target.y - y) <= target.radius) ?? null;
  }

  drawSurface(ctx, size, cell) {
    const backdrop = ctx.createLinearGradient(0, 0, size, size);
    backdrop.addColorStop(0, "#e7eee8");
    backdrop.addColorStop(1, "#cbd9d0");
    ctx.fillStyle = backdrop;
    ctx.fillRect(0, 0, size, size);
    ctx.shadowColor = "rgba(32,50,42,0.2)";
    ctx.shadowBlur = cell * 0.18;
    roundRect(ctx, cell * 0.16, cell * 0.16, size - cell * 0.32, size - cell * 0.32, cell * 0.16);
    ctx.fillStyle = "#fff9e9";
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.strokeStyle = "#52655c";
    ctx.lineWidth = Math.max(2, cell * 0.05);
    ctx.stroke();
    this.drawCloud(ctx, cell * 7.5, cell * 4.4, cell * 0.46, 0.16);
    this.drawCloud(ctx, cell * 4.4, cell * 7.5, cell * 0.38, 0.13);
    this.drawCloud(ctx, cell * 10.6, cell * 7.5, cell * 0.38, 0.13);
    this.drawCloud(ctx, cell * 7.5, cell * 10.6, cell * 0.46, 0.16);
  }

  drawCloud(ctx, x, y, radius, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#7f9d90";
    for (const [dx, dy, scale] of [[-0.5, 0.1, 0.65], [0, -0.15, 1], [0.55, 0.08, 0.72]]) {
      ctx.beginPath();
      ctx.arc(x + radius * dx, y + radius * dy, radius * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawHangars(ctx, cell) {
    const origins = [[0, 0], [9, 0], [9, 9], [0, 9]];
    origins.forEach(([x, y], seat) => {
      roundRect(ctx, (x + 0.34) * cell, (y + 0.34) * cell, cell * 5.32, cell * 5.32, cell * 0.2);
      const fill = ctx.createLinearGradient(x * cell, y * cell, (x + 5.7) * cell, (y + 5.7) * cell);
      fill.addColorStop(0, BOARD_COLORS[seat]);
      fill.addColorStop(1, BOARD_DARK_COLORS[seat]);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = "rgba(37,57,48,0.52)";
      ctx.lineWidth = cell * 0.045;
      ctx.stroke();
      HANGAR_POSITIONS_BY_SEAT[seat].forEach((position) => {
        ctx.beginPath();
        ctx.arc((position.x + 0.5) * cell, (position.y + 0.5) * cell, cell * 0.43, 0, Math.PI * 2);
        ctx.fillStyle = "#fffaf0";
        ctx.fill();
        ctx.strokeStyle = "rgba(31,45,40,0.42)";
        ctx.lineWidth = cell * 0.038;
        ctx.stroke();
      });
      ctx.fillStyle = "rgba(255,255,255,0.88)";
      ctx.font = `800 ${cell * 0.25}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("机场", (x + 3) * cell, (y + 1.03) * cell);
    });
  }

  drawFlightLines(ctx, cell) {
    FLIGHT_ROUTE_BY_SEAT.forEach((route, seat) => {
      const from = MAIN_PATH[route.entryIndex].position;
      const to = MAIN_PATH[route.exitIndex].position;
      const x1 = (from.x + 0.5) * cell;
      const y1 = (from.y + 0.5) * cell;
      const x2 = (to.x + 0.5) * cell;
      const y2 = (to.y + 0.5) * cell;
      ctx.save();
      ctx.strokeStyle = BOARD_COLORS[seat];
      ctx.lineWidth = cell * 0.13;
      ctx.globalAlpha = 0.82;
      ctx.setLineDash([cell * 0.28, cell * 0.16]);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.setLineDash([]);
      const angle = Math.atan2(y2 - y1, x2 - x1);
      for (const progress of [0.43, 0.7]) {
        ctx.save();
        ctx.translate(lerp(x1, x2, progress), lerp(y1, y2, progress));
        ctx.rotate(angle);
        ctx.fillStyle = BOARD_DARK_COLORS[seat];
        ctx.beginPath();
        ctx.moveTo(cell * 0.2, 0);
        ctx.lineTo(-cell * 0.13, -cell * 0.13);
        ctx.lineTo(-cell * 0.13, cell * 0.13);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    });
  }

  drawMainPath(ctx, cell) {
    MAIN_PATH.forEach((boardCell) => {
      const { x, y } = boardCell.position;
      this.drawCell(ctx, cell, x, y, BOARD_COLORS[boardCell.colorSeat], false);
      if (boardCell.type === CELL_TYPES.FLIGHT) {
        this.drawPlaneMark(ctx, (x + 0.5) * cell, (y + 0.5) * cell, cell * 0.18, "#fffaf0");
      } else if (boardCell.type === CELL_TYPES.HOME_ENTRY) {
        this.drawHomeChevron(ctx, cell, x, y, boardCell.homeEntryForSeat);
      } else if (boardCell.type === CELL_TYPES.START) {
        this.drawStartRing(ctx, cell, x, y, boardCell.entryForSeat);
      } else {
        this.drawDot(ctx, (x + 0.5) * cell, (y + 0.5) * cell, cell * 0.075, "rgba(255,250,240,0.85)");
      }
    });
  }

  drawTakeoffPads(ctx, cell) {
    TAKEOFF_CELLS.forEach((takeoff, seat) => {
      const { x, y } = takeoff.position;
      this.drawCell(ctx, cell, x, y, BOARD_COLORS[seat], true);
      this.drawArrowMark(ctx, cell, x, y, seat);
    });
  }

  drawHomePaths(ctx, cell) {
    HOME_PATHS.forEach((lane, seat) => lane.forEach((homeCell, index) => {
      const { x, y } = homeCell.position;
      this.drawCell(ctx, cell, x, y, BOARD_COLORS[seat], index === lane.length - 1);
      this.drawDot(ctx, (x + 0.5) * cell, (y + 0.5) * cell, cell * 0.13, "rgba(255,250,240,0.88)");
    }));
  }

  drawCenter(ctx, cell) {
    const center = FINISH_CELL.position.x * cell;
    const radius = cell * 1.42;
    const points = [
      [center, center - radius], [center + radius, center],
      [center, center + radius], [center - radius, center],
    ];
    for (let index = 0; index < 4; index += 1) {
      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.lineTo(...points[index]);
      ctx.lineTo(...points[(index + 1) % 4]);
      ctx.closePath();
      ctx.fillStyle = BOARD_COLORS[(index + 1) % 4];
      ctx.fill();
      ctx.strokeStyle = "rgba(31,45,40,0.42)";
      ctx.lineWidth = cell * 0.035;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(center, center, cell * 0.34, 0, Math.PI * 2);
    ctx.fillStyle = "#fffaf0";
    ctx.fill();
    ctx.strokeStyle = "#40524a";
    ctx.lineWidth = cell * 0.055;
    ctx.stroke();
    this.drawPlaneMark(ctx, center, center, cell * 0.2, "#40524a");
  }

  drawCell(ctx, cell, x, y, fill, emphasized) {
    const inset = cell * 0.055;
    ctx.save();
    if (emphasized) {
      ctx.shadowColor = "rgba(25,42,34,0.28)";
      ctx.shadowBlur = cell * 0.12;
    }
    roundRect(ctx, x * cell + inset, y * cell + inset, cell - inset * 2, cell - inset * 2, cell * 0.1);
    const gradient = ctx.createLinearGradient(x * cell, y * cell, (x + 1) * cell, (y + 1) * cell);
    gradient.addColorStop(0, "rgba(255,255,255,0.24)");
    gradient.addColorStop(0.3, fill);
    gradient.addColorStop(1, fill);
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.strokeStyle = "rgba(35,49,43,0.5)";
    ctx.lineWidth = Math.max(1.5, cell * 0.032);
    ctx.stroke();
    ctx.restore();
  }

  drawStartRing(ctx, cell, x, y, seat) {
    ctx.beginPath();
    ctx.arc((x + 0.5) * cell, (y + 0.5) * cell, cell * 0.26, 0, Math.PI * 2);
    ctx.strokeStyle = BOARD_LIGHT_COLORS[seat];
    ctx.lineWidth = cell * 0.075;
    ctx.stroke();
  }

  drawHomeChevron(ctx, cell, x, y, seat) {
    const rotations = [Math.PI / 2, Math.PI, -Math.PI / 2, 0];
    ctx.save();
    ctx.translate((x + 0.5) * cell, (y + 0.5) * cell);
    ctx.rotate(rotations[seat]);
    ctx.strokeStyle = "#fffaf0";
    ctx.lineWidth = cell * 0.075;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-cell * 0.15, -cell * 0.17);
    ctx.lineTo(cell * 0.12, 0);
    ctx.lineTo(-cell * 0.15, cell * 0.17);
    ctx.stroke();
    ctx.restore();
  }

  drawDot(ctx, x, y, radius, color) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  drawArrowMark(ctx, cell, x, y, seat) {
    const rotations = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
    ctx.save();
    ctx.translate((x + 0.5) * cell, (y + 0.5) * cell);
    ctx.rotate(rotations[seat]);
    ctx.fillStyle = "#fffaf0";
    ctx.beginPath();
    ctx.moveTo(cell * 0.28, 0);
    ctx.lineTo(-cell * 0.06, -cell * 0.2);
    ctx.lineTo(-cell * 0.06, -cell * 0.08);
    ctx.lineTo(-cell * 0.28, -cell * 0.08);
    ctx.lineTo(-cell * 0.28, cell * 0.08);
    ctx.lineTo(-cell * 0.06, cell * 0.08);
    ctx.lineTo(-cell * 0.06, cell * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  drawPlaneMark(ctx, x, y, radius, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(radius, 0);
    ctx.lineTo(-radius * 0.18, -radius * 0.24);
    ctx.lineTo(-radius * 0.65, -radius * 0.7);
    ctx.lineTo(-radius * 0.84, -radius * 0.58);
    ctx.lineTo(-radius * 0.58, 0);
    ctx.lineTo(-radius * 0.84, radius * 0.58);
    ctx.lineTo(-radius * 0.65, radius * 0.7);
    ctx.lineTo(-radius * 0.18, radius * 0.24);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  drawDebugMap(ctx, cell) {
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `800 ${Math.max(7, cell * 0.105)}px ui-monospace, monospace`;
    MAIN_PATH.forEach((boardCell) => {
      const { x, y } = boardCell.position;
      const labels = debugLabelForCell(boardCell);
      const shortType = labels[2].replace("FLIGHT", "FL").replace("HOME", "H").replace("JUMP", "J");
      const lines = [labels[0], labels[1].slice(0, 1), shortType];
      ctx.fillStyle = "rgba(10,19,15,0.86)";
      lines.forEach((line, index) => ctx.fillText(line, (x + 0.5) * cell, (y + 0.29 + index * 0.21) * cell));
    });
    TAKEOFF_CELLS.forEach((takeoff) => {
      const { x, y } = takeoff.position;
      ctx.fillStyle = "rgba(10,19,15,0.86)";
      ctx.fillText(`T${takeoff.colorSeat}`, (x + 0.5) * cell, (y + 0.5) * cell);
    });
    HOME_PATHS.forEach((lane, seat) => lane.forEach((homeCell, index) => {
      ctx.fillStyle = "rgba(10,19,15,0.78)";
      ctx.fillText(`H${seat}:${index}`, (homeCell.position.x + 0.5) * cell, (homeCell.position.y + 0.5) * cell);
    }));
    ctx.fillStyle = "rgba(9,20,15,0.82)";
    roundRect(ctx, cell * 6.35, cell * 6.25, cell * 2.3, cell * 0.42, cell * 0.08);
    ctx.fill();
    ctx.fillStyle = "#fffaf0";
    ctx.font = `900 ${cell * 0.17}px ui-monospace, monospace`;
    ctx.fillText("DEBUG MAP", cell * 7.5, cell * 6.46);
    ctx.restore();
  }

  drawPreviewPieces(ctx, cell) {
    HANGAR_POSITIONS_BY_SEAT.forEach((hangar, seat) => {
      hangar.slice(0, 2).forEach((position) => {
        this.drawPlane(ctx, (position.x + 0.5) * cell, (position.y + 0.5) * cell, cell * 0.31, seat, false, 0, 1);
      });
    });
    FLIGHT_ROUTE_BY_SEAT.forEach((route, seat) => {
      const position = MAIN_PATH[route.entryIndex].position;
      this.drawPlane(ctx, (position.x + 0.5) * cell, (position.y + 0.5) * cell, cell * 0.29, seat, false, 0, 1);
    });
  }

  drawPieces(ctx, cell, state, visual) {
    const seatByPlayer = new Map(state.players.map((player) => [player.playerId, player.seat]));
    const overrides = visual.overrides ?? new Map();
    const positions = state.pieces.map((piece) => {
      const seat = seatByPlayer.get(piece.playerId);
      const index = Number(piece.id.split(":").at(-1));
      const override = overrides.get(piece.id);
      const descriptor = override ?? this.pieceDescriptor(piece, seat, index);
      return { piece, seat, index, descriptor };
    });
    const buckets = new Map();
    positions.forEach((item) => {
      const key = item.descriptor.zone === "transition"
        ? `transition:${item.piece.id}`
        : `${item.descriptor.zone}:${item.descriptor.seat ?? ""}:${item.descriptor.index}`;
      const group = buckets.get(key) ?? [];
      group.push(item);
      buckets.set(key, group);
    });

    this.hitTargets = [];
    const pulse = (Math.sin((visual.now ?? performance.now()) / 210) + 1) / 2;
    for (const group of buckets.values()) {
      group.forEach((item, groupIndex) => {
        const point = this.descriptorPoint(item.descriptor, item.seat, item.index, cell);
        const offset = group.length > 1
          ? { x: ((groupIndex % 2) - 0.5) * cell * 0.25, y: (Math.floor(groupIndex / 2) - 0.25) * cell * 0.25 }
          : { x: 0, y: 0 };
        const x = point.x + offset.x;
        const y = point.y + offset.y;
        const movable = Boolean(visual.inputEnabled && visual.movablePieceIds?.has(item.piece.id));
        const dimmed = Boolean(visual.waitingForPiece && !visual.movablePieceIds?.has(item.piece.id) && item.piece.playerId === visual.turnPlayerId);
        if (item.descriptor.zone === "transition" && item.descriptor.style === "flight") {
          this.drawTrail(ctx, item.descriptor, item.seat, item.index, cell);
        }
        this.drawPlane(ctx, x, y, cell * (group.length > 1 ? 0.23 : 0.31), item.seat, movable, pulse, dimmed ? 0.42 : 1, point.rotation, point.scale);
        if (movable) this.hitTargets.push({ pieceId: item.piece.id, x, y, radius: cell * 0.58 });
      });
    }
  }

  pieceDescriptor(piece, seat, index) {
    if (piece.status === "hangar") return { zone: "hangar", index, seat };
    const cell = cellForPlayerStep(seat, piece.steps);
    if (piece.status === "takeoff") return { zone: "takeoff", index: seat, seat, cellId: cell?.id };
    if (piece.status === "track") return { zone: "track", index: cell?.pathIndex, seat, cellId: cell?.id };
    if (piece.status === "home") return { zone: "home", index: piece.steps - HOME_ROUTE_START_STEP, seat, cellId: cell?.id };
    return { zone: "finished", index, seat, cellId: FINISH_CELL.id };
  }

  descriptorPoint(descriptor, fallbackSeat, pieceIndex, cell) {
    const seat = Number.isInteger(descriptor.seat) ? descriptor.seat : fallbackSeat;
    if (descriptor.zone === "transition") {
      const from = this.descriptorPoint(descriptor.from, seat, pieceIndex, cell);
      const to = this.descriptorPoint(descriptor.to, seat, pieceIndex, cell);
      const progress = easeOutCubic(descriptor.progress ?? 0);
      const lift = Math.sin(Math.PI * progress) * (descriptor.arc ?? 0) * cell;
      return {
        x: lerp(from.x, to.x, progress) + (descriptor.shake ?? 0) * cell,
        y: lerp(from.y, to.y, progress) - lift,
        rotation: lerp(from.rotation ?? 0, descriptor.rotation ?? 0, progress),
        scale: 1 + Math.sin(Math.PI * progress) * (descriptor.scaleBoost ?? 0),
      };
    }
    if (descriptor.zone === "point") {
      return { x: descriptor.x * cell, y: descriptor.y * cell, rotation: descriptor.rotation ?? 0, scale: descriptor.scale ?? 1 };
    }
    let position;
    if (descriptor.zone === "track") position = MAIN_PATH[descriptor.index]?.position;
    else if (descriptor.zone === "takeoff") position = TAKEOFF_CELLS[seat].position;
    else if (descriptor.zone === "home") position = HOME_PATHS[seat][Math.min(5, descriptor.index)]?.position;
    else if (descriptor.zone === "finished") {
      const offsets = [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]];
      const offset = offsets[pieceIndex] ?? offsets[0];
      return { x: (FINISH_CELL.position.x + offset[0]) * cell, y: (FINISH_CELL.position.y + offset[1]) * cell, rotation: 0, scale: 1 };
    } else position = HANGAR_POSITIONS_BY_SEAT[seat][pieceIndex];
    return { x: (position.x + 0.5) * cell, y: (position.y + 0.5) * cell, rotation: 0, scale: 1 };
  }

  drawTrail(ctx, descriptor, seat, pieceIndex, cell) {
    const from = this.descriptorPoint(descriptor.from, seat, pieceIndex, cell);
    const current = this.descriptorPoint(descriptor, seat, pieceIndex, cell);
    const gradient = ctx.createLinearGradient(from.x, from.y, current.x, current.y);
    gradient.addColorStop(0, "rgba(255,255,255,0)");
    gradient.addColorStop(1, BOARD_LIGHT_COLORS[seat]);
    ctx.save();
    ctx.strokeStyle = gradient;
    ctx.lineWidth = cell * 0.12;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(current.x, current.y);
    ctx.stroke();
    ctx.restore();
  }

  drawPlane(ctx, x, y, radius, seat, highlighted, pulse, alpha = 1, rotation = 0, scale = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(([0, Math.PI / 2, Math.PI, -Math.PI / 2][seat] ?? 0) + rotation);
    ctx.scale(scale, scale);
    if (highlighted) {
      const glow = 1.48 + pulse * 0.18;
      ctx.beginPath();
      ctx.arc(0, 0, radius * glow, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(104,213,189,${0.2 + pulse * 0.18})`;
      ctx.fill();
      ctx.strokeStyle = "#173b31";
      ctx.lineWidth = Math.max(2, radius * 0.11);
      ctx.stroke();
    }
    ctx.shadowColor = "rgba(22,32,28,0.34)";
    ctx.shadowBlur = radius * 0.34;
    ctx.shadowOffsetY = radius * 0.16;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    const body = ctx.createLinearGradient(-radius, -radius, radius, radius);
    body.addColorStop(0, "#ffffff");
    body.addColorStop(0.13, BOARD_COLORS[seat]);
    body.addColorStop(1, BOARD_DARK_COLORS[seat]);
    ctx.fillStyle = body;
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.strokeStyle = "#263b33";
    ctx.lineWidth = Math.max(2, radius * 0.1);
    ctx.stroke();
    this.drawPlaneMark(ctx, 0, 0, radius * 0.72, "#fffaf0");
    ctx.restore();
  }

  drawEffects(ctx, cell, effects) {
    effects.forEach((effect) => {
      const point = this.descriptorPoint(effect.at, effect.at.seat, 0, cell);
      if (effect.type === "capture") {
        const progress = effect.progress ?? 0;
        for (let index = 0; index < 8; index += 1) {
          const angle = index * Math.PI / 4;
          const distance = cell * 0.5 * progress;
          ctx.beginPath();
          ctx.arc(point.x + Math.cos(angle) * distance, point.y + Math.sin(angle) * distance, cell * 0.07 * (1 - progress * 0.55), 0, Math.PI * 2);
          ctx.fillStyle = index % 2 ? "#fff1a8" : "#ffffff";
          ctx.globalAlpha = 1 - progress;
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      } else if (effect.type === "finish") {
        const progress = effect.progress ?? 0;
        for (let index = 0; index < 16; index += 1) {
          const angle = index * Math.PI / 8;
          const distance = cell * (0.3 + progress * 1.4);
          ctx.save();
          ctx.translate(point.x + Math.cos(angle) * distance, point.y + Math.sin(angle) * distance);
          ctx.rotate(angle + progress * 3);
          ctx.fillStyle = BOARD_COLORS[index % 4];
          ctx.globalAlpha = 1 - progress * 0.7;
          ctx.fillRect(-cell * 0.045, -cell * 0.08, cell * 0.09, cell * 0.16);
          ctx.restore();
        }
        ctx.globalAlpha = 1;
      }
    });
  }
}
