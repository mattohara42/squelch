import { PRESET_LIBRARY } from './presetLibrary.js';

// Per-machine pattern bar: named-pattern select, rename, New, Duplicate, and
// a Presets loader. Structural changes (switch/new/duplicate/load-preset)
// call onStructureChange so main can rebuild the panels against the new
// active pattern.
export function createPatternBar(container, { store, machineKey, makeBlank, onStructureChange }) {
  const bar = document.createElement('div');
  bar.className = 'pattern-bar';
  container.appendChild(bar);

  const mkLabel = (text) => {
    const l = document.createElement('span');
    l.className = 'pat-bar-label';
    l.textContent = text;
    l.setAttribute('aria-hidden', 'true'); // decorative; controls carry their own aria-label
    return l;
  };

  bar.appendChild(mkLabel('Pattern'));

  const select = document.createElement('select');
  select.className = 'pat-select';
  select.setAttribute('aria-label', 'Active pattern');
  const active = store.activePattern(machineKey);
  for (const p of store.getState().patterns[machineKey]) {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name; // textContent, not innerHTML: names are user text
    opt.selected = p.id === active.id;
    select.appendChild(opt);
  }
  bar.appendChild(select);

  const nameInput = document.createElement('input');
  nameInput.className = 'pat-name';
  nameInput.type = 'text';
  nameInput.value = active.name;
  nameInput.setAttribute('aria-label', 'Pattern name');
  bar.appendChild(nameInput);

  const newBtn = document.createElement('button');
  newBtn.textContent = 'New';
  bar.appendChild(newBtn);

  const dupBtn = document.createElement('button');
  dupBtn.textContent = 'Duplicate';
  bar.appendChild(dupBtn);

  // Presets loader: a select that appends the chosen library pattern as a new
  // active pattern, then snaps back to its placeholder label. A divider + label
  // separate it from the active-pattern controls so the two selects don't read
  // as duplicates: left = switch between YOUR patterns, right = LOAD a factory
  // one into a new slot.
  const divider = document.createElement('span');
  divider.className = 'pat-bar-divider';
  divider.setAttribute('aria-hidden', 'true');
  bar.appendChild(divider);
  bar.appendChild(mkLabel('Load'));

  const presetSelect = document.createElement('select');
  presetSelect.className = 'pat-preset';
  presetSelect.setAttribute('aria-label', 'Load a preset pattern');
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Preset…';
  presetSelect.appendChild(placeholder);
  (PRESET_LIBRARY[machineKey] || []).forEach((entry, i) => {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = entry.name;
    presetSelect.appendChild(opt);
  });
  presetSelect.addEventListener('change', () => {
    const idx = presetSelect.value;
    presetSelect.value = '';
    if (idx === '') return;
    const { pattern, patch } = PRESET_LIBRARY[machineKey][parseInt(idx, 10)].create();
    store.edit((s) => {
      s.patterns[machineKey].push(pattern);
      s.active[machineKey] = pattern.id;
    });
    // A 303 preset also carries its knob patch (the sound). Applying it is a
    // performance change (setNoUndo), matching how live knob moves persist.
    if (patch) store.setNoUndo((s) => { s.patches[machineKey] = patch; });
    onStructureChange();
  });
  bar.appendChild(presetSelect);

  select.addEventListener('change', () => {
    store.edit((s) => { s.active[machineKey] = select.value; });
    onStructureChange();
  });

  nameInput.addEventListener('change', () => {
    const name = nameInput.value.trim() || 'Untitled';
    store.edit(() => { store.activePattern(machineKey).name = name; });
    select.querySelector(`option[value="${CSS.escape(store.getState().active[machineKey])}"]`).textContent = name;
  });

  newBtn.addEventListener('click', () => {
    const p = makeBlank();
    store.edit((s) => {
      s.patterns[machineKey].push(p);
      s.active[machineKey] = p.id;
    });
    onStructureChange();
  });

  dupBtn.addEventListener('click', () => {
    const copy = structuredClone(store.activePattern(machineKey));
    copy.id = crypto.randomUUID();
    copy.name = `${copy.name} copy`;
    store.edit((s) => {
      s.patterns[machineKey].push(copy);
      s.active[machineKey] = copy.id;
    });
    onStructureChange();
  });
}
