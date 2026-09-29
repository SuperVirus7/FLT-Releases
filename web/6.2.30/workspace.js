'use strict';
// Presentation and accessibility only. All feature actions keep their original handlers.
document.addEventListener('DOMContentLoaded', () => {
  const main = document.getElementById('main');
  const sidebar = document.getElementById('sidebar');
  const nav = [...sidebar.querySelectorAll('.nav-btn')];
  const body = document.body;
  const skip = document.createElement('a');
  skip.className = 'skip-link'; skip.href = '#main'; skip.textContent = 'Skip to content';
  body.prepend(skip);
  main.tabIndex = -1;
  sidebar.setAttribute('aria-label', 'Workspace navigation');
  const bar = document.createElement('header');
  bar.id = 'workspace-bar';
  bar.innerHTML = '<button id="sidebar-toggle" type="button" aria-label="Collapse navigation" aria-expanded="true" title="Collapse navigation">☰</button><div class="workspace-crumb"><span id="workspace-platform">Kick</span><span aria-hidden="true">/</span><span id="workspace-page">Dispatcher</span></div><div class="workspace-tools"><button id="density-toggle" type="button" aria-pressed="false" title="Switch between comfortable and compact spacing">Compact view</button><button id="workspace-search" type="button" aria-haspopup="dialog">Go to page<kbd>Ctrl K</kbd></button></div>';
  document.getElementById('app-clip').append(bar);
  const density = document.getElementById('density-toggle');
  function setDensity(compact) {
    body.classList.toggle('ui-compact', compact);
    density.setAttribute('aria-pressed', String(compact));
    density.textContent = compact ? 'Comfortable view' : 'Compact view';
  }
  try { setDensity(localStorage.getItem('flt_compact') === 'true'); } catch (_) {}
  density.addEventListener('click', () => {
    setDensity(!body.classList.contains('ui-compact'));
    try { localStorage.setItem('flt_compact', String(body.classList.contains('ui-compact'))); } catch (_) {}
  });
  document.querySelector('.sb-brand-meta').textContent = 'COMMAND CENTER';
  const toggle = document.getElementById('sidebar-toggle');
  const setCollapsed = collapsed => {
    body.classList.toggle('sidebar-collapsed', collapsed);
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.setAttribute('aria-label', `${collapsed ? 'Expand' : 'Collapse'} navigation`);
    toggle.title = toggle.getAttribute('aria-label');
  };
  try { setCollapsed(localStorage.getItem('flt_sidebar_collapsed') === 'true'); } catch (_) {}
  toggle.addEventListener('click', () => {
    setCollapsed(!body.classList.contains('sidebar-collapsed'));
    try { localStorage.setItem('flt_sidebar_collapsed', String(body.classList.contains('sidebar-collapsed'))); } catch (_) {}
  });
  const pageLabel = button => button.querySelector('.nav-lbl')?.textContent.trim() || button.textContent.trim();
  nav.forEach(button => { button.title = pageLabel(button); button.setAttribute('aria-label', pageLabel(button)); });
  const syncNavigation = () => {
    const active = nav.find(button => button.classList.contains('active'));
    nav.forEach(button => {
      if (button === active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    if (active) document.getElementById('workspace-page').textContent = pageLabel(active);
    document.getElementById('workspace-platform').textContent = body.classList.contains('platform-discord') ? 'Discord' : body.classList.contains('platform-x') ? 'X' : 'Kick';
    document.querySelectorAll('.ps-btn').forEach(button => button.setAttribute('aria-pressed', String(button.classList.contains('active'))));
  };
  const navigationObserver = new MutationObserver(syncNavigation);
  nav.forEach(button => navigationObserver.observe(button, { attributes: true, attributeFilter: ['class'] }));
  syncNavigation();

  const quick = document.createElement('div');
  quick.id = 'modalQuickNav'; quick.className = 'overlay';
  quick.innerHTML = '<div class="modal" id="quick-nav"><div class="modal-head"><h3 id="quick-nav-title">Go to page</h3><button class="modal-x" type="button" data-close="modalQuickNav" aria-label="Close navigation">×</button></div><div class="modal-body"><label class="lbl" for="quick-nav-input">Search all workspaces</label><input id="quick-nav-input" class="inp" type="search" placeholder="Find a page…" autocomplete="off"><div id="quick-nav-results"></div><p id="quick-nav-empty" hidden>No matching pages. Try another name.</p></div></div>';
  body.append(quick);
  const search = document.getElementById('quick-nav-input');
  const results = document.getElementById('quick-nav-results');
  function renderDestinations() {
    results.replaceChildren();
    const query = search.value.trim().toLowerCase();
    nav.filter(button => `${pageLabel(button)} ${button.dataset.platform}`.toLowerCase().includes(query)).forEach(button => {
      const destination = document.createElement('button');
      destination.type = 'button'; destination.className = 'quick-nav-option';
      const title = document.createElement('span'); title.textContent = pageLabel(button);
      const platform = document.createElement('small'); platform.textContent = button.dataset.platform === 'shared' ? 'System' : button.dataset.platform;
      destination.append(title, platform);
      destination.addEventListener('click', () => {
        if (button.dataset.platform !== 'shared') window.Platform?.set(button.dataset.platform, true);
        button.click();
        window.closeModal('modalQuickNav');
        requestAnimationFrame(() => main.focus());
      });
      results.append(destination);
    });
    document.getElementById('quick-nav-empty').hidden = results.childElementCount > 0;
  }
  function openQuickNav() { search.value = ''; renderDestinations(); window.openModal('modalQuickNav'); }
  document.getElementById('workspace-search').addEventListener('click', openQuickNav);
  search.addEventListener('input', renderDestinations);
  search.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown' || event.key === 'Enter') {
      event.preventDefault();
      const first = results.querySelector('button');
      if (event.key === 'Enter') first?.click(); else first?.focus();
    }
  });
  results.addEventListener('keydown', event => {
    if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    event.preventDefault();
    const buttons = [...results.children];
    const index = buttons.indexOf(document.activeElement);
    buttons[(index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus();
  });
  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      if (!document.querySelector('.overlay.open')) openQuickNav();
    }
  });

  // Track class-driven dialogs, including legacy modules that bypass openModal.
  const dialogReturns = new Map();
  let lastOutsideFocus = document.activeElement;
  document.addEventListener('focusin', event => {
    if (!event.target.closest('.overlay')) lastOutsideFocus = event.target;
  });
  const focusable = element => [...element.querySelectorAll('button,input,select,textarea,a[href],[tabindex]')].filter(node => !node.disabled && node.tabIndex >= 0 && node.getClientRects().length && !node.closest('[inert]'));
  const registeredDialogs = new WeakSet();
  let dialogIndex = 0;
  function registerDialog(overlay) {
    if (registeredDialogs.has(overlay)) return;
    const dialog = overlay.querySelector('.modal');
    if (!dialog) return;
    registeredDialogs.add(overlay);
    const index = dialogIndex++;
    // Portals keep a dialog outside the inert application shell.
    body.append(overlay);
    dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true'); dialog.tabIndex = -1;
    const heading = dialog.querySelector('h3,h2');
    if (heading) { heading.id ||= `workspace-dialog-title-${index}`; dialog.setAttribute('aria-labelledby', heading.id); }
    else dialog.setAttribute('aria-label', 'Dialog');
    const syncDialog = () => {
      if (overlay.classList.contains('open') && !dialogReturns.has(overlay)) {
        dialogReturns.set(overlay, lastOutsideFocus);
        document.getElementById('app-clip').inert = true;
        const preferred = dialog.querySelector('input:not([type="hidden"]),textarea,select');
        (preferred && preferred.getClientRects().length ? preferred : focusable(dialog)[0] || dialog).focus();
      } else if (!overlay.classList.contains('open') && dialogReturns.has(overlay)) {
        const previous = dialogReturns.get(overlay); dialogReturns.delete(overlay);
        document.getElementById('app-clip').inert = dialogReturns.size > 0;
        if (previous?.isConnected && !previous.closest('[inert]')) previous.focus();
      }
    };
    const observer = new MutationObserver(syncDialog);
    observer.observe(overlay, { attributes: true, attributeFilter: ['class'] });
    overlay.addEventListener('keydown', event => {
      if (event.key !== 'Tab') return;
      const elements = focusable(dialog), first = elements[0], last = elements.at(-1);
      if (!first) { event.preventDefault(); dialog.focus(); }
      else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    syncDialog();
  }
  document.querySelectorAll('.overlay').forEach(registerDialog);
  const labels = { liveChatDisconnectBtn: 'Disconnect chat', liveChatSendBtn: 'Send chat message', logRefreshBtn: 'Refresh logs', savePresetBtn: 'Save preset', importPresetsBtn: 'Import presets', clearPresetsBtn: 'Clear presets', fbSelectAllBtn: 'Select all accounts', fbClearSelBtn: 'Clear account selection', 'tb-min': 'Minimize window', 'tb-max': 'Maximize or restore window', 'tb-close': 'Close window' };
  Object.entries(labels).forEach(([id, label]) => document.getElementById(id)?.setAttribute('aria-label', label));
  document.querySelectorAll('.modal-x').forEach(button => button.setAttribute('aria-label', button.getAttribute('aria-label') || 'Close dialog'));
  document.querySelectorAll('input,select,textarea').forEach(input => {
    if (input.getAttribute('aria-label') || input.labels?.length) return;
    const fieldLabel = input.closest('.field')?.querySelector('label');
    if (fieldLabel && input.id) fieldLabel.htmlFor = input.id;
    else if (input.title || input.placeholder) input.setAttribute('aria-label', input.title || input.placeholder);
  });
  document.getElementById('notifWrap').setAttribute('aria-live', 'polite');
  document.getElementById('notifWrap').setAttribute('aria-relevant', 'additions');
  new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
    if (node.nodeType === Node.ELEMENT_NODE && node.namespaceURI !== 'http://www.w3.org/2000/svg') {
      if (node.matches('.overlay')) registerDialog(node);
      node.querySelectorAll('.overlay').forEach(registerDialog);
    }
  }))).observe(body, { childList: true, subtree: true });
});
