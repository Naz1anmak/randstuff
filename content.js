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
    // иначе подмена ещё до 20 с держит прошлое число
    if (changes.enabled && !changes.enabled.newValue) armed = null;
  });

  // Количество чисел задаёт ползунок сайта; попапу отдаём его для подсказки
  const siteCount = () => parseInt((document.getElementById('slider-val') || {}).textContent, 10) || null;
  let lastSiteCount;
  function publishSiteCount() {
    const n = siteCount();
    if (n === lastSiteCount) return;
    lastSiteCount = n;
    chrome.storage.local.set({ siteCount: n });
    publishLimits(); // «исключить повторения» видна только при 2+ числах
  }
  const sliderLabel = document.getElementById('slider-val');
  if (sliderLabel) {
    new MutationObserver(publishSiteCount)
        .observe(sliderLabel, { childList: true, characterData: true, subtree: true });
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

  function readLimits() {
    const val = id => (document.getElementById(id) || {}).value || '';
    const excludeBox = document.querySelector('#number-exclude input[type=checkbox]');
    const exclude = excludeBox && excludeBox.checked ? rsParseInts(val('number-exclude-list')) : [];
    const repeatBox = document.querySelector('input[aria-label="исключить повторения"]');
    const noRepeat = !!(repeatBox && repeatBox.checked && repeatBox.offsetParent);
    const listMode = document.querySelector('input[name=from][value=list]');
    // Пустые поля сайт считает нулём, а «от 100 до 1» — диапазоном 1–100
    if (listMode && listMode.checked) {
      const list = rsParseInts(val('number-list'));
      return { mode: 'list', list: list.length ? list : [0], exclude, noRepeat };
    }
    const [from = 0] = rsParseInts(val('number-start'));
    const [to = 0] = rsParseInts(val('number-end'));
    return { mode: 'range', min: Math.min(from, to), max: Math.max(from, to), exclude, noRepeat };
  }

  let lastLimits = '';
  function publishLimits() {
    const json = JSON.stringify(readLimits());
    if (json === lastLimits) return;
    lastLimits = json;
    chrome.storage.local.set({ siteLimits: JSON.parse(json) });
  }
  publishSiteCount(); // заодно публикует и ограничения
  document.addEventListener('input', publishLimits, true);
  document.addEventListener('change', publishLimits, true);

  let armed = null; // { seq, count, limits, until }; null в seq — число не подменяем

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
      if (armed.seq[i] === null) continue;
      const want = String(armed.seq[i]);
      if (ours[i].text !== want) writeNumber(info, ours[i], want);
    }
    if (armed.limits && armed.limits.noRepeat) fixRepeats(box);
  }

  // Настоящее число сайта может совпасть с подставленным — меняем его на свободное
  function fixRepeats(box) {
    const info = collectNumbers(box);
    const offset = Math.max(0, info.matches.length - armed.count);
    const all = info.matches.slice(offset, offset + armed.count);
    const mine = new Set(armed.seq.filter(v => v !== null));
    const used = new Set(all.map(m => Number(m.text)));
    for (let i = all.length - 1; i >= 0; i--) {
      if (i < armed.seq.length && armed.seq[i] !== null) continue;
      if (!mine.has(Number(all[i].text))) continue;
      const v = rsPickFree(armed.limits, used);
      if (v === null) continue;
      used.add(v);
      writeNumber(info, all[i], String(v));
    }
  }

  function applyFallback() {
    const spans = [...document.querySelectorAll('span')]
        .filter(s => /^\s*-?\d+\s*$/.test(s.textContent));
    if (spans.length < armed.count) return;
    spans.slice(-armed.count).slice(0, armed.seq.length).forEach((el, i) => {
      if (armed.seq[i] === null) return;
      const want = String(armed.seq[i]);
      if (el.textContent.trim() !== want) el.textContent = el.textContent.replace(/-?\d+/, want);
    });
  }

  const observer = new MutationObserver(() => apply());
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });

  window.addEventListener('click', (e) => {
    const btn = e.target.closest && e.target.closest('#button, input[value="Сгенерировать"]');
    if (!btn) return;
    armed = null;
    if (!state.enabled) return; // сайт работает как обычно
    const count = siteCount() || state.count;

    if (!sequences.length) {
      console.log(TAG, 'подмены нет (список пуст)');
      return;
    }

    if (!state.loop && (state.index || 0) >= sequences.length) {
      // index > длины списка — знак для попапа, что на сайте уже настоящее число
      if (state.index === sequences.length) chrome.storage.local.set({ index: state.index + 1 });
      console.log(TAG, 'список закончился — числа настоящие');
      return;
    }

    const idx = (state.index || 0) % sequences.length;
    const limits = readLimits();
    // Чисел в строке больше, чем выбрано на сайте, — лишние не подставляем
    const seq = rsApplyLimits(sequences[idx].slice(0, count), limits);
    state.index = (state.index || 0) + 1;
    chrome.storage.local.set({ index: state.index });

    armed = { seq, count, limits, until: Date.now() + 20000 };
    requestAnimationFrame(apply);

    console.log(TAG, `чисел: ${count}, последовательность #${idx + 1}:`, seq.map(v => v ?? '?').join(' '));
    seq.forEach((v, i) => {
      const want = sequences[idx][i];
      if (v !== null || want === null) return; // ? в строке — настоящее число и так
      const why = rsViolation(want, limits) || 'повторяется, а повторения исключены';
      console.warn(TAG, `${want} ${why} — оставлено настоящее число`);
    });
  }, true);

  window.addEventListener('keydown', (e) => {
    if (e.repeat || !rsHotkeyMatches(e, state.hotkey || rsDefaultHotkey())) return;
    e.preventDefault();
    chrome.storage.local.set({ enabled: !state.enabled });
    console.log(TAG, state.enabled ? 'подмена выключена' : 'подмена включена');
  }, true);

  console.log(TAG, 'загружено');
})();
