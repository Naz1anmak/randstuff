(() => {
  const TAG = '[RandStuff ext]';

  let state = { ...RS_DEFAULTS };
  let sequences = [];

  function reparse() {
    state.count = rsClampCount(state.count);
    // Строки с ошибками парсер отбрасывает, валидные остаются
    sequences = rsParseSequences(state.sequencesText, state.count).sequences;
  }
  reparse();

  chrome.storage.local.get(RS_DEFAULTS, (s) => {
    state = s;
    reparse();
    console.log(TAG, `количество: ${state.count}, последовательностей: ${sequences.length}`);
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    for (const [key, { newValue }] of Object.entries(changes)) state[key] = newValue;
    if (changes.sequencesText || changes.count) reparse();
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

  function collectNumbers(root) {
    const nodes = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n);

    const starts = [];
    const lengths = [];
    let full = '';
    for (const n of nodes) {
      starts.push(full.length);
      lengths.push(n.data.length);
      full += n.data;
    }

    const matches = [];
    const re = /-?\d+/g;
    for (let m = re.exec(full); m; m = re.exec(full)) {
      matches.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
    }
    return { nodes, starts, lengths, matches };
  }

  function writeNumber(info, match, value) {
    let first = true;
    info.nodes.forEach((node, k) => {
      const s = info.starts[k];
      const e = s + info.lengths[k];
      if (e <= match.start || s >= match.end) return; // узел не относится к числу
      const a = Math.max(s, match.start) - s;
      const b = Math.min(e, match.end) - s;
      node.data = node.data.slice(0, a) + (first ? value : '') + node.data.slice(b);
      first = false;
    });
  }

  let armed = null; // { seq, count, until }

  function apply() {
    if (!armed) return;
    if (Date.now() > armed.until) { armed = null; return; }

    const box = document.getElementById('number');
    if (!box) return applyFallback();

    const info = collectNumbers(box);
    // Если чисел в блоке больше, чем генерируется, берём последние count
    const offset = Math.max(0, info.matches.length - armed.count);
    const ours = info.matches.slice(offset, offset + armed.seq.length);

    for (let i = ours.length - 1; i >= 0; i--) {
      const want = String(armed.seq[i]);
      if (ours[i].text !== want) writeNumber(info, ours[i], want);
    }
  }

  function applyFallback() {
    const spans = [...document.querySelectorAll('span')]
        .filter(s => /^\s*-?\d+\s*$/.test(s.textContent));
    if (spans.length < armed.count) return;
    spans.slice(-armed.count).slice(0, armed.seq.length).forEach((el, i) => {
      const want = String(armed.seq[i]);
      if (el.textContent.trim() !== want) el.textContent = el.textContent.replace(/-?\d+/, want);
    });
  }

  const observer = new MutationObserver(() => apply());
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });

  window.addEventListener('click', (e) => {
    const btn = e.target.closest && e.target.closest('#button, input[value="Сгенерировать"]');
    if (!btn) return;
    if (!state.enabled) return; // сайт работает как обычно

    // Ползунок ставим всегда (даже при пустом списке — тогда числа будут настоящими)
    moveSlider(state.count);

    if (!sequences.length) {
      console.log(TAG, `ползунок → ${state.count}, подмены нет (список пуст)`);
      return;
    }

    const idx = (state.index || 0) % sequences.length;
    const seq = sequences[idx];
    state.index = (state.index || 0) + 1;
    chrome.storage.local.set({ index: state.index });

    armed = { seq, count: state.count, until: Date.now() + 20000 };
    requestAnimationFrame(apply);

    console.log(TAG, `ползунок → ${state.count}, последовательность #${idx + 1}:`, seq.join(' '));
  }, true);

  console.log(TAG, 'загружено');
})();
