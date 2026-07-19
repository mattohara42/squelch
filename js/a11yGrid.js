// Roving-tabindex keyboard navigation for a 2D grid of focusable cells, so a
// 12x16 (or lane x 16) step grid is one Tab stop, and arrow keys move focus
// between cells. Enter/Space fire the cell's own click (native, for <button>).
// onColumnKey(col, event) handles extra per-column shortcuts (accent, slide,
// octave) and returns true if it consumed the key.
export function rovingGrid(cells, { onColumnKey } = {}) {
  const rows = cells.length;
  let fr = 0, fc = 0;

  const setTabstops = () => {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cells[r].length; c++) {
        cells[r][c].tabIndex = (r === fr && c === fc) ? 0 : -1;
      }
    }
  };
  const move = (r, c) => {
    fr = Math.max(0, Math.min(rows - 1, r));
    fc = Math.max(0, Math.min(cells[fr].length - 1, c));
    setTabstops();
    cells[fr][fc].focus();
  };

  cells.forEach((row, r) => row.forEach((el, c) => {
    el.addEventListener('keydown', (e) => {
      switch (e.key) {
        case 'ArrowRight': move(r, c + 1); break;
        case 'ArrowLeft': move(r, c - 1); break;
        case 'ArrowDown': move(r + 1, c); break;
        case 'ArrowUp': move(r - 1, c); break;
        case 'Home': move(r, 0); break;
        case 'End': move(r, cells[r].length - 1); break;
        default:
          if (onColumnKey && onColumnKey(c, e)) break;
          return; // not ours
      }
      e.preventDefault();
    });
    // Keep the roving state in sync when focus arrives by mouse/Tab.
    el.addEventListener('focus', () => { fr = r; fc = c; setTabstops(); });
  }));

  setTabstops();
}
