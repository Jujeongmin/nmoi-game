/* CAVIAR MATCH — hex grid in "offset rows" layout. Pure data + geometry, no DOM.
   Every other row is shifted right by one radius and holds cols - 1 cells.
   `parity` flips when a row is inserted on top so existing rows keep their shift. */
window.CM = window.CM || {};

CM.HexBoard = (function () {
  'use strict';

  const EVEN_DIRS = [[0, -1], [0, 1], [-1, -1], [-1, 0], [1, -1], [1, 0]];
  const SHIFTED_DIRS = [[0, -1], [0, 1], [-1, 0], [-1, 1], [1, 0], [1, 1]];
  const key = (r, c) => r * 64 + c;

  class HexBoard {
    constructor(cols, radius) {
      this.cols = cols;
      this.R = radius;
      this.rowH = radius * Math.sqrt(3);
      this.clear();
    }

    clear() {
      this.rows = [];
      this.parity = 0;
    }

    isShifted(r) { return ((r + this.parity) & 1) === 1; }
    rowLength(r) { return this.isShifted(r) ? this.cols - 1 : this.cols; }
    inBounds(r, c) { return r >= 0 && c >= 0 && c < this.rowLength(r); }

    get(r, c) {
      const row = this.rows[r];
      if (!row || c < 0 || c >= row.length) return null;
      return row[c] === undefined ? null : row[c];
    }

    set(r, c, value) {
      while (this.rows.length <= r) this.rows.push(new Array(this.cols).fill(null));
      this.rows[r][c] = value;
    }

    cellPos(r, c) {
      return {
        x: this.R + c * 2 * this.R + (this.isShifted(r) ? this.R : 0),
        y: this.R + r * this.rowH,
      };
    }

    neighbors(r, c) {
      const dirs = this.isShifted(r) ? SHIFTED_DIRS : EVEN_DIRS;
      const out = [];
      for (const [dr, dc] of dirs) {
        const rr = r + dr, cc = c + dc;
        if (this.inBounds(rr, cc)) out.push([rr, cc]);
      }
      return out;
    }

    forEach(cb) {
      for (let r = 0; r < this.rows.length; r++) {
        const len = this.rowLength(r);
        for (let c = 0; c < len; c++) {
          const v = this.rows[r][c];
          if (v !== null && v !== undefined) cb(r, c, v);
        }
      }
    }

    count() {
      let n = 0;
      this.forEach(() => n++);
      return n;
    }

    lowestRow() {
      let low = -1;
      this.forEach((r) => { if (r > low) low = r; });
      return low;
    }

    presentTypes() {
      const set = new Set();
      this.forEach((r, c, v) => set.add(v));
      return set;
    }

    /** Push a new row on top. `fill(r, c, board)` returns a type index or null. */
    insertTopRow(fill) {
      this.rows.unshift(new Array(this.cols).fill(null));
      this.parity ^= 1;
      const len = this.rowLength(0);
      for (let c = 0; c < len; c++) this.rows[0][c] = fill(0, c, this);
    }

    trim() {
      while (this.rows.length && this.rows[this.rows.length - 1].every((v) => v === null)) {
        this.rows.pop();
      }
    }

    /** Connected cells sharing the type at (r, c). */
    findGroup(r, c) {
      const type = this.get(r, c);
      if (type === null) return [];
      const seen = new Set([key(r, c)]);
      const stack = [[r, c]];
      const group = [];
      while (stack.length) {
        const cell = stack.pop();
        group.push(cell);
        for (const [nr, nc] of this.neighbors(cell[0], cell[1])) {
          const k = key(nr, nc);
          if (!seen.has(k) && this.get(nr, nc) === type) {
            seen.add(k);
            stack.push([nr, nc]);
          }
        }
      }
      return group;
    }

    /** Occupied cells with no path to the top row. */
    findDetached() {
      const seen = new Set();
      const queue = [];
      const len0 = this.rows.length ? this.rowLength(0) : 0;
      for (let c = 0; c < len0; c++) {
        if (this.get(0, c) !== null) { seen.add(key(0, c)); queue.push([0, c]); }
      }
      while (queue.length) {
        const [r, c] = queue.shift();
        for (const [nr, nc] of this.neighbors(r, c)) {
          const k = key(nr, nc);
          if (!seen.has(k) && this.get(nr, nc) !== null) { seen.add(k); queue.push([nr, nc]); }
        }
      }
      const out = [];
      this.forEach((r, c) => { if (!seen.has(key(r, c))) out.push([r, c]); });
      return out;
    }
  }

  return HexBoard;
})();
