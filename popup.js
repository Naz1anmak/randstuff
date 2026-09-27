const $seq = document.getElementById('seq');
const $enabled = document.getElementById('enabled');
const $save = document.getElementById('save');
const $reset = document.getElementById('reset');
const $status = document.getElementById('status');
const $next = document.getElementById('next');

let savedText = '';
let currentIndex = 0;

function setStatus(text, kind) {
  $status.textContent = text;
  $status.className = kind || '';
}

function renderNext() {
  const { sequences } = rsParseSequences(savedText);
  if (!sequences.length) {
    $next.textContent = 'Список пуст — сайт будет работать как обычно.';
    return;
  }
  const i = currentIndex % sequences.length;
  $next.innerHTML = '';
  $next.append('Следующим нажатием: ');
  const b = document.createElement('b');
  b.textContent = sequences[i].join(' ');
  $next.append(b, ` (строка ${i + 1} из ${sequences.length})`);
}

chrome.storage.local.get(RS_DEFAULTS, (s) => {
  savedText = s.sequencesText;
  currentIndex = s.index || 0;
  $seq.value = s.sequencesText;
  $enabled.checked = s.enabled;
  renderNext();
});

$save.addEventListener('click', () => {
  const text = $seq.value;
  const { sequences, errors } = rsParseSequences(text);
  if (errors.length) {
    setStatus(errors.join('\n'), 'err');
    return;
  }
  const patch = { sequencesText: text };
  if (text !== savedText) patch.index = 0;
  chrome.storage.local.set(patch, () => {
    savedText = text;
    if ('index' in patch) currentIndex = 0;
    setStatus(`Сохранено: ${sequences.length} ${plural(sequences.length)}`, 'ok');
    renderNext();
  });
});

$enabled.addEventListener('change', () => {
  chrome.storage.local.set({ enabled: $enabled.checked });
  setStatus($enabled.checked ? 'Подмена включена' : 'Подмена выключена — сайт работает как обычно', 'ok');
});

$reset.addEventListener('click', () => {
  chrome.storage.local.set({ index: 0 }, () => {
    currentIndex = 0;
    setStatus('Следующей будет первая строка', 'ok');
    renderNext();
  });
});

// Ctrl+Enter — сохранить
$seq.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) $save.click();
});

function plural(n) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'последовательность';
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'последовательности';
  return 'последовательностей';
}
