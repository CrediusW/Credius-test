// @ts-check

(function () {
  "use strict";

  function cellKey(row, col) {
    return `${row}:${col}`;
  }

  function areAdjacent(first, second) {
    return Math.abs(first.row - second.row) + Math.abs(first.col - second.col) === 1;
  }

  function swapCells(board, first, second) {
    const value = board[first.row][first.col];
    board[first.row][first.col] = board[second.row][second.col];
    board[second.row][second.col] = value;
    return board;
  }

  function findMatches(board) {
    const matches = new Set();
    const rows = board.length;
    const cols = board[0]?.length ?? 0;

    for (let row = 0; row < rows; row += 1) {
      let runStart = 0;
      for (let col = 1; col <= cols; col += 1) {
        const current = col < cols ? board[row][col] : null;
        if (current && current === board[row][runStart]) continue;
        if (board[row][runStart] && col - runStart >= 3) {
          for (let runCol = runStart; runCol < col; runCol += 1) {
            matches.add(cellKey(row, runCol));
          }
        }
        runStart = col;
      }
    }

    for (let col = 0; col < cols; col += 1) {
      let runStart = 0;
      for (let row = 1; row <= rows; row += 1) {
        const current = row < rows ? board[row][col] : null;
        if (current && current === board[runStart][col]) continue;
        if (board[runStart][col] && row - runStart >= 3) {
          for (let runRow = runStart; runRow < row; runRow += 1) {
            matches.add(cellKey(runRow, col));
          }
        }
        runStart = row;
      }
    }

    return matches;
  }

  function getPossibleMoves(board) {
    const moves = [];
    const rows = board.length;
    const cols = board[0]?.length ?? 0;
    const directions = [
      { row: 0, col: 1 },
      { row: 1, col: 0 },
    ];

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        for (const direction of directions) {
          const neighbor = { row: row + direction.row, col: col + direction.col };
          if (neighbor.row >= rows || neighbor.col >= cols) continue;
          const first = { row, col };
          swapCells(board, first, neighbor);
          const createsMatch = findMatches(board).size > 0;
          swapCells(board, first, neighbor);
          if (createsMatch) moves.push({ first, second: neighbor });
        }
      }
    }
    return moves;
  }

  function createBoard(rows, cols, types, random = Math.random) {
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const board = Array.from({ length: rows }, () => Array(cols).fill(""));
      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          const blocked = new Set();
          if (col >= 2 && board[row][col - 1] === board[row][col - 2]) {
            blocked.add(board[row][col - 1]);
          }
          if (row >= 2 && board[row - 1][col] === board[row - 2][col]) {
            blocked.add(board[row - 1][col]);
          }
          const choices = types.filter((type) => !blocked.has(type));
          board[row][col] = choices[Math.floor(random() * choices.length)] ?? types[0];
        }
      }
      if (getPossibleMoves(board).length) return board;
    }
    throw new Error("Unable to generate a playable match board");
  }

  function collapseBoard(board, types, random = Math.random) {
    const rows = board.length;
    const cols = board[0]?.length ?? 0;
    for (let col = 0; col < cols; col += 1) {
      const remaining = [];
      for (let row = rows - 1; row >= 0; row -= 1) {
        if (board[row][col]) remaining.push(board[row][col]);
      }
      for (let row = rows - 1; row >= 0; row -= 1) {
        board[row][col] = remaining[rows - 1 - row]
          ?? types[Math.floor(random() * types.length)]
          ?? types[0];
      }
    }
    return board;
  }

  function collapseBoardWithPayloads(
    board,
    payloads,
    types,
    random = Math.random,
    createPayload = () => false,
  ) {
    const rows = board.length;
    const cols = board[0]?.length ?? 0;
    for (let col = 0; col < cols; col += 1) {
      const remaining = [];
      for (let row = rows - 1; row >= 0; row -= 1) {
        if (board[row][col]) {
          remaining.push({ value: board[row][col], payload: Boolean(payloads[row][col]) });
        }
      }
      for (let row = rows - 1; row >= 0; row -= 1) {
        const existing = remaining[rows - 1 - row];
        board[row][col] = existing?.value
          ?? types[Math.floor(random() * types.length)]
          ?? types[0];
        payloads[row][col] = existing ? existing.payload : Boolean(createPayload(row, col));
      }
    }
    return { board, payloads };
  }

  function shuffleBoard(board, random = Math.random) {
    const values = board.flat().filter(Boolean);
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const shuffled = values.slice();
      for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const target = Math.floor(random() * (index + 1));
        [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
      }
      const candidate = board.map((row, rowIndex) =>
        row.map((_, colIndex) => shuffled[rowIndex * row.length + colIndex]),
      );
      if (findMatches(candidate).size === 0 && getPossibleMoves(candidate).length) {
        return candidate;
      }
    }
    return board.map((row) => row.slice());
  }

  function getRoundOutcome({ score, target, moves, skillCharge = 0, skillCost = 3 }) {
    if (score >= target) return "passed";
    if (moves > 0) return "playing";
    if (skillCharge >= skillCost) return "skill-overtime";
    return "failed";
  }

  globalThis.CrediusHappyMatchRules = {
    areAdjacent,
    cellKey,
    collapseBoard,
    collapseBoardWithPayloads,
    createBoard,
    findMatches,
    getRoundOutcome,
    getPossibleMoves,
    shuffleBoard,
    swapCells,
  };
})();
