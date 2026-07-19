// Reusable rotary knob. Mouse: vertical drag (Shift = fine, double-click =
// reset). Keyboard: focusable slider — Arrow/Page keys adjust, Home/End jump
// to min/max, with ARIA so screen readers announce the value.
import { CFG } from './config.js';

export function createKnob(container, { label, min, max, value, onChange, format = (v) => (Math.round(v * 100) / 100), size = 'md' }) {
  const range = max - min;
  const coarse = range / 20; // ~one step per arrow press
  const fine = range / 100;
  const page = range / 5;

  const root = document.createElement('div');
  root.className = 'knob-widget' + (size === 'sm' ? ' knob-sm' : '');
  root.innerHTML = `
    <div class="knob" role="slider" tabindex="0"${label ? ` aria-label="${label}"` : ''}>
      <div class="knob-indicator"></div><div class="knob-value"></div>
    </div>
    ${label ? `<div class="knob-label" aria-hidden="true">${label}</div>` : ''}`;
  container.appendChild(root);

  const knobEl = root.querySelector('.knob');
  const indicator = root.querySelector('.knob-indicator');
  const bubble = root.querySelector('.knob-value');
  const defaultValue = value;
  let current = value;

  knobEl.setAttribute('aria-valuemin', String(min));
  knobEl.setAttribute('aria-valuemax', String(max));

  const render = () => {
    const frac = (current - min) / range;
    const deg = -CFG.UI.KNOB_ROTATION_DEG / 2 + frac * CFG.UI.KNOB_ROTATION_DEG;
    indicator.style.transform = `rotate(${deg}deg)`;
    const text = format(current);
    bubble.textContent = text;
    knobEl.setAttribute('aria-valuenow', String(Math.round(current * 100) / 100));
    knobEl.setAttribute('aria-valuetext', String(text));
  };

  const setValue = (v, fire = true) => {
    current = Math.min(max, Math.max(min, v));
    render();
    if (fire) onChange(current);
  };

  knobEl.addEventListener('mousedown', (e) => {
    const startY = e.clientY;
    const startValue = current;
    knobEl.classList.add('dragging');
    const onMove = (ev) => {
      const sensitivity = ev.shiftKey ? CFG.UI.KNOB_FINE_FACTOR : 1;
      const frac = ((startY - ev.clientY) / CFG.UI.KNOB_DRAG_RANGE_PX) * sensitivity;
      setValue(startValue + frac * range);
    };
    const onUp = () => {
      knobEl.classList.remove('dragging');
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    e.preventDefault();
  });

  knobEl.addEventListener('dblclick', () => setValue(defaultValue));

  knobEl.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? fine : coarse;
    let handled = true;
    switch (e.key) {
      case 'ArrowUp': case 'ArrowRight': setValue(current + step); break;
      case 'ArrowDown': case 'ArrowLeft': setValue(current - step); break;
      case 'PageUp': setValue(current + page); break;
      case 'PageDown': setValue(current - page); break;
      case 'Home': setValue(min); break;
      case 'End': setValue(max); break;
      default: handled = false;
    }
    if (handled) e.preventDefault();
  });

  render();
  return { getValue: () => current, setValue: (v) => setValue(v, false) };
}
