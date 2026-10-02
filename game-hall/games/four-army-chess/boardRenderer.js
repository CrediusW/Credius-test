import {
  ARMY_CELL_TYPES,
  ARMY_RAIL_LINES,
  FOUR_ARMY_BOARD_NODES,
  FOUR_ARMY_NODE_BY_ID,
  FOUR_ARMY_ROAD_ADJACENCY,
} from "../../src/fourArmyChessBoardMap.js";
import { ARMY_RANK_LABELS, ARMY_RANKS } from "../../src/fourArmyChessPieces.js";

export const ARMY_SEAT_COLORS = ["#d95858", "#4f88cf", "#45a470", "#d9a83d"];
export const ARMY_SEAT_DARK = ["#7f252a", "#244f82", "#216744", "#7c5718"];
export const ARMY_SEAT_NAMES = ["北方", "东方", "南方", "西方"];

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

function easeOut(value) {
  return 1 - (1 - value) ** 3;
}

export function pointAlongArmyMovement(movement) {
  if (!movement?.fromNodeId || !movement?.toNodeId) return null;
  const nodeIds = Array.isArray(movement.pathNodeIds) && movement.pathNodeIds.length >= 2
    ? movement.pathNodeIds
    : [movement.fromNodeId, movement.toNodeId];
  const points = nodeIds
    .map((nodeId) => FOUR_ARMY_NODE_BY_ID.get(nodeId)?.position)
    .filter(Boolean);
  if (points.length < 2) return null;
  const progress = easeOut(Math.max(0, Math.min(1, movement.progress ?? 0)));
  const routeProgress = progress * (points.length - 1);
  const segmentIndex = Math.min(points.length - 2, Math.floor(routeProgress));
  const segmentProgress = routeProgress - segmentIndex;
  const from = points[segmentIndex];
  const to = points[segmentIndex + 1];
  return {
    x: from.x + (to.x - from.x) * segmentProgress,
    y: from.y + (to.y - from.y) * segmentProgress,
  };
}

export class FourArmyBoardRenderer {
  constructor(canvas, { debugMode = false } = {}) {
    this.canvas = canvas;
    this.debugMode = debugMode;
    this.hitTargets = [];
  }

  pointForNode(nodeId) {
    const node = FOUR_ARMY_NODE_BY_ID.get(nodeId);
    if (!node) return null;
    const unit = this.canvas.width / 18;
    return { x: (node.position.x + 1) * unit, y: (node.position.y + 1) * unit, unit };
  }

  draw(state = null, visual = {}) {
    const ctx = this.canvas.getContext("2d");
    const size = this.canvas.width;
    const unit = size / 18;
    ctx.clearRect(0, 0, size, size);
    this.drawSurface(ctx, size, unit);
    this.drawTerritories(ctx, unit);
    this.drawRoads(ctx, unit);
    this.drawRailways(ctx, unit);
    this.drawNodes(ctx, unit);
    this.drawCenterMark(ctx, unit);
    if (this.debugMode) this.drawDebug(ctx, unit);
    this.drawPieces(ctx, unit, state?.pieces ?? [], visual);
    this.drawBattleEffect(ctx, unit, visual.battleEffect);
  }

  hitTest(x, y) {
    return this.hitTargets.find((target) => Math.hypot(target.x - x, target.y - y) <= target.radius) ?? null;
  }

  drawSurface(ctx, size, unit) {
    const fill = ctx.createLinearGradient(0, 0, size, size);
    fill.addColorStop(0, "#e8dfca");
    fill.addColorStop(0.52, "#c7d1bd");
    fill.addColorStop(1, "#b7c5ae");
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    for (let index = 0; index < 8; index += 1) {
      ctx.beginPath();
      ctx.arc(unit * (2 + (index * 2.17) % 14), unit * (2.5 + (index * 3.71) % 13), unit * 0.32, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawTerritories(ctx, unit) {
    const areas = [
      [6.45, 0.45, 5.1, 6.1],
      [11.45, 6.45, 6.1, 5.1],
      [6.45, 11.45, 5.1, 6.1],
      [0.45, 6.45, 6.1, 5.1],
    ];
    areas.forEach(([x, y, width, height], seat) => {
      roundRect(ctx, x * unit, y * unit, width * unit, height * unit, unit * 0.18);
      ctx.fillStyle = `${ARMY_SEAT_COLORS[seat]}28`;
      ctx.fill();
      ctx.strokeStyle = `${ARMY_SEAT_DARK[seat]}88`;
      ctx.lineWidth = unit * 0.05;
      ctx.stroke();
    });
  }

  nodePoint(node, unit) {
    return { x: (node.position.x + 1) * unit, y: (node.position.y + 1) * unit };
  }

  drawRoads(ctx, unit) {
    const seen = new Set();
    ctx.save();
    ctx.strokeStyle = "rgba(69,75,65,0.42)";
    ctx.lineWidth = unit * 0.055;
    for (const node of FOUR_ARMY_BOARD_NODES) {
      const from = this.nodePoint(node, unit);
      for (const neighborId of FOUR_ARMY_ROAD_ADJACENCY.get(node.id) ?? []) {
        const key = [node.id, neighborId].sort().join("|");
        if (seen.has(key)) continue;
        seen.add(key);
        const to = this.nodePoint(FOUR_ARMY_NODE_BY_ID.get(neighborId), unit);
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  drawRailways(ctx, unit) {
    ctx.save();
    ctx.lineCap = "round";
    for (const line of ARMY_RAIL_LINES) {
      const points = line.nodes.map((id) => this.nodePoint(FOUR_ARMY_NODE_BY_ID.get(id), unit));
      ctx.strokeStyle = "rgba(45,51,46,0.78)";
      ctx.lineWidth = unit * 0.16;
      ctx.beginPath();
      points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
      if (line.closed) ctx.closePath();
      ctx.stroke();
      ctx.strokeStyle = "rgba(232,223,202,0.9)";
      ctx.lineWidth = unit * 0.045;
      ctx.setLineDash([unit * 0.16, unit * 0.13]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  drawNodes(ctx, unit) {
    for (const node of FOUR_ARMY_BOARD_NODES) {
      const point = this.nodePoint(node, unit);
      const radius = node.type === ARMY_CELL_TYPES.CENTER ? unit * 0.19 : unit * 0.25;
      ctx.save();
      ctx.beginPath();
      if (node.type === ARMY_CELL_TYPES.CAMP) {
        ctx.arc(point.x, point.y, unit * 0.34, 0, Math.PI * 2);
        ctx.fillStyle = "#f1e8bd";
      } else if (node.type === ARMY_CELL_TYPES.HEADQUARTERS) {
        roundRect(ctx, point.x - unit * 0.34, point.y - unit * 0.27, unit * 0.68, unit * 0.54, unit * 0.09);
        ctx.fillStyle = "#e3d8bc";
      } else {
        ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = node.type === ARMY_CELL_TYPES.CENTER ? "#dbe2d2" : "#efe8d5";
      }
      ctx.fill();
      ctx.strokeStyle = node.type === ARMY_CELL_TYPES.CAMP ? "#7e8a54" : "rgba(51,59,52,0.72)";
      ctx.lineWidth = unit * 0.045;
      ctx.stroke();
      if (node.type === ARMY_CELL_TYPES.CAMP || node.type === ARMY_CELL_TYPES.HEADQUARTERS) {
        ctx.fillStyle = "rgba(54,62,53,0.78)";
        ctx.font = `800 ${unit * 0.16}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(node.type === ARMY_CELL_TYPES.CAMP ? "营" : "本营", point.x, point.y);
      }
      ctx.restore();
    }
  }

  drawCenterMark(ctx, unit) {
    const center = unit * 9;
    ctx.save();
    ctx.translate(center, center);
    ctx.rotate(Math.PI / 4);
    roundRect(ctx, -unit * 0.39, -unit * 0.39, unit * 0.78, unit * 0.78, unit * 0.08);
    ctx.fillStyle = "rgba(45,61,50,0.9)";
    ctx.fill();
    ctx.rotate(-Math.PI / 4);
    ctx.fillStyle = "#f3e7bd";
    ctx.font = `900 ${unit * 0.2}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("军棋", 0, 0);
    ctx.restore();
  }

  drawDebug(ctx, unit) {
    ctx.save();
    ctx.font = `700 ${Math.max(7, unit * 0.1)}px ui-monospace, monospace`;
    ctx.textAlign = "center";
    ctx.fillStyle = "#202820";
    for (const node of FOUR_ARMY_BOARD_NODES) {
      const point = this.nodePoint(node, unit);
      ctx.fillText(node.id.replace("CENTER_", "C_"), point.x, point.y + unit * 0.43);
    }
    ctx.restore();
  }

  animatedPoint(piece, visual, unit) {
    const movement = visual.movement;
    if (!movement || movement.pieceId !== piece.id || !movement.fromNodeId || !movement.toNodeId) {
      return piece.nodeId ? this.nodePoint(FOUR_ARMY_NODE_BY_ID.get(piece.nodeId), unit) : null;
    }
    const point = pointAlongArmyMovement(movement);
    if (!point) return piece.nodeId ? this.nodePoint(FOUR_ARMY_NODE_BY_ID.get(piece.nodeId), unit) : null;
    return {
      x: (point.x + 1) * unit,
      y: (point.y + 1) * unit,
    };
  }

  drawPieces(ctx, unit, pieces, visual) {
    this.hitTargets = [];
    const selectable = new Set(visual.selectablePieceIds ?? []);
    const inspectable = new Set(visual.inspectablePieceIds ?? []);
    const legalTargets = new Set(visual.legalTargetIds ?? []);
    const selectedPieceId = visual.selectedPieceId ?? null;
    const annotations = visual.annotations ?? {};
    const pulse = (Math.sin((visual.now ?? performance.now()) / 220) + 1) / 2;

    for (const nodeId of legalTargets) {
      const point = this.nodePoint(FOUR_ARMY_NODE_BY_ID.get(nodeId), unit);
      ctx.beginPath();
      ctx.arc(point.x, point.y, unit * (0.34 + pulse * 0.05), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(94,210,170,${0.24 + pulse * 0.15})`;
      ctx.fill();
      ctx.strokeStyle = "#246c57";
      ctx.lineWidth = unit * 0.06;
      ctx.stroke();
      this.hitTargets.push({ type: "node", nodeId, x: point.x, y: point.y, radius: unit * 0.48 });
    }

    for (const piece of pieces) {
      if (!piece.alive && visual.movement?.pieceId !== piece.id) continue;
      const point = this.animatedPoint(piece, visual, unit);
      if (!point) continue;
      const selected = selectedPieceId === piece.id;
      const canSelect = selectable.has(piece.id);
      const width = unit * 0.74;
      const height = unit * 0.5;
      ctx.save();
      if (selected || canSelect) {
        ctx.shadowColor = selected ? "#fff5b5" : "#72e1bc";
        ctx.shadowBlur = unit * (selected ? 0.3 : 0.18 + pulse * 0.12);
      }
      roundRect(ctx, point.x - width / 2, point.y - height / 2, width, height, unit * 0.09);
      const body = ctx.createLinearGradient(point.x, point.y - height / 2, point.x, point.y + height / 2);
      body.addColorStop(0, "rgba(255,255,255,0.32)");
      body.addColorStop(0.12, ARMY_SEAT_COLORS[piece.seat]);
      body.addColorStop(1, ARMY_SEAT_DARK[piece.seat]);
      ctx.fillStyle = body;
      ctx.fill();
      ctx.shadowColor = "transparent";
      ctx.strokeStyle = selected ? "#fff1a6" : canSelect ? "#8df0cd" : "rgba(31,39,34,0.88)";
      ctx.lineWidth = unit * (selected ? 0.08 : 0.045);
      ctx.stroke();
      ctx.fillStyle = "#fffbed";
      ctx.font = `900 ${unit * (piece.rank ? 0.18 : 0.23)}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const label = piece.rank ? ARMY_RANK_LABELS[piece.rank] : "暗";
      ctx.fillText(label, point.x, point.y + unit * 0.005);
      const annotation = annotations[piece.id];
      if (!piece.rank && annotation) {
        ctx.beginPath();
        ctx.arc(point.x + width * 0.36, point.y - height * 0.36, unit * 0.18, 0, Math.PI * 2);
        ctx.fillStyle = "#f7e5a0";
        ctx.fill();
        ctx.strokeStyle = "#493813";
        ctx.lineWidth = unit * 0.035;
        ctx.stroke();
        ctx.fillStyle = "#33270d";
        ctx.font = `900 ${unit * 0.15}px system-ui, sans-serif`;
        ctx.fillText(annotation, point.x + width * 0.36, point.y - height * 0.36);
      }
      if (piece.rank === ARMY_RANKS.FLAG) {
        ctx.fillStyle = "#fff2a8";
        ctx.fillRect(point.x - width * 0.34, point.y - height * 0.34, unit * 0.045, height * 0.68);
      }
      ctx.restore();
      if (canSelect || inspectable.has(piece.id)) this.hitTargets.push({ type: "piece", pieceId: piece.id, x: point.x, y: point.y, radius: unit * 0.43 });
    }
  }

  drawBattleEffect(ctx, unit, effect) {
    if (!effect?.nodeId) return;
    const point = this.nodePoint(FOUR_ARMY_NODE_BY_ID.get(effect.nodeId), unit);
    const progress = effect.progress ?? 0;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - progress);
    if (effect.outcome === "ATTACKER_WINS") {
      ctx.strokeStyle = "#77f2b2";
      ctx.lineWidth = unit * 0.12 * (1 - progress * 0.5);
      ctx.beginPath();
      ctx.arc(point.x, point.y, unit * (0.28 + progress * 0.72), 0, Math.PI * 2);
      ctx.stroke();
      for (let index = 0; index < 6; index += 1) {
        const angle = -Math.PI / 2 + index * Math.PI / 3;
        ctx.fillStyle = index % 2 ? "#fff3a3" : "#76dca8";
        ctx.beginPath();
        ctx.arc(point.x + Math.cos(angle) * unit * progress * 0.7, point.y + Math.sin(angle) * unit * progress * 0.7, unit * 0.07, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (effect.outcome === "DEFENDER_WINS") {
      ctx.strokeStyle = "#e96c65";
      ctx.lineWidth = unit * 0.11;
      ctx.beginPath();
      ctx.arc(point.x, point.y, unit * (0.35 + progress * 0.35), Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(point.x - unit * (0.18 + progress * 0.65), point.y - unit * 0.28);
      ctx.lineTo(point.x - unit * (0.48 + progress * 0.65), point.y);
      ctx.lineTo(point.x - unit * (0.18 + progress * 0.65), point.y + unit * 0.28);
      ctx.stroke();
    } else {
      for (let index = 0; index < 12; index += 1) {
        const angle = index * Math.PI / 6;
        const distance = unit * progress * 0.82;
        ctx.fillStyle = index % 2 ? "#fff1a0" : "#f26b56";
        ctx.beginPath();
        ctx.arc(point.x + Math.cos(angle) * distance, point.y + Math.sin(angle) * distance, unit * 0.09 * (1 - progress * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = "#fff0bc";
      ctx.lineWidth = unit * 0.08;
      ctx.beginPath();
      ctx.moveTo(point.x - unit * 0.5, point.y - unit * 0.5);
      ctx.lineTo(point.x + unit * 0.5, point.y + unit * 0.5);
      ctx.moveTo(point.x + unit * 0.5, point.y - unit * 0.5);
      ctx.lineTo(point.x - unit * 0.5, point.y + unit * 0.5);
      ctx.stroke();
    }
    ctx.restore();
  }
}
