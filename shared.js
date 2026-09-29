const RS_DEFAULTS = {
  enabled: true,
  loop: true, // false — после последней строки числа настоящие
  count: 5,
  sequencesText: '1 2 3 4 5\n2 3 4 4 5',
  index: 0,
  hotkey: null // null — сочетание по умолчанию для текущей ОС
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
  const errors = [];
  (text || '').split(/\r?\n/).forEach((rawLine, i) => {
    const line = rawLine.trim();
    if (!line) return; // пустые строки пропускаем
    const tokens = line.split(/[\s,;]+/).filter(Boolean);
    const bad = tokens.filter(t => !/^-?\d+$/.test(t));
    if (bad.length) {
      errors.push(`Строка ${i + 1}: «${bad.join(' ')}» — не целое число`);
      return;
    }
    if (tokens.length > count) {
      errors.push(`Строка ${i + 1}: ${tokens.length} чисел, а генерируется ${count}`);
      return;
    }
    sequences.push(tokens.map(Number));
  });
  return { sequences, errors };
}

// --- Горячая клавиша вкл/выкл подмены ---
// Храним { code, ctrl, alt, shift, meta }. code — физическая клавиша (KeyY),
// поэтому сочетание работает и в русской раскладке.

const RS_IS_MAC = /mac/i.test(navigator.userAgentData?.platform || navigator.platform || '');

function rsDefaultHotkey() {
  return RS_IS_MAC
      ? { code: 'KeyY', ctrl: false, alt: false, shift: true, meta: true }
      : { code: 'KeyY', ctrl: true, alt: false, shift: true, meta: false };
}

function rsHotkeyFromEvent(e) {
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return null; // нажат только модификатор
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
