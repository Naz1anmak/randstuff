const RS_DEFAULTS = {
  enabled: true,
  count: 5,
  sequencesText: '1 2 3 4 5\n2 3 4 4 5',
  index: 0
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
