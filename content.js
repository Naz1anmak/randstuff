(() => {
  const TAG = '[RandStuff ext]';

  let state = { ...RS_DEFAULTS };
  let sequences = rsParseSequences(state.sequencesText).sequences;

  chrome.storage.local.get(RS_DEFAULTS, (s) => {
    state = s;
    sequences = rsParseSequences(state.sequencesText).sequences;
    console.log(TAG, 'загружено последовательностей:', sequences.length);
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    for (const [key, { newValue }] of Object.entries(changes)) state[key] = newValue;
    if (changes.sequencesText) sequences = rsParseSequences(state.sequencesText).sequences;
  });

  function moveSlider(count) {
    const slider = document.getElementById('slider');
    if (!slider) {
      console.warn(TAG, '#slider не найден');
      return false;
    }
    const min = Number(slider.dataset.min ?? 1);
    const max = Number(slider.dataset.max ?? RS_MAX_COUNT);
    const target = Math.min(max, Math.max(min, count));

    const rect = slider.getBoundingClientRect();
    if (!rect.width) {
      console.warn(TAG, 'у ползунка нулевая ширина (скрыт?)');
      return false;
    }
    const ratio = max === min ? 0 : (target - min) / (max - min);
    const x = rect.left + ratio * rect.width;
    const y = rect.top + rect.height / 2;

    const base = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y, button: 0 };
    slider.dispatchEvent(new MouseEvent('mousedown', { ...base, buttons: 1 }));
    document.dispatchEvent(new MouseEvent('mouseup', { ...base, buttons: 0 }));

    // Проверка: сайт пишет «5 случайных чисел» в #slider-val
    const label = document.getElementById('slider-val');
    const shown = label ? parseInt(label.textContent, 10) : NaN;
    if (label && shown !== target) {
      console.warn(TAG, `ползунок: хотели ${target}, на странице ${label.textContent.trim()}`);
    }
    return true;
  }

  const NUM_RE = /^\s*-?\d+\s*$/;

  function numberLeaves(root) {
    return [...root.querySelectorAll('*')].filter(
      el => el.childElementCount === 0 && NUM_RE.test(el.textContent)
    );
  }

  function findTargets(n) {
    const box = document.getElementById('number');
    if (box) {
      if (n === 1 && box.childElementCount === 0 && NUM_RE.test(box.textContent)) return [box];
      const inside = numberLeaves(box);
      if (inside.length >= n) return inside.slice(-n);
    }
    const spans = [...document.querySelectorAll('span')].filter(s => NUM_RE.test(s.textContent));
    return spans.length >= n ? spans.slice(-n) : null;
  }

  let armed = null; // { seq, until }

  function apply() {
    if (!armed) return;
    if (Date.now() > armed.until) { armed = null; return; }
    const targets = findTargets(armed.seq.length);
    if (!targets) return;
    targets.forEach((el, i) => {
      const want = String(armed.seq[i]);
      const current = el.textContent.trim();
      if (current !== want) {
        // Меняем только само число, пробелы вокруг сохраняем
        el.textContent = el.textContent.replace(/-?\d+/, want);
      }
    });
  }

  const observer = new MutationObserver(() => apply());
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });

  window.addEventListener('click', (e) => {
    const btn = e.target.closest && e.target.closest('#button, input[value="Сгенерировать"]');
    if (!btn) return;
    if (!state.enabled || !sequences.length) return;

    const idx = (state.index || 0) % sequences.length;
    const seq = sequences[idx];
    state.index = (state.index || 0) + 1;
    chrome.storage.local.set({ index: state.index });

    moveSlider(seq.length);

    armed = { seq, until: Date.now() + 20000 };
    requestAnimationFrame(apply);

    console.log(TAG, `последовательность #${idx + 1}:`, seq.join(' '));
  }, true);

  console.log(TAG, 'загружено');
})();
