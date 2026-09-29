// Значок OFF на иконке, пока подмена выключена.
// Саму горячую клавишу слушает content.js на странице RandStuff.

function updateBadge(enabled) {
  chrome.action.setBadgeText({ text: enabled ? '' : 'OFF' });
  chrome.action.setBadgeBackgroundColor({ color: '#888' });
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.enabled) updateBadge(changes.enabled.newValue);
});

chrome.storage.local.get({ enabled: true }, ({ enabled }) => updateBadge(enabled));
