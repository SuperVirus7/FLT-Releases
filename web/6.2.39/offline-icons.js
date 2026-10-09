'use strict';
document.addEventListener('DOMContentLoaded', () => {
  function updateIcon(icon) {
    const key = [...icon.classList].find(name => name.startsWith('bi-'))?.slice(3);
    if (!window.FLT_ICONS?.[key] || icon.dataset.fltIcon === key) return;
    icon.innerHTML = window.FLT_ICONS[key];
    icon.dataset.fltIcon = key;
    icon.setAttribute('aria-hidden', 'true');
  }
  function scan(root) {
    if (root.matches?.('.bi')) updateIcon(root);
    root.querySelectorAll?.('.bi').forEach(updateIcon);
  }
  scan(document.body);
  new MutationObserver(records => records.forEach(record => {
    if (record.type === 'attributes') {
      if (record.target.matches('.bi')) updateIcon(record.target);
      return;
    }
    record.addedNodes.forEach(node => {
      if (node.nodeType === Node.ELEMENT_NODE && node.namespaceURI !== 'http://www.w3.org/2000/svg') scan(node);
    });
  })).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
});
