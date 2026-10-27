const $seq = document.getElementById('seq');
const $count = document.getElementById('count');
const $countWord = document.getElementById('countWord');
const $minus = document.getElementById('minus');
const $plus = document.getElementById('plus');
const $loop = document.getElementById('loop');
const $hotkeyField = document.getElementById('hotkeyField');
const $save = document.getElementById('save');
const $reset = document.getElementById('reset');
const $status = document.getElementById('status');
const $next = document.getElementById('next');
const $gutter = document.getElementById('gutterLines');
const $hints = document.getElementById('hints');

let saved = { text: '', count: RS_DEFAULTS.count };
let currentIndex = 0;
let loop = RS_DEFAULTS.loop;
let hotkey = rsDefaultHotkey();
let recording = false;
let siteLimits = null;
let siteCount = null;
let errorLines = [];
let curLine = -1; // строка поля, числа из которой сейчас на сайте

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

function renderGutter() {
  const count = $seq.value.split('\n').length;
  // Пока список правят и не сохранили, подсветка указывала бы не туда — убираем
  const hl = $seq.value === saved.text ? curLine : -1;
  let html = '';
  for (let i = 0; i < count; i++) {
    const cls = errorLines.includes(i) ? 'err' : i === hl ? 'cur' : '';
    html += `<div${cls ? ` class="${cls}"` : ''}>${i + 1}</div>`;
  }
  $gutter.innerHTML = html;
  syncGutterScroll();
}
function syncGutterScroll() {
  $gutter.style.transform = `translateY(${-$seq.scrollTop}px)`;
}

// Проверка на лету, до «Сохранить»
function liveCheck() {
  const count = rsClampCount($count.value);
  // При одном числе строку из нескольких чисел разнесём при сохранении — это не ошибка
  const { errors, errorLines: lines } = rsParseSequences($seq.value, count === 1 ? Infinity : count);
  errorLines = lines;
  renderGutter();
  renderHints();
  if (errors.length) setStatus(errors.join('\n'), 'err');
  else if ($seq.value !== saved.text || count !== saved.count) setStatus('Не забудьте сохранить', '');
  else if ($status.className === 'err') setStatus('', '');
}
let liveTimer = 0;
$seq.addEventListener('input', () => {
  renderGutter();
  clearTimeout(liveTimer);
  liveTimer = setTimeout(liveCheck, 300);
});
$seq.addEventListener('scroll', syncGutterScroll);
// Колёсико крутим сами: столбец номеров не прокручивается, а в попапе Яндекса
// поле в фокусе не листается тачпадом
const $gutterBox = $gutter.parentElement;
$gutterBox.parentElement.addEventListener('wheel', (e) => {
  e.preventDefault();
  const k = e.deltaMode === 1 ? 24 : 1; // deltaMode 1 — в строках
  $seq.scrollTop += e.deltaY * k;
  $seq.scrollLeft += e.deltaX * k;
}, { passive: false });
$gutterBox.addEventListener('mousedown', (e) => {
  e.preventDefault();
  $seq.focus();
});

function renderNext() {
  const { sequences, lines } = rsParseSequences(saved.text, saved.count);
  $next.innerHTML = '';
  const listOver = !loop && currentIndex > sequences.length;
  curLine = currentIndex > 0 && sequences.length && !listOver
      ? lines[(currentIndex - 1) % sequences.length] : -1;
  if (!sequences.length) {
    $next.textContent = 'Список пуст — числа будут настоящими.';
    return renderGutter();
  }
  if (!loop && currentIndex >= sequences.length) {
    $next.textContent = 'Список закончился — дальше числа будут настоящими.';
    return renderGutter();
  }
  const i = currentIndex % sequences.length;
  const nextLine = lines[i];
  renderGutter();
  // Чисел выпадет столько, сколько выбрано на сайте, как и в content.js
  const count = siteCount || saved.count;
  const seq = sequences[i].slice(0, count);
  const b = document.createElement('b');
  const rest = count - seq.length;
  const shown = rsApplyLimits(seq, siteLimits).map(v => v ?? '?');
  b.textContent = shown.join(' ') + (rest > 0 ? ' ' + Array(rest).fill('?').join(' ') : '');
  $next.append('Следующим нажатием: ', b, ` (строка ${nextLine + 1})`);
}

chrome.storage.local.get(RS_DEFAULTS, (s) => {
  saved = { text: s.sequencesText, count: rsClampCount(s.count) };
  currentIndex = s.index || 0;
  $seq.value = s.sequencesText;
  $count.value = saved.count;
  loop = $loop.checked = s.loop;
  hotkey = s.hotkey || rsDefaultHotkey();
  siteLimits = s.siteLimits || null;
  siteCount = s.siteCount || null;
  $hotkeyField.textContent = rsHotkeyLabel(hotkey);
  syncCountWord();
  renderNext();
  renderHints();
});

// Подсказки о настройках сайта, которые меняют результат
function renderHints() {
  const hints = [];
  const n = rsClampCount($count.value);
  // Количество задаёт сайт
  if (siteCount && siteCount !== n) {
    const of = `На сайте выбрана последовательность из ${siteCount} ${plural(siteCount, 'числа', 'чисел', 'чисел')}`;
    hints.push(siteCount > n
        ? `${of}. Недостающие числа будут случайными.`
        : `${of}. Лишние числа из строк не подставятся.`);
  }
  if (siteLimits && siteLimits.noRepeat) {
    const { sequences, lines } = rsParseSequences(saved.text, saved.count);
    const withRepeats = lines.filter((line, i) => new Set(sequences[i]).size < sequences[i].length);
    if (withRepeats.length) {
      hints.push(`На сайте исключены повторения. Повторы в ${withRepeats.length > 1 ? 'строках' : 'строке'} ` +
          `${withRepeats.map(l => l + 1).join(', ')} будут случайными числами.`);
    }
  }
  $hints.textContent = hints.join('\n');
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.enabled) {
    setStatus(changes.enabled.newValue ? 'Подмена включена' : 'Подмена выключена — сайт работает как обычно', 'ok');
  }
  if (changes.siteLimits) siteLimits = changes.siteLimits.newValue || null;
  if (changes.siteCount) siteCount = changes.siteCount.newValue || null;
  if (changes.siteLimits || changes.siteCount) renderHints();
  if (changes.index) currentIndex = changes.index.newValue || 0;
  if (changes.index || changes.siteLimits || changes.siteCount) renderNext();
});

function stopRecording() {
  recording = false;
  $hotkeyField.classList.remove('recording');
  $hotkeyField.textContent = rsHotkeyLabel(hotkey);
}
$hotkeyField.addEventListener('click', () => {
  if (recording) return stopRecording();
  recording = true;
  $hotkeyField.classList.add('recording');
  $hotkeyField.textContent = 'Нажмите…';
});
$hotkeyField.addEventListener('blur', () => { if (recording) stopRecording(); });
document.addEventListener('keydown', (e) => {
  if (!recording) return;
  e.preventDefault();
  e.stopImmediatePropagation(); // не даём сработать Ctrl+Enter
  if (e.key === 'Escape') return stopRecording();
  const h = rsHotkeyFromEvent(e);
  if (!h) {
    if (!['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
      setStatus(`Нужен модификатор: ${RS_IS_MAC ? '⌘, ⌥ или ⌃' : 'Ctrl или Alt'}`, 'err');
    }
    return;
  }
  hotkey = h;
  chrome.storage.local.set({ hotkey });
  stopRecording();
  setStatus(`Сочетание сохранено: ${rsHotkeyLabel(hotkey)} (работает на странице RandStuff)`, 'ok');
}, true);

function stepCount(delta) {
  $count.value = rsClampCount(($count.value || saved.count) * 1 + delta);
  syncCountWord();
  liveCheck();
}
$minus.addEventListener('click', () => stepCount(-1));
$plus.addEventListener('click', () => stepCount(+1));
$count.addEventListener('input', () => { syncCountWord(); liveCheck(); });
$count.addEventListener('blur', () => { $count.value = rsClampCount($count.value); syncCountWord(); });

$save.addEventListener('click', () => {
  const count = rsClampCount($count.value);
  $count.value = count;
  let text = $seq.value;
  if (count === 1) text = $seq.value = rsSplitSingle(text);
  const { sequences, errors, errorLines: lines } = rsParseSequences(text, count);
  if (errors.length) {
    errorLines = lines;
    renderGutter();
    setStatus(errors.join('\n'), 'err');
    return;
  }
  errorLines = [];
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
    renderHints();
  });
});

$loop.addEventListener('change', () => {
  loop = $loop.checked;
  chrome.storage.local.set({ loop });
  setStatus(loop ? 'Список будет повторяться по кругу' : 'После последней строки числа будут настоящими', 'ok');
  renderNext();
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
