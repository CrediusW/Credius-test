// @ts-check

(function () {
  "use strict";

  /**
   * A row is complete only when every playable cell contains a locked block.
   *
   * @param {string[][]} board
   * @returns {number[]}
   */
  function findCompleteRows(board) {
    const columnCount = board[0]?.length ?? 0;
    if (!columnCount) {
      return [];
    }

    return board.reduce((completeRows, row, rowIndex) => {
      if (row.length === columnCount && row.every((cell) => Boolean(cell))) {
        completeRows.push(rowIndex);
      }
      return completeRows;
    }, /** @type {number[]} */ ([]));
  }

  /**
   * Remove only the rows confirmed by findCompleteRows and preserve board size.
   *
   * @param {string[][]} board
   * @param {number[]} rowIndexes
   * @returns {string[][]}
   */
  function removeRows(board, rowIndexes) {
    const columnCount = board[0]?.length ?? 0;
    const completeRows = new Set(findCompleteRows(board));
    const rowsToRemove = new Set(rowIndexes.filter((rowIndex) => completeRows.has(rowIndex)));
    const nextBoard = board
      .filter((_, rowIndex) => !rowsToRemove.has(rowIndex))
      .map((row) => row.slice());

    while (nextBoard.length < board.length) {
      nextBoard.unshift(Array(columnCount).fill(""));
    }

    return nextBoard;
  }

  globalThis.CrediusTetrisLineRules = {
    findCompleteRows,
    removeRows,
  };
})();
