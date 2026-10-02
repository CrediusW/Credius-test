export const FOUR_ARMY_GAME_TYPE = "four-army-chess";
export const FOUR_ARMY_RULESET_VERSION = 6;
export const FOUR_ARMY_SEATS = Object.freeze([0, 1, 2, 3]);
export const FOUR_ARMY_TEAMS = Object.freeze([0, 1, 0, 1]);
export const FOUR_ARMY_COLORS = Object.freeze(["crimson", "azure", "emerald", "amber"]);

export const ARMY_CELL_TYPES = Object.freeze({
  STATION: "STATION",
  CAMP: "CAMP",
  HEADQUARTERS: "HEADQUARTERS",
  CENTER: "CENTER",
});

const CAMP_KEYS = new Set(["1:1", "1:3", "2:2", "3:1", "3:3"]);
const HEADQUARTER_KEYS = new Set(["5:1", "5:3"]);

function armPosition(seat, row, col) {
  if (seat === 0) return { x: 6 + col, y: 5 - row };
  if (seat === 1) return { x: 11 + row, y: 6 + col };
  if (seat === 2) return { x: 10 - col, y: 11 + row };
  return { x: 5 - row, y: 10 - col };
}

function armNodeId(seat, row, col) {
  return `S${seat}_R${row}_C${col}`;
}

function centerNodeId(row, col) {
  return `CENTER_R${row}_C${col}`;
}

const armNodes = FOUR_ARMY_SEATS.flatMap((seat) =>
  Array.from({ length: 6 }, (_, row) =>
    Array.from({ length: 5 }, (_, col) => {
      const key = `${row}:${col}`;
      const type = CAMP_KEYS.has(key)
        ? ARMY_CELL_TYPES.CAMP
        : HEADQUARTER_KEYS.has(key)
          ? ARMY_CELL_TYPES.HEADQUARTERS
          : ARMY_CELL_TYPES.STATION;
      return {
        id: armNodeId(seat, row, col),
        seat,
        row,
        col,
        position: armPosition(seat, row, col),
        type,
        deployable: type !== ARMY_CELL_TYPES.CAMP,
        rail: false,
      };
    }),
  ).flat(),
);

const centerNodes = Array.from({ length: 3 }, (_, row) =>
  Array.from({ length: 3 }, (_, col) => ({
    id: centerNodeId(row, col),
    seat: null,
    row,
    col,
    position: { x: 6 + col * 2, y: 6 + row * 2 },
    type: ARMY_CELL_TYPES.CENTER,
    deployable: false,
    rail: true,
  })),
).flat();

const railLines = [];
railLines.push({
  id: "OUTER_RING",
  closed: true,
  nodes: FOUR_ARMY_SEATS.flatMap((seat) => Array.from({ length: 5 }, (_, col) => armNodeId(seat, 0, col))),
});

for (const seat of FOUR_ARMY_SEATS) {
  railLines.push({ id: `S${seat}_REAR`, closed: false, nodes: Array.from({ length: 5 }, (_, col) => armNodeId(seat, 4, col)) });
  railLines.push({ id: `S${seat}_LEFT`, closed: false, nodes: Array.from({ length: 5 }, (_, row) => armNodeId(seat, row, 0)) });
  railLines.push({ id: `S${seat}_RIGHT`, closed: false, nodes: Array.from({ length: 5 }, (_, row) => armNodeId(seat, row, 4)) });
}

const centerRailColumns = [0, 2, 4];
for (let lane = 0; lane < 3; lane += 1) {
  const armColumn = centerRailColumns[lane];
  railLines.push({
    id: `CENTER_NS_${lane}`,
    closed: false,
    nodes: [
      armNodeId(0, 0, armColumn),
      centerNodeId(0, lane),
      centerNodeId(1, lane),
      centerNodeId(2, lane),
      armNodeId(2, 0, 4 - armColumn),
    ],
  });
  railLines.push({
    id: `CENTER_WE_${lane}`,
    closed: false,
    nodes: [
      armNodeId(3, 0, 4 - armColumn),
      centerNodeId(lane, 0),
      centerNodeId(lane, 1),
      centerNodeId(lane, 2),
      armNodeId(1, 0, armColumn),
    ],
  });
}

export const ARMY_RAIL_LINES = Object.freeze(railLines.map((line) => Object.freeze({
  ...line,
  nodes: Object.freeze(line.nodes),
})));

// Ordinary pieces may follow one fixed tangent through an outer corner, but
// cannot treat the four inner-front rails as a loop. These logical lines are
// intentionally separate from ARMY_RAIL_LINES: the latter describes the
// physical network used for drawing and for an engineer's free railway turns.
const ordinaryRailLines = [];
for (const seat of FOUR_ARMY_SEATS) {
  const nextSeat = (seat + 1) % FOUR_ARMY_SEATS.length;
  ordinaryRailLines.push({
    id: `S${seat}_REAR_STRAIGHT`,
    nodes: Array.from({ length: 5 }, (_, col) => armNodeId(seat, 4, col)),
  });
  ordinaryRailLines.push({
    id: `S${seat}_FRONT_STRAIGHT`,
    nodes: Array.from({ length: 5 }, (_, col) => armNodeId(seat, 0, col)),
  });
  ordinaryRailLines.push({
    id: `S${seat}_LEFT_STRAIGHT`,
    nodes: Array.from({ length: 5 }, (_, row) => armNodeId(seat, row, 0)),
  });
  ordinaryRailLines.push({
    id: `S${seat}_RIGHT_STRAIGHT`,
    nodes: Array.from({ length: 5 }, (_, row) => armNodeId(seat, row, 4)),
  });
  ordinaryRailLines.push({
    id: `S${seat}_RIGHT_TO_S${nextSeat}_OUTER_FLANK`,
    nodes: [
      ...Array.from({ length: 5 }, (_, index) => armNodeId(seat, 4 - index, 4)),
      ...Array.from({ length: 5 }, (_, row) => armNodeId(nextSeat, row, 0)),
    ],
  });
}

const centerNodesFromRightFlank = Object.freeze([
  Object.freeze([centerNodeId(0, 2), centerNodeId(1, 2), centerNodeId(2, 2)]),
  Object.freeze([centerNodeId(2, 2), centerNodeId(2, 1), centerNodeId(2, 0)]),
  Object.freeze([centerNodeId(2, 0), centerNodeId(1, 0), centerNodeId(0, 0)]),
  Object.freeze([centerNodeId(0, 0), centerNodeId(0, 1), centerNodeId(0, 2)]),
]);

for (const seat of FOUR_ARMY_SEATS) {
  const oppositeSeat = (seat + 2) % FOUR_ARMY_SEATS.length;
  ordinaryRailLines.push({
    id: `S${seat}_RIGHT_THROUGH_CENTER_TO_S${oppositeSeat}_LEFT`,
    nodes: [
      ...Array.from({ length: 5 }, (_, index) => armNodeId(seat, 4 - index, 4)),
      ...centerNodesFromRightFlank[seat],
      ...Array.from({ length: 5 }, (_, row) => armNodeId(oppositeSeat, row, 0)),
    ],
  });
}

for (const line of railLines.filter((item) => item.id.startsWith("CENTER_"))) {
  ordinaryRailLines.push({ id: `${line.id}_STRAIGHT`, nodes: line.nodes });
}

export const ARMY_ORDINARY_RAIL_LINES = Object.freeze(ordinaryRailLines.map((line) => Object.freeze({
  ...line,
  nodes: Object.freeze(line.nodes),
})));

const railNodeIds = new Set(ARMY_RAIL_LINES.flatMap((line) => line.nodes));
export const FOUR_ARMY_BOARD_NODES = Object.freeze([...armNodes, ...centerNodes].map((node) => Object.freeze({
  ...node,
  position: Object.freeze(node.position),
  rail: railNodeIds.has(node.id),
})));

export const FOUR_ARMY_NODE_BY_ID = new Map(FOUR_ARMY_BOARD_NODES.map((node) => [node.id, node]));
export const FOUR_ARMY_DEPLOYMENT_NODES = Object.freeze(FOUR_ARMY_SEATS.map((seat) => Object.freeze(
  FOUR_ARMY_BOARD_NODES.filter((node) => node.seat === seat && node.deployable).map((node) => node.id),
)));
export const FOUR_ARMY_CAMP_NODES = Object.freeze(FOUR_ARMY_BOARD_NODES.filter((node) => node.type === ARMY_CELL_TYPES.CAMP).map((node) => node.id));
export const FOUR_ARMY_HEADQUARTER_NODES = Object.freeze(FOUR_ARMY_SEATS.map((seat) => Object.freeze(
  FOUR_ARMY_BOARD_NODES.filter((node) => node.seat === seat && node.type === ARMY_CELL_TYPES.HEADQUARTERS).map((node) => node.id),
)));

const road = new Map(FOUR_ARMY_BOARD_NODES.map((node) => [node.id, new Set()]));
const rail = new Map(FOUR_ARMY_BOARD_NODES.map((node) => [node.id, new Set()]));

function addEdge(graph, left, right) {
  if (!FOUR_ARMY_NODE_BY_ID.has(left) || !FOUR_ARMY_NODE_BY_ID.has(right)) return;
  graph.get(left).add(right);
  graph.get(right).add(left);
}

for (const seat of FOUR_ARMY_SEATS) {
  for (let row = 0; row < 6; row += 1) {
    for (let col = 0; col < 5; col += 1) {
      const id = armNodeId(seat, row, col);
      if (row < 5) addEdge(road, id, armNodeId(seat, row + 1, col));
      if (col < 4) addEdge(road, id, armNodeId(seat, row, col + 1));
      if (CAMP_KEYS.has(`${row}:${col}`)) {
        for (const [dr, dc] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
          addEdge(road, id, armNodeId(seat, row + dr, col + dc));
        }
      }
    }
  }
}

for (let row = 0; row < 3; row += 1) {
  for (let col = 0; col < 3; col += 1) {
    const id = centerNodeId(row, col);
    if (row < 2) addEdge(road, id, centerNodeId(row + 1, col));
    if (col < 2) addEdge(road, id, centerNodeId(row, col + 1));
  }
}

for (const line of ARMY_RAIL_LINES) {
  for (let index = 0; index < line.nodes.length - 1; index += 1) {
    addEdge(rail, line.nodes[index], line.nodes[index + 1]);
    addEdge(road, line.nodes[index], line.nodes[index + 1]);
  }
  if (line.closed) {
    addEdge(rail, line.nodes.at(-1), line.nodes[0]);
    addEdge(road, line.nodes.at(-1), line.nodes[0]);
  }
}

export const FOUR_ARMY_ROAD_ADJACENCY = new Map([...road].map(([id, neighbors]) => [id, Object.freeze([...neighbors])]));
export const FOUR_ARMY_RAIL_ADJACENCY = new Map([...rail].map(([id, neighbors]) => [id, Object.freeze([...neighbors])]));

export function straightRailPaths(fromId, toId) {
  const paths = [];
  for (const line of ARMY_ORDINARY_RAIL_LINES) {
    const fromIndex = line.nodes.indexOf(fromId);
    const toIndex = line.nodes.indexOf(toId);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) continue;
    const direction = toIndex > fromIndex ? 1 : -1;
    const path = [];
    for (let index = fromIndex + direction; ; index += direction) {
      path.push(line.nodes[index]);
      if (index === toIndex) break;
    }
    paths.push(path);
  }
  return paths;
}

export function validateFourArmyBoardMap() {
  const errors = [];
  if (FOUR_ARMY_BOARD_NODES.length !== 129) errors.push("四国军棋棋盘必须包含 129 个节点。");
  if (new Set(FOUR_ARMY_BOARD_NODES.map((node) => node.id)).size !== 129) errors.push("棋盘节点 ID 必须唯一。");
  for (const seat of FOUR_ARMY_SEATS) {
    const territory = FOUR_ARMY_BOARD_NODES.filter((node) => node.seat === seat);
    if (territory.length !== 30) errors.push(`第 ${seat + 1} 方阵地必须有 30 个节点。`);
    if (FOUR_ARMY_DEPLOYMENT_NODES[seat].length !== 25) errors.push(`第 ${seat + 1} 方必须恰好有 25 个布子位。`);
    if (territory.filter((node) => node.type === ARMY_CELL_TYPES.CAMP).length !== 5) errors.push(`第 ${seat + 1} 方必须有 5 个行营。`);
    if (FOUR_ARMY_HEADQUARTER_NODES[seat].length !== 2) errors.push(`第 ${seat + 1} 方必须有 2 个大本营。`);
  }
  if (centerNodes.length !== 9) errors.push("中央必须有 9 个铁路节点。");
  for (const node of FOUR_ARMY_BOARD_NODES) {
    if (!FOUR_ARMY_ROAD_ADJACENCY.get(node.id)?.length) errors.push(`${node.id} 缺少公路连接。`);
    if (node.rail && !FOUR_ARMY_RAIL_ADJACENCY.get(node.id)?.length) errors.push(`${node.id} 缺少铁路连接。`);
  }
  return errors;
}
