// In-app Learn panel: a "How to play" quick-start tutorial and "The machines"
// historical notes. Accessible modal — role=dialog, focus trap, Escape to
// close, focus returns to the trigger, and the app behind it is made inert.

const TUTORIAL = `
  <p class="help-lead">Make your first beat in about a minute — press RUN and start clicking.</p>
  <ol class="help-steps">
    <li><b>Start it.</b> Press <span class="kbd">RUN</span> (or the <span class="kbd">Space</span> bar) to play the pattern on a loop. Press again to stop.</li>
    <li><b>Pick an instrument.</b> Use the tabs: <b>303-A</b> and <b>303-B</b> are bass synths; <b>808</b> and <b>909</b> are drum machines. They all keep playing — the tab just chooses what you're editing.</li>
    <li><b>Program drums.</b> On 808 or 909, click the squares to add hits. Each row is a drum — Kick, Snare, Closed Hat… Click a drum's <b>name</b> to tweak its sound (Level, Tone, Decay) on the right. The small <b>A</b> in a square makes that hit an accent (louder).</li>
    <li><b>Program bass.</b> On a 303, the grid is a mini piano — rows are pitches (keyboard on the left), columns are steps. Click to place a note; click it again for a rest. Use <b>▼/▲</b> under a step to move a note down or up an octave. <b>A</b> = accent, <b>S</b> = slide — slide glides into the next note, the secret behind the classic "acid" sound.</li>
    <li><b>Get squelchy.</b> On the 303's right-hand panel, turn up <b>Cutoff</b> and <b>Resonance</b> while it plays — that's the sound the TB-303 is famous for. <b>Reset Knobs</b> returns to a clean tone.</li>
    <li><b>Mix and mangle.</b> The Mixer at the bottom sets each machine's Level and can route it through <b>Distortion</b> and <b>Delay</b>; the shared knobs shape those effects. Flip a channel's <b>Dist</b> or <b>Delay</b> light on and listen.</li>
    <li><b>Build a track.</b> Your work saves automatically. Make more patterns with <b>New</b>, <b>Duplicate</b>, or <b>Presets…</b>, then switch to <b>Song</b> mode (top right) to chain patterns into a full arrangement.</li>
  </ol>
  <p class="help-note">Keyboard: <span class="kbd">Space</span> play/stop, <span class="kbd">⌘/Ctrl</span>+<span class="kbd">Z</span> undo. Every control is keyboard-operable — Tab to it, then use the arrow keys.</p>
`;

// Original stylized SVG "portraits" — evocative, not reproductions of Roland
// trade dress (per the project's no-artwork rule). Accent-colored per machine.
function svgSynth(accent) {
  const knobs = [40, 90, 140, 190, 240].map((x) =>
    `<circle cx="${x}" cy="50" r="12" fill="#33333a" stroke="#000"/><line x1="${x}" y1="50" x2="${x}" y2="40" stroke="${accent}" stroke-width="2" stroke-linecap="round"/>`).join('');
  const blackKeys = [42, 72, 112, 152, 182, 222, 252].map((x) => `<rect x="${x}" y="80" width="9" height="13" fill="#111"/>`).join('');
  return `<svg class="machine-svg" viewBox="0 0 300 106" role="img" aria-hidden="true" focusable="false">
    <rect x="2" y="2" width="296" height="102" rx="10" fill="#1b1b1f" stroke="${accent}" stroke-opacity="0.55"/>
    <rect x="12" y="12" width="276" height="14" rx="3" fill="#2a2a30"/>
    ${knobs}
    <rect x="12" y="78" width="276" height="20" rx="3" fill="#e6e6ea"/>${blackKeys}
  </svg>`;
}
function svgDrum(accent) {
  const knobs = [42, 92, 142, 192, 242].map((x) =>
    `<circle cx="${x}" cy="42" r="10" fill="#33333a" stroke="#000"/><line x1="${x}" y1="42" x2="${x}" y2="34" stroke="${accent}" stroke-width="2" stroke-linecap="round"/>`).join('');
  const lit = new Set([0, 4, 7, 11, 12]);
  let pads = '';
  for (let i = 0; i < 16; i++) pads += `<rect x="${16 + i * 17.4}" y="74" width="13" height="18" rx="2" fill="${lit.has(i) ? accent : '#33333a'}" stroke="#000"/>`;
  return `<svg class="machine-svg" viewBox="0 0 300 106" role="img" aria-hidden="true" focusable="false">
    <rect x="2" y="2" width="296" height="102" rx="10" fill="#1b1b1f" stroke="${accent}" stroke-opacity="0.55"/>
    <rect x="12" y="12" width="276" height="14" rx="3" fill="#2a2a30"/>
    ${knobs}${pads}
  </svg>`;
}
const a = (href, text) => `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`;
const WIKI = (slug, text) => a(`https://en.wikipedia.org/wiki/${slug}`, text);

const HISTORY = `
  <p class="help-lead">SQUELCH recreates a rack of classic Roland instruments — two TB-303 bass synths, a TR-808 and a TR-909 drum machine — the same lineup as Propellerhead's 1997 software ${WIKI('ReBirth_RB-338', 'ReBirth RB-338')}, an early landmark of computer-based instruments. All three Roland originals sold poorly when new, then found a second life in the hands of underground producers and quietly rewrote the sound of modern music. Here's the story.</p>

  <div class="machine-note">
    ${svgSynth('#b6e33a')}
    <h4>${WIKI('Roland_TB-303', 'TB-303')} — the accidental acid machine <span class="yr">1981</span></h4>
    <p>Roland built the Bass Line as a "bassist in a box" for guitarists to practice against. It was fiddly to program, sounded nothing like a real bass, sold poorly, and was discontinued within two years. Cheap on the secondhand market, it was rediscovered in mid-'80s Chicago, where producers found that cranking its resonant filter and overdriving it made a squelchy, liquid tone unlike anything else. Phuture's 1987 ${WIKI('Acid_Tracks', '"Acid Tracks"')} is widely credited with defining ${WIKI('Acid_house', 'acid house')} from that sound. The 303's cutoff, resonance, envelope, accent and slide — all recreated here — went on to drive records from ${WIKI('Higher_State_of_Consciousness', "Josh Wink's “Higher State of Consciousness”")} to Hardfloor, Plastikman, and Aphex Twin, and its DNA runs through techno, trance, and electro. Original units now fetch thousands, and clones from the x0xb0x to Roland's own reissues keep the sound going.</p>
  </div>

  <div class="machine-note">
    ${svgDrum('#4db8ff')}
    <h4>${WIKI('Roland_TR-808', 'TR-808')} — the heartbeat of hip-hop <span class="yr">1980</span></h4>
    <p>The Rhythm Composer was fully analog, so its drums didn't sound "real" — and it, too, flopped, with Roland making only about 12,000 before pulling it in 1983. But those unreal sounds — the long, booming kick, the snappy snare, the cowbell, clap and hats — became a palette all their own. Marvin Gaye's 1982 "Sexual Healing" was an early hit built on it; Afrika Bambaataa's ${WIKI('Planet_Rock_(song)', '"Planet Rock"')} the same year made it the backbone of electro and hip-hop. Tuned low and long, its kick became the sub-bass of ${WIKI('Miami_bass', 'Miami bass')} and later Southern hip-hop and ${WIKI('Trap_music', 'trap')}, where "the 808" now simply means that bass. It's among the most sampled instruments ever made — enough to inspire the documentary <i>808</i> (2015) and the title of Kanye West's <i>808s &amp; Heartbreak</i>.</p>
  </div>

  <div class="machine-note">
    ${svgDrum('#ff5a3c')}
    <h4>${WIKI('Roland_TR-909', 'TR-909')} — the pulse of house and techno <span class="yr">1983</span></h4>
    <p>Roland's follow-up split the difference: analog kick, snare and toms, but sampled (digital) hi-hats and cymbals, plus MIDI to sync with the emerging world of computers and sequencers. Like its siblings it underwhelmed at launch — then producers in Chicago and Detroit, and every rave since, built their music on its punchy kick and hissing hats. The 909 is the four-on-the-floor heartbeat of ${WIKI('House_music', 'house')} and ${WIKI('Techno', 'techno')}: its kick and open hat are instantly recognizable across three decades of dance music.</p>
  </div>

  <p class="help-note">The thread through all three: commercial disappointments, resurrected by the people who ignored the instruction manuals — and in doing so, they rewrote the DNA of modern music. Software like ReBirth spread that sound to anyone with a computer; SQUELCH brings it to the browser.</p>
`;

const TABS = [
  { id: 'play', label: 'How to play', html: TUTORIAL },
  { id: 'history', label: 'The machines', html: HISTORY },
];

export function createHelp() {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.hidden = true;
  backdrop.innerHTML = `
    <div class="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="help-title">
      <div class="modal-head">
        <h2 id="help-title">Learn SQUELCH</h2>
        <button type="button" class="modal-close" aria-label="Close">✕</button>
      </div>
      <div class="modal-tabs" role="tablist" aria-label="Help sections"></div>
      <div class="modal-body"></div>
    </div>`;
  document.body.appendChild(backdrop);

  const dialog = backdrop.querySelector('.modal-dialog');
  const tabsEl = backdrop.querySelector('.modal-tabs');
  const body = backdrop.querySelector('.modal-body');
  const closeBtn = backdrop.querySelector('.modal-close');

  const tabButtons = TABS.map((t, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'modal-tab';
    btn.id = `help-tab-${t.id}`;
    btn.textContent = t.label;
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-controls', 'help-pane');
    btn.addEventListener('click', () => select(i));
    btn.addEventListener('keydown', (e) => {
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      const n = (i + d + TABS.length) % TABS.length;
      select(n);
      tabButtons[n].focus();
    });
    tabsEl.appendChild(btn);
    return btn;
  });

  const pane = document.createElement('div');
  pane.id = 'help-pane';
  pane.setAttribute('role', 'tabpanel');
  pane.setAttribute('tabindex', '0');
  body.appendChild(pane);

  function select(i) {
    tabButtons.forEach((b, j) => {
      const sel = i === j;
      b.classList.toggle('active', sel);
      b.setAttribute('aria-selected', String(sel));
      b.tabIndex = sel ? 0 : -1;
    });
    pane.innerHTML = TABS[i].html;
    pane.setAttribute('aria-labelledby', tabButtons[i].id);
    body.scrollTop = 0;
  }
  select(0);

  const outside = [document.querySelector('header'), document.querySelector('main')].filter(Boolean);
  let lastFocused = null;

  const focusables = () => backdrop.querySelectorAll('button, [href], input, select, [tabindex]:not([tabindex="-1"])');

  const onKeydown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key !== 'Tab') return;
    const f = [...focusables()].filter((el) => el.offsetParent !== null || el === document.activeElement);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  const open = () => {
    lastFocused = document.activeElement;
    backdrop.hidden = false;
    outside.forEach((el) => { el.inert = true; });
    document.addEventListener('keydown', onKeydown, true);
    closeBtn.focus();
  };
  const close = () => {
    backdrop.hidden = true;
    outside.forEach((el) => { el.inert = false; });
    document.removeEventListener('keydown', onKeydown, true);
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  };

  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) close(); });

  return { open, close };
}
