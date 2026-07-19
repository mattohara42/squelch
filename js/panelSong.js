// Song row editor (M7): ordered rows of per-machine pattern refs + repeat
// count, per the locked data model. The Pattern/Song view toggle lives in the
// transport now; this panel is the arranger only (loop toggle, rows, add/
// remove). Structural song edits go through `edit` (undoable); `rebuild`
// re-renders this panel.
import { CFG } from './config.js';

export function createSongPanel(container, { store, machineDefs, edit, rebuild, now }) {
  container.innerHTML = '';
  const root = document.createElement('div');
  root.className = 'panelSong';
  container.appendChild(root);

  const header = document.createElement('div');
  header.className = 'song-header';
  root.appendChild(header);

  const title = document.createElement('h2');
  title.textContent = 'Song';
  header.appendChild(title);

  const loopLabel = document.createElement('label');
  loopLabel.className = 'song-loop';
  const loopBox = document.createElement('input');
  loopBox.type = 'checkbox';
  loopBox.checked = store.getState().song.loop;
  loopBox.addEventListener('change', () => {
    edit((s) => { s.song.loop = loopBox.checked; });
  });
  loopLabel.appendChild(loopBox);
  loopLabel.appendChild(document.createTextNode(' Loop song'));
  header.appendChild(loopLabel);

  const rowsWrap = document.createElement('div');
  rowsWrap.className = 'song-rows';
  root.appendChild(rowsWrap);

  const song = store.getState().song;
  const rowEls = song.rows.map((rowData, i) => {
    const rowEl = document.createElement('div');
    rowEl.className = 'song-row';

    const num = document.createElement('div');
    num.className = 'song-row-num';
    num.textContent = i + 1;
    num.setAttribute('aria-hidden', 'true');
    rowEl.appendChild(num);

    for (const def of machineDefs) {
      const select = document.createElement('select');
      select.setAttribute('aria-label', `Row ${i + 1} ${def.label} pattern`);
      const noneOpt = document.createElement('option');
      noneOpt.value = '';
      noneOpt.textContent = `${def.label}: —`;
      select.appendChild(noneOpt);
      for (const p of store.getState().patterns[def.key]) {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = `${def.label}: ${p.name}`;
        opt.selected = rowData.pats[def.key] === p.id;
        select.appendChild(opt);
      }
      select.addEventListener('change', () => {
        edit((s) => { s.song.rows[i].pats[def.key] = select.value || null; });
      });
      rowEl.appendChild(select);
    }

    const repeat = document.createElement('input');
    repeat.type = 'number';
    repeat.className = 'song-repeat';
    repeat.min = 1;
    repeat.max = CFG.SONG.REPEAT_MAX;
    repeat.value = rowData.repeat;
    repeat.title = 'bars';
    repeat.setAttribute('aria-label', `Row ${i + 1} repeat, bars`);
    repeat.addEventListener('change', () => {
      const v = Math.min(CFG.SONG.REPEAT_MAX, Math.max(1, parseInt(repeat.value, 10) || 1));
      repeat.value = v;
      edit((s) => { s.song.rows[i].repeat = v; });
    });
    rowEl.appendChild(repeat);

    const remove = document.createElement('button');
    remove.textContent = '✕';
    remove.setAttribute('aria-label', `Remove row ${i + 1}`);
    remove.disabled = song.rows.length === 1; // a song always has at least one row
    remove.addEventListener('click', () => {
      edit((s) => { s.song.rows.splice(i, 1); });
      rebuild();
    });
    rowEl.appendChild(remove);

    rowsWrap.appendChild(rowEl);
    return rowEl;
  });

  const addBtn = document.createElement('button');
  addBtn.textContent = 'Add Row';
  addBtn.className = 'song-add';
  addBtn.addEventListener('click', () => {
    edit((s) => {
      s.song.rows.push({
        pats: Object.fromEntries(machineDefs.map((d) => [d.key, s.active[d.key]])),
        repeat: 1,
      });
    });
    rebuild();
  });
  root.appendChild(addBtn);

  const pendingHighlights = [];
  return {
    // row -1 clears the indicator (transport stopped).
    setPlayingRow(row, time) {
      const apply = () => rowEls.forEach((el, i) => el.classList.toggle('playing', i === row));
      if (row === -1) {
        for (const id of pendingHighlights) clearTimeout(id);
        pendingHighlights.length = 0;
        apply();
      } else {
        pendingHighlights.push(setTimeout(apply, Math.max(0, (time - now()) * 1000)));
      }
    },
  };
}
