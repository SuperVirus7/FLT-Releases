'use strict';
document.addEventListener('DOMContentLoaded', () => {
  const active = document.getElementById('page-activemode');
  const accounts = document.getElementById('page-accounts');
  if (!active || !accounts) return;
  const byId = id => document.getElementById(id);

  // Keep existing controls and handlers; reorganize only their presentation.
  const workspace = document.createElement('div');
  workspace.className = 'am-workspace';
  const chat = active.querySelector('.am2-chat-col');
  const video = byId('am2VideoCol');
  active.querySelector('.am2-body').append(workspace);
  workspace.append(chat, video);
  const history = byId('amHistory').closest('.am2-panel');
  const historyDetails = document.createElement('details');
  historyDetails.className = 'am-history-details am2-panel';
  const historySummary = document.createElement('summary');
  historySummary.textContent = 'Session history';
  historyDetails.append(historySummary, history);
  workspace.append(historyDetails);

  // Labels stay associated after reorganizing the setup panels.
  active.querySelectorAll('.am2-field').forEach(field => {
    const input = field.querySelector('input,select');
    const label = field.querySelector('label.am2-lbl');
    if (input?.id && label) label.htmlFor = input.id;
  });
  active.querySelectorAll('label.am2-tog-row').forEach(label => {
    const nestedLabel = label.querySelector('label.tog');
    if (!nestedLabel) return;
    const track = document.createElement('span');
    track.className = nestedLabel.className;
    track.append(...nestedLabel.childNodes);
    nestedLabel.replaceWith(track);
    label.htmlFor = track.querySelector('input').id;
  });
  byId('liveChatSendAs').setAttribute('aria-label', 'Chat account');
  byId('lcMsgLimit').setAttribute('aria-label', 'Messages kept in chat');
  byId('liveChatInput').setAttribute('aria-label', 'Chat message');
  byId('am2VideoSlug').setAttribute('aria-label', 'Stream preview channel');

  const feedback = byId('amChannelFeedback');
  const channelInput = byId('amChannelInput');
  function message(text, error = false) { feedback.textContent = text; feedback.dataset.error = String(error); }
  function parseChannel(raw) {
    const value = String(raw || '').trim();
    let slug = value;
    if (/^(?:https?:\/\/)?(?:www\.)?kick\.com\//i.test(value)) {
      try {
        const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
        slug = url.pathname.split('/').filter(Boolean)[0] || '';
      } catch (_) { return null; }
    }
    return /^[a-z0-9_][a-z0-9_-]{0,49}$/i.test(slug) ? slug.toLowerCase() : null;
  }
  byId('amChannelForm').addEventListener('submit', async event => {
    event.preventDefault();
    const slug = parseChannel(channelInput.value);
    if (!slug) { message('Enter a channel name or a valid Kick channel URL.', true); channelInput.focus(); return; }
    if (S.am.running) { message('Stop the current session before changing channels.', true); return; }
    const button = byId('amChannelConnectBtn');
    if (button.disabled) return;
    button.disabled = true; button.textContent = 'Connecting…';
    channelInput.value = slug;
    message(`Connecting to ${slug}…`);
    try {
      byId('channelInput').value = slug;
      const result = await connectChannel();
      if (!result) { message('Could not connect. Check the channel name and try again.', true); return; }
      message(`Connected to ${result.user?.username || slug}.`);
      byId('am2VideoSlug').value = slug;
      lcConnect();
    } catch (error) { message(error.message || 'Could not connect. Try again.', true); }
    finally { button.disabled = false; button.textContent = 'Connect channel'; }
  });
  new MutationObserver(() => {
    if (S.channel?.user?.username && !byId('amChannelConnectBtn').disabled) {
      if (document.activeElement !== channelInput) channelInput.value = S.channel.user.username;
      message(`Connected to ${S.channel.user.username}.`);
    }
  }).observe(byId('channelStatus'), { childList: true, characterData: true, subtree: true });

  const previewToggle = byId('amPreviewToggle');
  function setPreview(open) {
    video.hidden = !open;
    previewToggle.setAttribute('aria-expanded', String(open));
    previewToggle.textContent = open ? 'Hide preview' : 'Show preview';
    // Hiding stops playback instead of leaving a hidden player using resources.
    if (!open) closeVideo();
    try { localStorage.setItem('flt_active_preview', String(open)); } catch (_) {}
  }
  function closeVideo() {
    byId('am2VideoBody').querySelector('iframe')?.remove();
    byId('am2VideoHint').style.display = '';
    byId('am2VideoFooter').style.display = 'none';
    byId('am2VideoCloseBtn').style.display = 'none';
    byId('am2VideoChLabel').textContent = '';
  }
  function loadVideo() {
    const input = byId('am2VideoSlug');
    const slug = parseChannel(input.value || channelInput.value);
    if (!slug) { message('Enter a valid channel name for the preview.', true); input.focus(); return; }
    closeVideo();
    input.value = slug;
    const frame = document.createElement('iframe');
    frame.className = 'am2-video-frame'; frame.title = `Live stream: ${slug}`;
    frame.src = `https://player.kick.com/${encodeURIComponent(slug)}?autoplay=true&muted=true`;
    frame.allow = 'autoplay; fullscreen'; frame.allowFullscreen = true;
    byId('am2VideoBody').append(frame);
    byId('am2VideoHint').style.display = 'none';
    byId('am2VideoFooter').style.display = '';
    byId('am2VideoCloseBtn').style.display = '';
    byId('am2VideoChLabel').textContent = slug;
  }
  let previewOpen = false;
  try { previewOpen = localStorage.getItem('flt_active_preview') === 'true'; } catch (_) {}
  setPreview(previewOpen);
  previewToggle.addEventListener('click', () => setPreview(video.hidden));
  byId('am2VideoLoadBtn').addEventListener('click', loadVideo);
  byId('am2VideoSlug').addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); loadVideo(); } });
  byId('am2VideoCloseBtn').addEventListener('click', closeVideo);
  byId('am2VideoSyncBtn').addEventListener('click', () => {
    const slug = byId('am2VideoChLabel').textContent;
    if (!slug) return;
    channelInput.value = slug;
    message('Channel copied. Choose Connect channel when ready.');
    channelInput.focus();
  });
  const jumpRow = document.createElement('div'); jumpRow.className = 'am-chat-bottom';
  const jump = document.createElement('button'); jump.id = 'amJumpLatest'; jump.type = 'button'; jump.textContent = 'Jump to latest'; jump.hidden = true;
  jumpRow.append(jump); chat.insertBefore(jumpRow, chat.querySelector('.am2-composer'));
  const feed = byId('liveChatFeed');
  const updateJump = () => { jump.hidden = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 40; };
  feed.addEventListener('scroll', updateJump, { passive: true });
  jump.addEventListener('click', () => { LC.autoScroll = true; feed.scrollTop = feed.scrollHeight; updateJump(); });

  byId('accClearFilters').addEventListener('click', () => {
    byId('accSearch').value = '';
    S.accFilter = 'all';
    accounts.querySelectorAll('.acc-fil').forEach(button => button.classList.toggle('active', button.dataset.f === 'all'));
    _invalidateSearchCache(); renderAccounts(); byId('accSearch').focus();
  });

  // One accessible disclosure behavior replaces conflicting class/style toggles.
  // This controls panel visibility only; it never starts or stops an operation.
  const automation = byId('page-automation');
  if (automation) {
    const storageKey = 'flt_automation_panels_v1';
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(storageKey) || '{}') || {}; } catch (_) {}
    if (typeof saved !== 'object' || Array.isArray(saved)) saved = {};
    const panels = [...automation.querySelectorAll('.auto-module')].map(card => ({
      id: card.id, header: card.querySelector('.auto-mod-hd'), body: card.querySelector('.auto-mod-body'),
    })).filter(panel => panel.header && panel.body);
    const setOpen = (panel, open, persist = true) => {
      panel.body.hidden = !open;
      panel.body.style.display = open ? 'block' : 'none';
      panel.body.classList.toggle('open', open);
      panel.header.classList.toggle('open', open);
      panel.header.setAttribute('aria-expanded', String(open));
      panel.header.querySelector('.auto-mod-chevron')?.classList.toggle('open', open);
      if (persist) {
        saved[panel.id] = open;
        try { localStorage.setItem(storageKey, JSON.stringify(saved)); } catch (_) {}
      }
    };
    panels.forEach(panel => {
      panel.header.setAttribute('role', 'button'); panel.header.tabIndex = 0;
      panel.header.setAttribute('aria-controls', panel.body.id);
      panel.header.setAttribute('aria-label', panel.header.querySelector('.auto-mod-title')?.textContent.trim() || 'Toggle section');
      setOpen(panel, typeof saved[panel.id] === 'boolean' ? saved[panel.id] : panel.body.classList.contains('open'), false);
      panel.header.addEventListener('click', event => {
        event.stopImmediatePropagation();
        setOpen(panel, panel.body.hidden);
      }, true);
      panel.header.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); panel.header.click(); }
      });
    });
    const controls = document.createElement('div'); controls.className = 'automation-view-controls';
    const label = document.createElement('span'); label.textContent = panels.length + ' sections'; controls.append(label);
    for (const [text, open] of [['Expand all', true], ['Collapse all', false]]) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'btn ghost xs'; button.textContent = text;
      button.addEventListener('click', () => panels.forEach(panel => setOpen(panel, open))); controls.append(button);
    }
    automation.querySelector('.auto-page-head').append(controls);
  }
});
