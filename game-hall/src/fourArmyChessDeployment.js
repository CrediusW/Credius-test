import {
  FOUR_ARMY_DEPLOYMENT_NODES,
  FOUR_ARMY_NODE_BY_ID,
  FOUR_ARMY_HEADQUARTER_NODES,
} from "./fourArmyChessBoardMap.js";
import { ARMY_RANKS, ARMY_RANK_STRENGTH } from "./fourArmyChessPieces.js";

export const ARMY_DEPLOYMENT_SCHEMES = Object.freeze([
  Object.freeze({ id: "assault", name: "亮剑突击", description: "主力靠前，抢占铁路与中央通道" }),
  Object.freeze({ id: "fortress", name: "铁桶防线", description: "雷区收紧，核心主力纵深配置" }),
  Object.freeze({ id: "mobile", name: "工兵奇袭", description: "工兵前置，优先打开转弯铁路" }),
]);

const SCHEME_BY_ID = new Map(ARMY_DEPLOYMENT_SCHEMES.map((scheme) => [scheme.id, scheme]));

function nodeId(seat, row, col) {
  return `S${seat}_R${row}_C${col}`;
}

function takePiece(groups, rank) {
  const piece = groups.get(rank)?.shift();
  if (!piece) throw new Error(`阵型缺少 ${rank} 棋子。`);
  return piece;
}

function specialNodes(seat, schemeId) {
  if (schemeId === "fortress") {
    return {
      flag: FOUR_ARMY_HEADQUARTER_NODES[seat][0],
      mines: [[5, 0], [5, 2], [5, 4]].map(([row, col]) => nodeId(seat, row, col)),
      bombs: [[4, 0], [4, 4]].map(([row, col]) => nodeId(seat, row, col)),
    };
  }
  if (schemeId === "mobile") {
    return {
      flag: FOUR_ARMY_HEADQUARTER_NODES[seat][1],
      mines: [[5, 0], [4, 2], [5, 4]].map(([row, col]) => nodeId(seat, row, col)),
      bombs: [[1, 0], [1, 4]].map(([row, col]) => nodeId(seat, row, col)),
    };
  }
  return {
    flag: FOUR_ARMY_HEADQUARTER_NODES[seat][1],
    mines: [[5, 0], [5, 2], [4, 4]].map(([row, col]) => nodeId(seat, row, col)),
    bombs: [[2, 0], [2, 4]].map(([row, col]) => nodeId(seat, row, col)),
  };
}

function ordinaryPieceOrder(pieces, schemeId) {
  const rankValue = (piece) => ARMY_RANK_STRENGTH[piece.rank] ?? 0;
  return [...pieces].sort((left, right) => {
    if (schemeId === "mobile") {
      const leftEngineer = left.rank === ARMY_RANKS.ENGINEER ? 1 : 0;
      const rightEngineer = right.rank === ARMY_RANKS.ENGINEER ? 1 : 0;
      if (leftEngineer !== rightEngineer) return rightEngineer - leftEngineer;
    }
    const direction = schemeId === "fortress" ? 1 : -1;
    return direction * (rankValue(left) - rankValue(right)) || left.id.localeCompare(right.id);
  });
}

function ordinaryNodeOrder(nodeIds, schemeId) {
  return [...nodeIds].sort((leftId, rightId) => {
    const left = FOUR_ARMY_NODE_BY_ID.get(leftId);
    const right = FOUR_ARMY_NODE_BY_ID.get(rightId);
    if (schemeId === "mobile") {
      const leftRail = left.rail ? 0 : 1;
      const rightRail = right.rail ? 0 : 1;
      if (leftRail !== rightRail) return leftRail - rightRail;
    }
    const rowDirection = schemeId === "fortress" ? -1 : 1;
    return rowDirection * (left.row - right.row) || Math.abs(left.col - 2) - Math.abs(right.col - 2) || left.col - right.col;
  });
}

export function buildArmyDeploymentPlacements(pieces, seat, rawSchemeId = "assault") {
  const schemeId = SCHEME_BY_ID.has(rawSchemeId) ? rawSchemeId : "assault";
  const army = pieces.filter((piece) => piece.seat === seat && piece.alive);
  if (army.length !== 25) throw new Error("每方必须使用完整的 25 枚棋子布阵。");
  const groups = new Map();
  for (const piece of army) {
    if (!groups.has(piece.rank)) groups.set(piece.rank, []);
    groups.get(piece.rank).push(piece);
  }
  for (const group of groups.values()) group.sort((left, right) => left.id.localeCompare(right.id));

  const specials = specialNodes(seat, schemeId);
  const placements = [];
  const place = (piece, targetNodeId) => placements.push({ pieceId: piece.id, nodeId: targetNodeId });
  place(takePiece(groups, ARMY_RANKS.FLAG), specials.flag);
  specials.mines.forEach((target) => place(takePiece(groups, ARMY_RANKS.MINE), target));
  specials.bombs.forEach((target) => place(takePiece(groups, ARMY_RANKS.BOMB), target));

  const occupied = new Set(placements.map((placement) => placement.nodeId));
  const remainingPieces = army.filter((piece) => !placements.some((placement) => placement.pieceId === piece.id));
  const remainingNodes = FOUR_ARMY_DEPLOYMENT_NODES[seat].filter((target) => !occupied.has(target));
  ordinaryPieceOrder(remainingPieces, schemeId).forEach((piece, index) => place(piece, ordinaryNodeOrder(remainingNodes, schemeId)[index]));
  return placements;
}

export function applyArmyDeploymentPlacements(pieces, placements) {
  const targetByPiece = new Map(placements.map((placement) => [placement.pieceId, placement.nodeId]));
  return pieces.map((piece) => targetByPiece.has(piece.id) ? { ...piece, nodeId: targetByPiece.get(piece.id) } : { ...piece });
}
