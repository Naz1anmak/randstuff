const RS_DEFAULTS = {
  enabled: true,
  sequencesText: '1 3 3 3 5\n2 3 4 4 5',
  index: 0
};

const RS_MAX_COUNT = 50;

function rsParseSequences(text) {
  const sequences = [];
  const errors = [];
  (text || '').split(/\r?\n/).forEach((rawLine, i) => {
    const line = rawLine.trim();
    if (!line) return;
    const tokens = line.split(/[\s,;]+/).filter(Boolean);
    const bad = tokens.filter(t => !/^-?\d+$/.test(t));
    if (bad.length) {
      errors.push(`Строка ${i + 1}: «${bad.join(' ')}» — не целое число`);
      return;
    }
    if (tokens.length > RS_MAX_COUNT) {
      errors.push(`Строка ${i + 1}: ${tokens.length} чисел, а ползунок сайта позволяет максимум ${RS_MAX_COUNT}`);
      return;
    }
    sequences.push(tokens.map(Number));
  });
  return { sequences, errors };
}
