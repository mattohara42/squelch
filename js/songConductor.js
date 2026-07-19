// Song-mode conductor: a scheduler "machine" that advances through song rows
// on bar boundaries (step 0 of each 16-step cycle). It must be registered
// BEFORE the instrument panels so a row change lands before they read the
// step — panels then ask currentPatternId() for what to play. Pure logic,
// injectable callbacks, unit-tested in test/song.test.js.
export function createSongConductor({ getSong, isSongMode, onRowChange, requestStop }) {
  let row = 0;
  let barInRow = 0;
  let started = false;

  return {
    currentRow: () => row,
    currentPatternId(machineKey) {
      const r = getSong().rows[row];
      return r ? (r.pats[machineKey] || null) : null;
    },
    onStep(stepIndex, time) {
      if (!isSongMode() || stepIndex !== 0) return;
      if (!started) {
        started = true;
        onRowChange(row, time);
        return;
      }
      barInRow++;
      const song = getSong();
      const repeat = song.rows[row] ? Math.max(1, song.rows[row].repeat) : 1;
      if (barInRow < repeat) return;
      barInRow = 0;
      row++;
      if (row >= song.rows.length) {
        if (!song.loop) {
          row = 0;
          requestStop(); // async on the caller's side: mustn't stop mid-iteration
          return;
        }
        row = 0;
      }
      onRowChange(row, time);
    },
    onStop() {
      row = 0;
      barInRow = 0;
      started = false;
      onRowChange(-1, 0); // clear the playing-row indicator
    },
  };
}
