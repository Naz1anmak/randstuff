const $seq = document.getElementById('seq');
const $count = document.getElementById('count');
const $countWord = document.getElementById('countWord');
const $minus = document.getElementById('minus');
const $plus = document.getElementById('plus');
const $enabled = document.getElementById('enabled');
const $save = document.getElementById('save');
const $reset = document.getElementById('reset');
const $status = document.getElementById('status');
const $next = document.getElementById('next');

let saved = { text: '', count: RS_DEFAULTS.count };
let currentIndex = 0;

function setStatus(text, kind) {
  $status.textContent = text;
  $status.className = kind || '';
}

function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

function syncCountWord() {
  const n = rsClampCount($count.value);
  $countWord.textContent = plural(n, 'число', 'числа', 'чисел');
}

function renderNext() {
  const { sequences } = rsParseSequences(saved.text, saved.count);
  $next.innerHTML = '';
  if (!sequences.length) {
    $next.textContent = `Список пуст — ползунок встанет на ${saved.count}, числа будут настоящими.`;
    return;
  }
  const i = currentIndex % sequences.length;
  const seq = sequences[i];
  const b = document.createElement('b');
  const rest = saved.count - seq.length;
  b.textContent = seq.join(' ') + (rest > 0 ? ' ' + Array(rest).fill('?').join(' ') : '');
  $next.append('Следующим нажатием: ', b, ` (строка ${i + 1} из ${sequences.length})`);
}

chrome.storage.local.get(RS_DEFAULTS, (s) => {
  saved = { text: s.sequencesText, count: rsClampCount(s.count) };
  currentIndex = s.index || 0;
  $seq.value = s.sequencesText;
  $count.value = saved.count;
  $enabled.checked = s.enabled;
  syncCountWord();
  renderNext();
});

function stepCount(delta) {
  $count.value = rsClampCount(($count.value || saved.count) * 1 + delta);
  syncCountWord();
  setStatus('Не забудьте сохранить', '');
}
$minus.addEventListener('click', () => stepCount(-1));
$plus.addEventListener('click', () => stepCount(+1));
$count.addEventListener('input', () => { syncCountWord(); setStatus('Не забудьте сохранить', ''); });
$count.addEventListener('blur', () => { $count.value = rsClampCount($count.value); syncCountWord(); });

$save.addEventListener('click', () => {
  const count = rsClampCount($count.value);
  $count.value = count;
  const text = $seq.value;
  const { sequences, errors } = rsParseSequences(text, count);
  if (errors.length) {
    setStatus(errors.join('\n'), 'err');
    return;
  }
  const patch = { sequencesText: text, count };
  if (text !== saved.text) patch.index = 0; // новый список — начинаем с первой строки
  chrome.storage.local.set(patch, () => {
    saved = { text, count };
    if ('index' in patch) currentIndex = 0;
    setStatus(
        `Сохранено: ${count} ${plural(count, 'число', 'числа', 'чисел')}, ` +
        `${sequences.length} ${plural(sequences.length, 'последовательность', 'последовательности', 'последовательностей')}`,
        'ok'
    );
    renderNext();
  });
});

$enabled.addEventListener('change', () => {
  chrome.storage.local.set({ enabled: $enabled.checked });
  setStatus($enabled.checked ? 'Расширение включено' : 'Расширение выключено — сайт работает как обычно', 'ok');
});

$reset.addEventListener('click', () => {
  chrome.storage.local.set({ index: 0 }, () => {
    currentIndex = 0;
    setStatus('Следующей будет первая строка', 'ok');
    renderNext();
  });
});

// Ctrl+Enter — сохранить
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) $save.click();
});
