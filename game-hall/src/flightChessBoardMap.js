export const FLIGHT_CHESS_RULESET_VERSION = 3;
export const PLAYER_COLORS = ["RED", "BLUE", "GREEN", "YELLOW"];
export const PLAYER_COLOR_IDS = ["red", "blue", "green", "yellow"];
export const MAIN_PATH_LENGTH = 52;
export const HOME_PATH_LENGTH = 6;
export const TAKEOFF_STEP = 0;
export const MAIN_ROUTE_START_STEP = 1;
export const MAIN_ROUTE_END_STEP = MAIN_PATH_LENGTH;
export const HOME_ROUTE_START_STEP = MAIN_ROUTE_END_STEP + 1;
export const FINISH_STEP = MAIN_PATH_LENGTH + HOME_PATH_LENGTH + 1;
export const COLOR_JUMP_DISTANCE = 4;
export const FLIGHT_ENTRY_STEP = 17;
export const FLIGHT_EXIT_STEP = 29;

export const CELL_TYPES = Object.freeze({
  NORMAL: "NORMAL",
  START: "START",
  TAKEOFF: "TAKEOFF",
  JUMP: "JUMP",
  FLIGHT: "FLIGHT",
  HOME_ENTRY: "HOME_ENTRY",
  HOME_PATH: "HOME_PATH",
  FINISH: "FINISH",
});

export const ENTRY_INDEX_BY_SEAT = Object.freeze([0, 39, 26, 13]);

const MAIN_POSITIONS = Object.freeze([
  [6, 0], [6, 1], [6, 2], [6, 3], [6, 4], [6, 5],
  [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6], [0, 7],
  [0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8],
  [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14], [7, 14],
  [8, 14], [8, 13], [8, 12], [8, 11], [8, 10], [8, 9],
  [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8], [14, 7],
  [14, 6], [13, 6], [12, 6], [11, 6], [10, 6], [9, 6],
  [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0], [7, 0],
]);

export const HOME_POSITIONS_BY_SEAT = Object.freeze([
  [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5], [7, 6]],
  [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7], [8, 7]],
  [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9], [7, 8]],
  [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7]],
].map((lane) => Object.freeze(lane.map(([x, y]) => Object.freeze({ x, y })))));

export const HANGAR_POSITIONS_BY_SEAT = Object.freeze([
  [[2, 2], [4, 2], [2, 4], [4, 4]],
  [[10, 2], [12, 2], [10, 4], [12, 4]],
  [[10, 10], [12, 10], [10, 12], [12, 12]],
  [[2, 10], [4, 10], [2, 12], [4, 12]],
].map((hangar) => Object.freeze(hangar.map(([x, y]) => Object.freeze({ x, y })))));

const TAKEOFF_POSITIONS_BY_SEAT = Object.freeze([
  Object.freeze({ x: 5, y: 0 }),
  Object.freeze({ x: 14, y: 5 }),
  Object.freeze({ x: 9, y: 14 }),
  Object.freeze({ x: 0, y: 9 }),
]);

export const TAKEOFF_CELLS = Object.freeze(PLAYER_COLORS.map((color, seat) => Object.freeze({
  id: `TAKEOFF_${color}`,
  pathIndex: null,
  position: TAKEOFF_POSITIONS_BY_SEAT[seat],
  color,
  colorSeat: seat,
  type: CELL_TYPES.TAKEOFF,
  entryIndex: ENTRY_INDEX_BY_SEAT[seat],
  specialAction: null,
})));

function wrapMainIndex(index) {
  return (index % MAIN_PATH_LENGTH + MAIN_PATH_LENGTH) % MAIN_PATH_LENGTH;
}

function colorSeatForIndex(index) {
  return [1, 0, 3, 2][wrapMainIndex(index) % 4];
}

function relativeStepForIndex(seat, index) {
  return wrapMainIndex(index - ENTRY_INDEX_BY_SEAT[seat]);
}

export function globalTrackIndex(seat, relativeStep) {
  if (!Number.isInteger(seat) || seat < 0 || seat >= PLAYER_COLORS.length) return null;
  if (!Number.isInteger(relativeStep) || relativeStep < 0 || relativeStep >= MAIN_PATH_LENGTH) return null;
  return wrapMainIndex(ENTRY_INDEX_BY_SEAT[seat] + relativeStep);
}

export const FLIGHT_ROUTE_BY_SEAT = Object.freeze(PLAYER_COLORS.map((color, seat) => Object.freeze({
  seat,
  color,
  entryStep: FLIGHT_ENTRY_STEP,
  exitStep: FLIGHT_EXIT_STEP,
  entryIndex: globalTrackIndex(seat, FLIGHT_ENTRY_STEP),
  exitIndex: globalTrackIndex(seat, FLIGHT_EXIT_STEP),
})));

export const HOME_ENTRY_INDEX_BY_SEAT = Object.freeze(
  PLAYER_COLORS.map((_, seat) => globalTrackIndex(seat, MAIN_PATH_LENGTH - 1)),
);

export const MAIN_PATH = Object.freeze(MAIN_POSITIONS.map(([x, y], pathIndex) => {
  const colorSeat = colorSeatForIndex(pathIndex);
  const entryForSeat = ENTRY_INDEX_BY_SEAT.indexOf(pathIndex);
  const flightForSeat = FLIGHT_ROUTE_BY_SEAT.findIndex((route) => route.entryIndex === pathIndex);
  const homeEntryForSeat = HOME_ENTRY_INDEX_BY_SEAT.indexOf(pathIndex);
  const ownerRouteIndex = relativeStepForIndex(colorSeat, pathIndex);
  const ownerCanJump = ownerRouteIndex + COLOR_JUMP_DISTANCE < MAIN_PATH_LENGTH;
  const specialAction = flightForSeat >= 0
    ? Object.freeze({
        type: CELL_TYPES.FLIGHT,
        ownerSeat: flightForSeat,
        targetIndex: FLIGHT_ROUTE_BY_SEAT[flightForSeat].exitIndex,
      })
    : ownerCanJump ? Object.freeze({
        type: CELL_TYPES.JUMP,
        ownerSeat: colorSeat,
        targetIndex: wrapMainIndex(pathIndex + COLOR_JUMP_DISTANCE),
      }) : null;
  const type = flightForSeat >= 0
      ? CELL_TYPES.FLIGHT
      : homeEntryForSeat >= 0
        ? CELL_TYPES.HOME_ENTRY
        : entryForSeat >= 0
          ? CELL_TYPES.START
          : ownerCanJump
            ? CELL_TYPES.JUMP
            : CELL_TYPES.NORMAL;
  return Object.freeze({
    id: `MAIN_${String(pathIndex).padStart(2, "0")}`,
    pathIndex,
    position: Object.freeze({ x, y }),
    color: PLAYER_COLORS[colorSeat],
    colorSeat,
    type,
    nextIndex: wrapMainIndex(pathIndex + 1),
    entryForSeat: entryForSeat >= 0 ? entryForSeat : null,
    homeEntryForSeat: homeEntryForSeat >= 0 ? homeEntryForSeat : null,
    specialAction,
  });
}));

export const HOME_PATHS = Object.freeze(PLAYER_COLORS.map((color, seat) => Object.freeze(
  HOME_POSITIONS_BY_SEAT[seat].map((position, homeIndex) => Object.freeze({
    id: `HOME_${color}_${homeIndex}`,
    pathIndex: homeIndex,
    position,
    color,
    colorSeat: seat,
    type: CELL_TYPES.HOME_PATH,
    nextIndex: homeIndex + 1 < HOME_PATH_LENGTH ? homeIndex + 1 : null,
    specialAction: null,
  })),
)));

export const FINISH_CELL = Object.freeze({
  id: "FINISH_CENTER",
  pathIndex: FINISH_STEP,
  position: Object.freeze({ x: 7.5, y: 7.5 }),
  color: "MULTI",
  type: CELL_TYPES.FINISH,
  specialAction: null,
});

export const PLAYER_PATHS = Object.freeze(PLAYER_COLORS.map((color, seat) => Object.freeze({
  seat,
  color,
  takeoffCellId: TAKEOFF_CELLS[seat].id,
  entryIndex: ENTRY_INDEX_BY_SEAT[seat],
  homeEntryIndex: HOME_ENTRY_INDEX_BY_SEAT[seat],
  mainIndexes: Object.freeze(Array.from({ length: MAIN_PATH_LENGTH }, (_, step) => globalTrackIndex(seat, step))),
  homeCellIds: Object.freeze(HOME_PATHS[seat].map((cell) => cell.id)),
  finishCellId: FINISH_CELL.id,
})));

export function cellForPlayerStep(seat, step) {
  if (step < 0) return null;
  if (step === TAKEOFF_STEP) return TAKEOFF_CELLS[seat];
  if (step >= MAIN_ROUTE_START_STEP && step <= MAIN_ROUTE_END_STEP) {
    return MAIN_PATH[globalTrackIndex(seat, step - MAIN_ROUTE_START_STEP)];
  }
  if (step >= HOME_ROUTE_START_STEP && step < FINISH_STEP) {
    return HOME_PATHS[seat][step - HOME_ROUTE_START_STEP];
  }
  if (step === FINISH_STEP) return FINISH_CELL;
  return null;
}

export function specialActionForPlayerStep(seat, step) {
  if (step < MAIN_ROUTE_START_STEP || step > MAIN_ROUTE_END_STEP) return null;
  const cell = cellForPlayerStep(seat, step);
  const routeIndex = step - MAIN_ROUTE_START_STEP;
  if (!cell || cell.specialAction?.ownerSeat !== seat) return null;
  if (routeIndex === FLIGHT_ENTRY_STEP) {
    return Object.freeze({
      type: CELL_TYPES.FLIGHT,
      fromStep: step,
      toStep: FLIGHT_EXIT_STEP + MAIN_ROUTE_START_STEP,
      fromIndex: cell.pathIndex,
      toIndex: FLIGHT_ROUTE_BY_SEAT[seat].exitIndex,
    });
  }
  if (routeIndex + COLOR_JUMP_DISTANCE >= MAIN_PATH_LENGTH) return null;
  return Object.freeze({
    type: CELL_TYPES.JUMP,
    fromStep: step,
    toStep: step + COLOR_JUMP_DISTANCE,
    fromIndex: cell.pathIndex,
    toIndex: globalTrackIndex(seat, routeIndex + COLOR_JUMP_DISTANCE),
  });
}

export function debugLabelForCell(cell) {
  const labels = [cell.pathIndex === null ? "T" : String(cell.pathIndex), cell.color];
  if (cell.type === CELL_TYPES.FLIGHT) labels.push(`FLIGHT>${cell.specialAction.targetIndex}`);
  else if (cell.type === CELL_TYPES.TAKEOFF) labels.push(`TAKEOFF P${cell.colorSeat + 1}`);
  else if (cell.type === CELL_TYPES.HOME_ENTRY) labels.push(`HOME P${cell.homeEntryForSeat + 1}`);
  else if (cell.specialAction?.type === CELL_TYPES.JUMP) labels.push(CELL_TYPES.JUMP);
  else labels.push(cell.type);
  return labels;
}

export function validateFlightChessBoardMap() {
  const errors = [];
  if (MAIN_PATH.length !== MAIN_PATH_LENGTH) errors.push("主路线必须恰好包含 52 格。");
  if (new Set(MAIN_PATH.map((cell) => cell.pathIndex)).size !== MAIN_PATH_LENGTH) errors.push("主路线 index 必须唯一。");
  if (new Set(MAIN_PATH.map((cell) => `${cell.position.x}:${cell.position.y}`)).size !== MAIN_PATH_LENGTH) errors.push("主路线坐标必须唯一。");
  MAIN_PATH.forEach((cell, index) => {
    if (cell.pathIndex !== index) errors.push(`主路线 index ${index} 顺序错误。`);
    if (cell.nextIndex !== wrapMainIndex(index + 1)) errors.push(`主路线 index ${index} 的 nextIndex 错误。`);
    const next = MAIN_PATH[cell.nextIndex];
    if (!next) errors.push(`主路线 index ${index} 缺少下一格。`);
  });
  PLAYER_PATHS.forEach((path) => {
    if (new Set(path.mainIndexes).size !== MAIN_PATH_LENGTH) errors.push(`${path.color} 路线没有完整覆盖 52 格。`);
    if (path.mainIndexes[0] !== path.entryIndex) errors.push(`${path.color} 主路线入口错位。`);
    if (path.mainIndexes.at(-1) !== path.homeEntryIndex) errors.push(`${path.color} 归航入口错位。`);
    const flight = FLIGHT_ROUTE_BY_SEAT[path.seat];
    if (MAIN_PATH[flight.entryIndex].color !== path.color || MAIN_PATH[flight.exitIndex].color !== path.color) {
      errors.push(`${path.color} 飞行路线两端颜色不一致。`);
    }
  });
  return errors;
}
