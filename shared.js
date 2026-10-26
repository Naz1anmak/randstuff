const RS_DEFAULTS = {
  enabled: true,
  loop: true,
  count: 5,
  sequencesText: '1 2 3 4 5\n2 3 4 4 5',
  index: 0,
  hotkey: null, // null — по умолчанию для текущей ОС
  siteLimits: null,
  siteCount: null
};

const RS_MIN_COUNT = 1;
const RS_MAX_COUNT = 50;

function rsClampCount(n) {
  n = Math.round(Number(n));
  if (!Number.isFinite(n)) return RS_DEFAULTS.count;
  return Math.min(RS_MAX_COUNT, Math.max(RS_MIN_COUNT, n));
}

function rsParseSequences(text, count) {
  const sequences = [];
  const lines = [];
  const errors = [];
  const errorLines = [];
  (text || '').split(/\r?\n/).forEach((rawLine, i) => {
    const line = rawLine.trim();
    if (!line) return; // пустые строки пропускаем
    const tokens = line.split(/[\s,;]+/).filter(Boolean);
    const bad = tokens.filter(t => !/^-?\d+$/.test(t));
    if (bad.length) {
      errors.push(`Строка ${i + 1}: «${bad.join(' ')}» — не целое число`);
      errorLines.push(i);
      return;
    }
    if (tokens.length > count) {
      errors.push(`Строка ${i + 1}: ${tokens.length} чисел, а генерируется ${count}`);
      errorLines.push(i);
      return;
    }
    sequences.push(tokens.map(Number));
    lines.push(i);
  });
  return { sequences, lines, errors, errorLines };
}

// При одном числе строка «1,2,3» — это список: разносим по строкам
function rsSplitSingle(text) {
  return text.split(/\r?\n/).flatMap((line) => {
    const tokens = line.trim().split(/[\s,;]+/).filter(Boolean);
    return tokens.length > 1 && tokens.every(t => /^-?\d+$/.test(t)) ? tokens : [line];
  }).join('\n');
}

function rsParseInts(text) {
  return (String(text || '').match(/-?\d+/g) || []).map(Number);
}

// limits: { mode: 'range', min, max, exclude } | { mode: 'list', list, exclude } | { mode: 'any', exclude }
function rsViolation(v, limits) {
  if (!limits) return '';
  if (limits.exclude.includes(v)) return 'в списке исключений';
  if (limits.mode === 'list') {
    return limits.list.length && !limits.list.includes(v) ? 'нет в списке сайта' : '';
  }
  if (limits.mode !== 'range') return '';
  return v < limits.min || v > limits.max ? `вне диапазона ${limits.min}–${limits.max}` : '';
}

const RS_IS_MAC = /mac/i.test(navigator.userAgentData?.platform || navigator.platform || '');

function rsDefaultHotkey() {
  return RS_IS_MAC
      ? { code: 'KeyY', ctrl: false, alt: false, shift: true, meta: true }
      : { code: 'KeyY', ctrl: true, alt: false, shift: true, meta: false };
}

// Числа строки после проверки ограничений; null — сайт так выдать не может, будет настоящее
function rsApplyLimits(seq, limits) {
  const seen = new Set();
  return seq.map((v) => {
    if (rsViolation(v, limits)) return null;
    if (limits && limits.noRepeat && seen.has(v)) return null; // «исключить повторения»
    seen.add(v);
    return v;
  });
}

// code — физическая клавиша (KeyY), поэтому сочетание работает и в русской раскладке
function rsHotkeyFromEvent(e) {
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return null;
  if (!e.ctrlKey && !e.altKey && !e.metaKey) return null; // без модификатора мешало бы вводу
  return { code: e.code, ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey, meta: e.metaKey };
}

function rsHotkeyMatches(e, h) {
  return e.code === h.code && e.ctrlKey === h.ctrl && e.altKey === h.alt &&
      e.shiftKey === h.shift && e.metaKey === h.meta;
}

function rsHotkeyLabel(h) {
  const key = h.code.replace(/^Key|^Digit/, '');
  if (RS_IS_MAC) {
    return (h.ctrl ? '⌃' : '') + (h.alt ? '⌥' : '') + (h.shift ? '⇧' : '') + (h.meta ? '⌘' : '') + key;
  }
  return [h.ctrl && 'Ctrl', h.alt && 'Alt', h.shift && 'Shift', h.meta && 'Win', key]
      .filter(Boolean).join('+');
}
