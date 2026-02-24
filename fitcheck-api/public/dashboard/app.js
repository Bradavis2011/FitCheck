'use strict';

// ─── Agent metadata ──────────────────────────────────────────────────────────

// Operator agents — use executeOrQueue, show full stats in grid
const AGENT_NAMES = [
  'lifecycle-email',
  'conversion-intelligence',
  'community-manager',
  'social-media-manager',
  'appstore-manager',
  'outreach-agent',
];

// Trigger name to use when "Run Now" is pressed for each operator agent
const AGENT_TRIGGER_NAME = {
  'lifecycle-email':         'lifecycle-email',
  'conversion-intelligence': 'conversion-intelligence',
  'community-manager':       'community-manager-daily',
  'social-media-manager':    'social-media-manager',
  'appstore-manager':        'appstore-manager',
  'outreach-agent':          'outreach-agent',
};

const AGENT_META = {
  'lifecycle-email':         { icon: '📧', label: 'Lifecycle Email' },
  'conversion-intelligence': { icon: '📈', label: 'Conversion Intel' },
  'community-manager':       { icon: '🤝', label: 'Community Mgr' },
  'social-media-manager':    { icon: '📱', label: 'Social Media' },
  'appstore-manager':        { icon: '⭐', label: 'App Store' },
  'outreach-agent':          { icon: '📨', label: 'Outreach' },
};

// Reporting agents — email results directly, no action queue
const REPORTING_AGENTS = [
  { name: 'content-calendar',         icon: '📅', label: 'Content Calendar' },
  { name: 'growth-dashboard',         icon: '📊', label: 'Growth Dashboard' },
  { name: 'viral-monitor',            icon: '🔁', label: 'Viral Monitor' },
  { name: 'beta-recruiter',           icon: '🌟', label: 'Beta Recruiter' },
  { name: 'revenue-cost',             icon: '💰', label: 'Revenue & Cost' },
  { name: 'ai-quality-monitor',       icon: '🤖', label: 'AI Quality' },
  { name: 'community-manager-weekly', icon: '🏆', label: 'Community Weekly' },
  { name: 'appstore-weekly',          icon: '📋', label: 'App Store Weekly' },
  { name: 'fashion-trends',           icon: '👗', label: 'Fashion Trends' },
  { name: 'calibration-snapshot',     icon: '📐', label: 'Calibration' },
  { name: 'founder-brief',            icon: '📝', label: 'Founder Brief' },
];

function agentIcon(name)  { return AGENT_META[name]?.icon  || '🤖'; }
function agentLabel(name) { return AGENT_META[name]?.label || name; }

// ─── Social post metadata ─────────────────────────────────────────────────────
const CONTENT_TYPE_LABELS = {
  founder_story:        'Founder Story',
  fashion_news:         'Fashion News',
  community_spotlight:  'Community Spotlight',
  style_data_drop:      'Style Data Drop',
  wardrobe_insight:     'Wardrobe Insight',
  conversation_starter: 'Conversation Starter',
  behind_the_scenes:    'Behind the Scenes',
};

const PLATFORM_META = {
  twitter:   { icon: '𝕏', label: 'Twitter', limit: 280, cls: 'platform-twitter'  },
  tiktok:    { icon: '♪', label: 'TikTok',  limit: null, cls: 'platform-tiktok'  },
  pinterest: { icon: '📌', label: 'Pinterest', limit: null, cls: 'platform-pinterest' },
};

// ─── Auth ────────────────────────────────────────────────────────────────────
const getToken  = () => sessionStorage.getItem('dashboard_token');
const setToken  = (t) => sessionStorage.setItem('dashboard_token', t);
const clearToken = () => sessionStorage.removeItem('dashboard_token');

// ─── API client ──────────────────────────────────────────────────────────────
async function apiFetch(method, url, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  const token = getToken();
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (body !== undefined) opts.body = JSON.stringify(body);

  let res;
  try {
    res = await fetch(url, opts);
  } catch (_) {
    throw new Error('Network error — is the server running?');
  }

  if (res.status === 401 || res.status === 403) {
    const errBody = await res.json().catch(() => ({}));
    if (getToken()) {
      clearToken();
      navigate('login');
    }
    throw new Error(errBody.error || 'Invalid credentials');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

const apiGet  = (url)       => apiFetch('GET', url);
const apiPost = (url, body) => apiFetch('POST', url, body);

// ─── Router ──────────────────────────────────────────────────────────────────
function navigate(page, param) {
  const hash = param ? `#${page}/${encodeURIComponent(param)}` : `#${page}`;
  if (window.location.hash !== hash) {
    window.location.hash = hash;
  } else {
    routePage();
  }
}

window.addEventListener('hashchange', routePage);

function routePage() {
  const hash  = window.location.hash.slice(1) || '';
  const parts = hash.split('/');
  const page  = parts[0] || 'overview';
  const param = parts.slice(1).map(decodeURIComponent).join('/');

  if (!getToken() && page !== 'login') {
    navigate('login');
    return;
  }
  if (getToken() && page === 'login') {
    navigate('overview');
    return;
  }

  const isLogin = page === 'login';
  document.getElementById('page-login').classList.toggle('hidden', !isLogin);
  document.getElementById('app-shell').classList.toggle('hidden', isLogin);

  if (isLogin) { initLogin(); return; }

  // Show the correct sub-page
  document.querySelectorAll('[data-page]').forEach(el => {
    el.classList.toggle('hidden', el.dataset.page !== page);
  });

  // Update nav active states
  document.querySelectorAll('[data-nav]').forEach(el => {
    const nav = el.dataset.nav;
    const active = nav === page || (page === 'agent' && nav === `agent/${param}`);
    el.classList.toggle('nav-active', active);
  });

  switch (page) {
    case 'overview': loadOverview();       break;
    case 'social':   loadSocialPosts();    break;
    case 'queue':    loadQueue(1);         break;
    case 'agent':    loadAgent(param);     break;
    case 'log':      loadLog(1);           break;
    default:         navigate('overview'); break;
  }
}

// ─── Toast ───────────────────────────────────────────────────────────────────
let _toastTimer;
function showToast(msg, type = 'success') {
  const el    = document.getElementById('toast');
  const inner = el.querySelector('.toast-inner');
  inner.textContent = msg;
  inner.className   = `toast-inner toast-${type}`;
  el.classList.remove('hidden');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.add('hidden'), 3500);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function esc(s) {
  const d = document.createElement('div');
  d.textContent = String(s ?? '');
  return d.innerHTML;
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
       + ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function fmtRelative(iso) {
  if (!iso) return '—';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function statusPill(status) {
  const labels = {
    pending: 'Pending', approved: 'Approved',
    executed: 'Executed', failed: 'Failed', rejected: 'Rejected',
  };
  return `<span class="pill pill-${esc(status)}">${esc(labels[status] || status)}</span>`;
}

function riskBadge(risk) {
  const labels = { low: 'Low', medium: 'Med', high: 'High' };
  return `<span class="pill badge-${esc(risk)}">${esc(labels[risk] || risk)}</span>`;
}

function loadingHTML() {
  return `<div style="display:flex;align-items:center;justify-content:center;padding:48px;gap:12px;color:#9CA3AF;">
    <div class="spinner"></div><span>Loading…</span>
  </div>`;
}

function errorHTML(msg) {
  return `<div style="display:flex;align-items:center;justify-content:center;padding:48px;gap:8px;color:#EF4444;">
    ⚠️ ${esc(msg)}
  </div>`;
}

function emptyHTML(msg) {
  return `<div style="text-align:center;padding:56px 24px;">
    <div style="margin-bottom:16px;display:flex;align-items:center;justify-content:center;gap:8px;">
      <span style="flex:1;max-width:48px;height:1px;background:var(--border-solid);display:block;"></span>
      <span style="width:5px;height:5px;background:var(--coral);transform:rotate(45deg);opacity:0.4;display:block;flex-shrink:0;"></span>
      <span style="flex:1;max-width:48px;height:1px;background:var(--border-solid);display:block;"></span>
    </div>
    <p style="font-size:0.6875rem;font-weight:500;letter-spacing:0.16em;text-transform:uppercase;color:var(--muted);">${esc(msg)}</p>
  </div>`;
}

function paginationHTML(page, total, limit, fn) {
  const totalPages = Math.ceil(total / limit);
  if (totalPages <= 1) return '';
  return `<div style="display:flex;align-items:center;justify-content:space-between;font-size:0.875rem;">
    <span style="color:#9CA3AF;">${total} total · Page ${page} of ${totalPages}</span>
    <div style="display:flex;gap:8px;">
      ${page > 1 ? `<button onclick="${fn}(${page - 1})" class="btn-ghost" style="padding:6px 12px;border-radius:8px;border:1px solid #E5E7EB;font-size:0.8125rem;">← Prev</button>` : ''}
      ${page < totalPages ? `<button onclick="${fn}(${page + 1})" class="btn-coral" style="padding:6px 12px;border-radius:8px;font-size:0.8125rem;">Next →</button>` : ''}
    </div>
  </div>`;
}

function prettyJSON(val) {
  try {
    const obj = typeof val === 'string' ? JSON.parse(val) : val;
    return JSON.stringify(obj, null, 2);
  } catch (_) {
    return String(val ?? '');
  }
}

// ─── Login ───────────────────────────────────────────────────────────────────
function initLogin() {
  // Clone to remove stale listeners
  const old = document.getElementById('login-form');
  const form = old.cloneNode(true);
  old.parentNode.replaceChild(form, old);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = document.getElementById('token-input').value.trim();
    const errEl = document.getElementById('login-error');
    errEl.classList.add('hidden');
    if (!token) return;

    try {
      await apiFetch('POST', '/api/admin/agents/auth/verify', { token });
      setToken(token);
      navigate('overview');
    } catch (err) {
      const currentErr = document.getElementById('login-error');
      if (currentErr) {
        currentErr.textContent = err.message || 'Login failed';
        currentErr.classList.remove('hidden');
      }
    }
  });
}

// ─── Queue Badge ─────────────────────────────────────────────────────────────
function setQueueBadge(count) {
  const el = document.getElementById('queue-badge');
  if (!el) return;
  if (count > 0) { el.textContent = count; el.classList.remove('hidden'); }
  else           { el.classList.add('hidden'); }
}

async function refreshQueueBadge() {
  try {
    const s = await apiGet('/api/admin/agents/summary');
    setQueueBadge(s.pendingCount);
  } catch (_) {}
}

// ─── Overview ────────────────────────────────────────────────────────────────
async function loadOverview() {
  const statEl    = document.getElementById('stat-cards');
  const gridEl    = document.getElementById('agent-grid');
  const pendingEl = document.getElementById('pending-preview');

  statEl.innerHTML    = loadingHTML();
  gridEl.innerHTML    = loadingHTML();
  pendingEl.innerHTML = loadingHTML();

  try {
    const [summary, dash] = await Promise.all([
      apiGet('/api/admin/agents/summary'),
      apiGet('/api/admin/agents'),
    ]);

    setQueueBadge(summary.pendingCount);

    // ── Stat cards ──
    const cards = [
      { label: 'Actions Today',    value: summary.totalToday,    accent: 'var(--black)',  click: null },
      { label: 'Pending Approval', value: summary.pendingCount,  accent: 'var(--coral)',  click: 'queue' },
      { label: 'Executed Today',   value: summary.executedToday, accent: '#059669',       click: null },
      { label: 'Failed Today',     value: summary.failedToday,   accent: '#DC2626',       click: null },
    ];
    statEl.innerHTML = cards.map(c => `
      <div class="card stat-card ${c.click ? 'clickable' : ''}" style="padding:28px 24px;"
           ${c.click ? `onclick="navigate('${c.click}')"` : ''}>
        <div style="font-size:2.5rem;font-weight:700;color:${c.accent};line-height:1;margin-bottom:10px;">${c.value}</div>
        <p class="section-label">${esc(c.label)}</p>
      </div>
    `).join('');

    // ── Agent grid ──
    const cfgMap  = Object.fromEntries((dash.configs || []).map(c => [c.agent, c]));
    const statMap = dash.agentStats || {};
    gridEl.innerHTML = AGENT_NAMES.map(name => {
      const cfg   = cfgMap[name];
      const stats = statMap[name] || {};
      const enabled   = cfg ? cfg.enabled : true;
      const executed  = stats.executed || 0;
      const failed    = stats.failed   || 0;
      const pending   = stats.pending  || 0;
      const hasErrors = failed > 0;

      return `
        <div class="card agent-card" style="padding:24px;${hasErrors ? 'border-color:#FECACA;' : ''}">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px;">
            <div>
              <span style="font-size:1.25rem;display:block;margin-bottom:4px;">${agentIcon(name)}</span>
              <span style="font-weight:600;font-size:0.9375rem;color:var(--black);">${esc(agentLabel(name))}</span>
            </div>
            <label class="toggle-switch" title="${enabled ? 'Disable' : 'Enable'} agent">
              <input type="checkbox" ${enabled ? 'checked' : ''} data-agent="${esc(name)}" onchange="handleToggle(this)">
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;padding:16px 0;border-top:1px solid rgba(0,0,0,0.06);border-bottom:1px solid rgba(0,0,0,0.06);margin-bottom:16px;">
            <div>
              <div style="font-size:1.25rem;font-weight:700;color:var(--black);">${executed}</div>
              <p class="section-label" style="margin-top:2px;">Done</p>
            </div>
            <div>
              <div style="font-size:1.25rem;font-weight:700;color:${pending > 0 ? '#D97706' : 'var(--muted)'};">${pending}</div>
              <p class="section-label" style="margin-top:2px;">Pending</p>
            </div>
            <div>
              <div style="font-size:1.25rem;font-weight:700;color:${hasErrors ? '#DC2626' : 'var(--muted)'};">${failed}</div>
              <p class="section-label" style="margin-top:2px;">Failed</p>
            </div>
          </div>
          <div style="display:flex;gap:8px;">
            <button onclick="handleTrigger('${esc(AGENT_TRIGGER_NAME[name] || name)}', this)"
                    class="btn-coral" style="flex:1;padding:10px 0;">
              Run Now
            </button>
            <a href="#agent/${encodeURIComponent(name)}"
               class="btn-outline" style="flex:1;padding:10px 0;text-decoration:none;font-size:0.75rem;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;">
              Details
            </a>
          </div>
        </div>
      `;
    }).join('');

    // ── Pending preview header ──
    document.querySelectorAll('#pending-preview').forEach(el => {
      const label = el.previousElementSibling?.querySelector('h2');
      if (label) { label.className = 'section-label'; label.style.marginBottom = '16px'; }
    });

    // ── Reporting agents (run-on-demand, no action queue) ──
    const reportingEl = document.getElementById('reporting-agents');
    if (reportingEl) {
      reportingEl.innerHTML = REPORTING_AGENTS.map(a => `
        <div class="card" style="padding:16px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px;">
          <div style="display:flex;align-items:center;gap:10px;min-width:0;">
            <span style="font-size:1.1rem;">${a.icon}</span>
            <span style="font-weight:500;font-size:0.9375rem;color:var(--black);white-space:nowrap;">${esc(a.label)}</span>
          </div>
          <button onclick="handleTrigger('${esc(a.name)}', this)"
                  class="btn-coral" style="padding:8px 16px;white-space:nowrap;flex-shrink:0;">
            Run Now
          </button>
        </div>
      `).join('');
    }

    // ── Pending preview ──
    const pending = (dash.recentActions || []).filter(a => a.status === 'pending').slice(0, 5);
    if (pending.length === 0) {
      pendingEl.innerHTML = emptyHTML('No actions pending — queue is clear');
    } else {
      pendingEl.innerHTML = `<div class="card" style="overflow:hidden;">
        <div style="divide-y:1px solid #F9FAFB;">
          ${pending.map(a => queueItemHTML(a)).join('')}
        </div>
      </div>`;
    }
  } catch (err) {
    statEl.innerHTML    = errorHTML(err.message);
    gridEl.innerHTML    = '';
    pendingEl.innerHTML = '';
  }
}

// ─── Social Posts Page ────────────────────────────────────────────────────────

async function loadSocialPosts() {
  const queueEl   = document.getElementById('social-queue-content');
  const historyEl = document.getElementById('social-history-content');
  if (!queueEl || !historyEl) return;

  queueEl.innerHTML   = loadingHTML();
  historyEl.innerHTML = loadingHTML();

  try {
    const [queueData, logData] = await Promise.all([
      apiGet('/api/admin/agents/queue?page=1&limit=50'),
      apiGet('/api/admin/agents/actions?agent=social-media-manager&limit=30'),
    ]);

    // Filter pending queue to social posts only
    const pendingPosts = (queueData.actions || []).filter(
      a => a.agent === 'social-media-manager' && a.actionType === 'post_social'
    );

    // Update social badge
    const socialBadge = document.getElementById('social-badge');
    if (socialBadge) {
      if (pendingPosts.length > 0) {
        socialBadge.textContent = pendingPosts.length;
        socialBadge.classList.remove('hidden');
      } else {
        socialBadge.classList.add('hidden');
      }
    }

    if (pendingPosts.length === 0) {
      queueEl.innerHTML = `<div class="card">${emptyHTML('No posts awaiting review')}</div>`;
    } else {
      queueEl.innerHTML = `
        <div class="card" style="overflow:hidden;">
          ${pendingPosts.map(a => socialPostCardHTML(a)).join('')}
        </div>`;
    }

    // History — non-pending social posts
    const historyPosts = (logData.actions || []).filter(
      a => a.actionType === 'post_social' && a.status !== 'pending'
    );

    if (historyPosts.length === 0) {
      historyEl.innerHTML = `<div class="card">${emptyHTML('No post history yet')}</div>`;
    } else {
      historyEl.innerHTML = `
        <div class="card" style="overflow:hidden;">
          ${historyPosts.map(a => socialPostCardHTML(a, { showActions: false, showHistory: true })).join('')}
        </div>`;
    }
  } catch (err) {
    queueEl.innerHTML   = errorHTML(err.message);
    historyEl.innerHTML = '';
  }
}

async function handleForceTrigger(btn) {
  const original = btn.textContent;
  btn.disabled   = true;
  btn.textContent = 'Running…';
  try {
    await apiPost('/api/admin/agents/social-media-manager/trigger', { force: true });
    showToast('Content engine triggered — check back in ~30 seconds');
    setTimeout(() => loadSocialPosts(), 30000);
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled    = false;
    btn.textContent = original;
  }
}

// ─── Approval Queue ──────────────────────────────────────────────────────────
async function loadQueue(page) {
  page = page || 1;
  const contentEl = document.getElementById('queue-content');
  const paginEl   = document.getElementById('queue-pagination');
  contentEl.innerHTML = loadingHTML();
  paginEl.innerHTML   = '';

  try {
    const data = await apiGet(`/api/admin/agents/queue?page=${page}&limit=20`);
    setQueueBadge(data.total);

    if (data.actions.length === 0) {
      contentEl.innerHTML = `<div class="card">${emptyHTML('Queue is empty — no actions awaiting approval')}</div>`;
      return;
    }

    contentEl.innerHTML = `
      <div class="card" style="overflow:hidden;">
        <div style="padding:20px 24px;border-bottom:1px solid rgba(0,0,0,0.06);display:flex;justify-content:space-between;align-items:center;">
          <p class="section-label">${data.total} action${data.total !== 1 ? 's' : ''} awaiting approval</p>
        </div>
        <div>
          ${data.actions.map(a => queueItemHTML(a)).join('')}
        </div>
      </div>
    `;
    paginEl.innerHTML = paginationHTML(page, data.total, 20, 'loadQueue');
  } catch (err) {
    contentEl.innerHTML = errorHTML(err.message);
  }
}

function socialPostCardHTML(action, opts = {}) {
  const id      = esc(action.id);
  const p       = action.payload || {};
  const content = p.content || '';
  const hashtags= Array.isArray(p.hashtags) ? p.hashtags : [];
  const platform= (p.platform || 'twitter').toLowerCase();
  const ctLabel = CONTENT_TYPE_LABELS[p.contentType] || p.contentType || '';
  const imgHint = p.imageDescription || '';
  const pmeta   = PLATFORM_META[platform] || PLATFORM_META.twitter;

  const fullText = content + (hashtags.length ? ' ' + hashtags.map(h => `#${h}`).join(' ') : '');
  const charLen  = fullText.length;
  let charCls = 'char-ok';
  if (pmeta.limit) {
    if (charLen > pmeta.limit) charCls = 'char-over';
    else if (charLen > pmeta.limit * 0.9) charCls = 'char-warn';
  }

  const showActions = opts.showActions !== false;
  const showHistory = opts.showHistory === true;

  const hashtagHTML = hashtags.map(h => `<span class="hashtag-chip">#${esc(h)}</span>`).join('');

  return `
    <div id="qi-${id}" style="padding:20px 24px;border-bottom:1px solid #F3F4F6;">
      <!-- Header row -->
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
        <span class="pill ${pmeta.cls}" style="font-size:0.75rem;font-weight:600;">
          ${pmeta.icon} ${esc(pmeta.label)}
        </span>
        ${ctLabel ? `<span class="content-type-chip">${esc(ctLabel)}</span>` : ''}
        ${riskBadge(action.riskLevel)}
        <span style="margin-left:auto;font-size:0.75rem;color:#9CA3AF;">${fmtRelative(action.createdAt)}</span>
        ${showHistory ? statusPill(action.status) : ''}
      </div>

      <!-- Post text -->
      <div class="post-text" style="margin-bottom:10px;">${esc(content)}</div>

      <!-- Hashtags + char count -->
      <div style="display:flex;align-items:center;flex-wrap:wrap;gap:4px;margin-bottom:10px;">
        ${hashtagHTML}
        ${pmeta.limit ? `<span class="char-count ${charCls}" style="margin-left:auto;">${charLen}/${pmeta.limit}</span>` : ''}
      </div>

      <!-- Image hint -->
      ${imgHint ? `<p class="image-hint" style="margin-bottom:12px;">📷 ${esc(imgHint)}</p>` : ''}

      <!-- Actions -->
      ${showActions ? `
      <div style="display:flex;gap:8px;padding-top:4px;">
        <button onclick="handleApprove('${id}')" class="btn-approve" style="padding:8px 20px;font-size:0.8125rem;">✓ Approve &amp; Schedule</button>
        <button onclick="handleReject('${id}')"  class="btn-reject"  style="padding:8px 16px;font-size:0.8125rem;">✕ Reject</button>
      </div>` : ''}
    </div>
  `;
}

function queueItemHTML(action) {
  // Social media posts get a rich preview card
  if (action.agent === 'social-media-manager' && action.actionType === 'post_social') {
    return socialPostCardHTML(action);
  }

  const id      = esc(action.id);
  const payload = prettyJSON(action.payload);
  return `
    <div id="qi-${id}" style="padding:20px 24px;border-bottom:1px solid rgba(0,0,0,0.06);">
      <div style="display:flex;align-items:flex-start;gap:16px;">
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px;">
            <span style="font-weight:600;font-size:0.9375rem;color:var(--black);">
              ${agentIcon(action.agent)} ${esc(agentLabel(action.agent))}
            </span>
            <span style="color:var(--muted);font-size:0.75rem;">·</span>
            <span style="color:var(--charcoal);font-size:0.875rem;">${esc(action.actionType)}</span>
            ${riskBadge(action.riskLevel)}
          </div>
          <p style="font-size:0.8125rem;color:var(--muted);margin-bottom:10px;">${fmtRelative(action.createdAt)}</p>
          <details>
            <summary style="font-size:0.75rem;color:var(--coral);cursor:pointer;font-weight:500;user-select:none;letter-spacing:0.04em;text-transform:uppercase;">
              Payload ▾
            </summary>
            <pre style="margin-top:8px;padding:12px;background:var(--cream);font-size:0.72rem;color:var(--charcoal);overflow:auto;max-height:160px;white-space:pre-wrap;word-break:break-all;">${esc(payload)}</pre>
          </details>
        </div>
        <div style="display:flex;gap:8px;flex-shrink:0;padding-top:2px;">
          <button onclick="handleApprove('${id}')" class="btn-approve" style="padding:8px 16px;">Approve</button>
          <button onclick="handleReject('${id}')"  class="btn-reject"  style="padding:8px 12px;">Reject</button>
        </div>
      </div>
    </div>
  `;
}

// ─── Agent Detail ────────────────────────────────────────────────────────────
let _currentAgent = '';

async function loadAgent(name) {
  if (!name) { navigate('overview'); return; }
  _currentAgent = name;

  const el = document.getElementById('agent-detail-content');
  el.innerHTML = loadingHTML();

  try {
    const [dash, actions] = await Promise.all([
      apiGet('/api/admin/agents'),
      apiGet(`/api/admin/agents/${encodeURIComponent(name)}/actions?page=1&limit=20`),
    ]);

    const cfg     = (dash.configs || []).find(c => c.agent === name);
    const stats   = (dash.agentStats || {})[name] || {};
    const enabled = cfg ? cfg.enabled : true;

    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:24px;">
        <a href="#overview" style="color:#9CA3AF;font-size:0.875rem;text-decoration:none;">← Overview</a>
        <span style="color:#D1D5DB;">/</span>
        <h1 style="font-size:1.375rem;font-weight:600;color:#1A1A1A;">
          ${agentIcon(name)} ${esc(agentLabel(name))}
        </h1>
      </div>

      <!-- Config Card -->
      <div class="card p-6" style="margin-bottom:20px;">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">
          <div>
            <h2 style="font-weight:600;color:#1A1A1A;margin-bottom:4px;">Agent Configuration</h2>
            <code style="font-size:0.8125rem;color:#9CA3AF;">${esc(name)}</code>
          </div>
          <div style="display:flex;align-items:center;gap:12px;flex-shrink:0;">
            <button onclick="handleTrigger('${esc(AGENT_TRIGGER_NAME[name] || name)}', this)"
                    class="btn-coral" style="padding:7px 16px;border-radius:8px;font-size:0.875rem;font-weight:500;">
              ▶ Run Now
            </button>
            <label class="toggle-switch">
              <input type="checkbox" ${enabled ? 'checked' : ''} data-agent="${esc(name)}" onchange="handleToggle(this)">
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>
        <div style="margin-top:16px;padding-top:16px;border-top:1px solid #F3F4F6;display:grid;grid-template-columns:repeat(3,1fr);gap:16px;">
          <div>
            <p style="font-size:0.75rem;color:#9CA3AF;margin-bottom:6px;">Status</p>
            <span class="pill ${enabled ? 'pill-executed' : 'pill-rejected'}">${enabled ? 'Enabled' : 'Disabled'}</span>
          </div>
          <div>
            <p style="font-size:0.75rem;color:#9CA3AF;margin-bottom:4px;">Max / Day</p>
            <p style="font-weight:600;color:#1A1A1A;">${cfg?.maxActionsPerDay ?? 50}</p>
          </div>
          <div>
            <p style="font-size:0.75rem;color:#9CA3AF;margin-bottom:4px;">Auto-approve up to</p>
            <p style="font-weight:600;color:#1A1A1A;">${cfg?.autoApproveRisk ?? 'medium'} risk</p>
          </div>
        </div>
      </div>

      <!-- Stats Row -->
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px;">
        ${[
          { label: 'Executed Today', value: stats.executed || 0, color: '#059669' },
          { label: 'Failed Today',   value: stats.failed   || 0, color: '#DC2626' },
          { label: 'Pending',        value: stats.pending  || 0, color: '#D97706' },
          { label: 'Rejected Today', value: stats.rejected || 0, color: '#9CA3AF' },
        ].map(s => `
          <div class="card" style="padding:16px;text-align:center;">
            <div style="font-size:1.75rem;font-weight:700;color:${s.color};">${s.value}</div>
            <div style="font-size:0.75rem;color:#9CA3AF;margin-top:4px;">${s.label}</div>
          </div>
        `).join('')}
      </div>

      <!-- Action History -->
      <div class="card" style="overflow:hidden;">
        <div style="padding:16px 20px;border-bottom:1px solid #F3F4F6;">
          <h2 style="font-weight:600;color:#1A1A1A;">Action History</h2>
        </div>
        <div id="agent-actions-table">
          ${actionsTableHTML(actions.actions)}
        </div>
        <div style="padding:16px 20px;border-top:1px solid #F3F4F6;">
          ${paginationHTML(1, actions.total, 20, 'loadAgentPage')}
        </div>
      </div>
    `;
  } catch (err) {
    el.innerHTML = errorHTML(err.message);
  }
}

async function loadAgentPage(page) {
  const el = document.getElementById('agent-actions-table');
  if (!el) return;
  el.innerHTML = loadingHTML();
  try {
    const data = await apiGet(`/api/admin/agents/${encodeURIComponent(_currentAgent)}/actions?page=${page}&limit=20`);
    el.innerHTML = actionsTableHTML(data.actions);
  } catch (err) {
    el.innerHTML = errorHTML(err.message);
  }
}

function actionsTableHTML(actions) {
  if (!actions || actions.length === 0) {
    return `<div style="padding:32px;text-align:center;color:#9CA3AF;font-size:0.875rem;">No actions recorded yet</div>`;
  }
  return `
    <table class="data-table">
      <thead>
        <tr>
          <th>Action Type</th>
          <th>Status</th>
          <th>Risk</th>
          <th>Created</th>
          <th>Executed</th>
        </tr>
      </thead>
      <tbody>
        ${actions.map(a => `
          <tr>
            <td style="font-weight:500;color:#1A1A1A;">${esc(a.actionType)}</td>
            <td>${statusPill(a.status)}</td>
            <td>${riskBadge(a.riskLevel)}</td>
            <td style="color:#9CA3AF;font-size:0.8125rem;">${fmtRelative(a.createdAt)}</td>
            <td style="color:#9CA3AF;font-size:0.8125rem;">${fmtRelative(a.executedAt)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

// ─── Action Log ──────────────────────────────────────────────────────────────
async function loadLog(page) {
  page = page || 1;
  const contentEl = document.getElementById('log-content');
  const paginEl   = document.getElementById('log-pagination');
  contentEl.innerHTML = loadingHTML();
  paginEl.innerHTML   = '';

  // Populate agent filter once
  const agentSel = document.getElementById('log-filter-agent');
  if (agentSel && agentSel.options.length === 1) {
    const selected = agentSel.value;
    AGENT_NAMES.forEach(n => {
      const opt = document.createElement('option');
      opt.value       = n;
      opt.textContent = agentLabel(n);
      agentSel.appendChild(opt);
    });
    agentSel.value = selected;
  }

  const agent  = agentSel?.value || '';
  const status = document.getElementById('log-filter-status')?.value || '';
  const risk   = document.getElementById('log-filter-risk')?.value   || '';

  const params = new URLSearchParams({ page, limit: 50 });
  if (agent)  params.set('agent', agent);
  if (status) params.set('status', status);
  if (risk)   params.set('riskLevel', risk);

  try {
    const data = await apiGet(`/api/admin/agents/actions?${params}`);

    if (data.actions.length === 0) {
      contentEl.innerHTML = `<div class="card">${emptyHTML('No actions match the current filters')}</div>`;
      return;
    }

    contentEl.innerHTML = `
      <div class="card" style="overflow:hidden;">
        ${data.actions.map(a => logRowHTML(a)).join('')}
      </div>
    `;
    paginEl.innerHTML = paginationHTML(page, data.total, 50, 'loadLog');
  } catch (err) {
    contentEl.innerHTML = errorHTML(err.message);
  }
}

function logRowHTML(action) {
  const payload = prettyJSON(action.payload);
  const result  = action.result ? prettyJSON(action.result) : null;
  return `
    <details style="border-bottom:1px solid #F9FAFB;">
      <summary style="padding:14px 20px;cursor:pointer;user-select:none;list-style:none;">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <span>${agentIcon(action.agent)}</span>
          <span style="font-weight:600;font-size:0.875rem;color:#1A1A1A;">${esc(agentLabel(action.agent))}</span>
          <span style="color:#9CA3AF;font-size:0.75rem;">·</span>
          <span style="color:#6B7280;font-size:0.875rem;">${esc(action.actionType)}</span>
          ${statusPill(action.status)}
          ${riskBadge(action.riskLevel)}
          <span style="margin-left:auto;font-size:0.75rem;color:#9CA3AF;">${fmtDate(action.createdAt)}</span>
        </div>
      </summary>
      <div style="padding:0 20px 16px;background:#FAFAFA;border-top:1px solid #F3F4F6;">
        <p style="font-size:0.75rem;font-weight:500;color:#9CA3AF;margin:12px 0 4px;">Payload</p>
        <pre style="padding:10px;background:white;border:1px solid #F3F4F6;border-radius:8px;font-size:0.72rem;color:#4B5563;overflow:auto;max-height:160px;white-space:pre-wrap;word-break:break-all;">${esc(payload)}</pre>
        ${result ? `
          <p style="font-size:0.75rem;font-weight:500;color:#9CA3AF;margin:10px 0 4px;">Result</p>
          <pre style="padding:10px;background:white;border:1px solid #F3F4F6;border-radius:8px;font-size:0.72rem;color:#4B5563;overflow:auto;max-height:160px;white-space:pre-wrap;word-break:break-all;">${esc(result)}</pre>
        ` : ''}
        ${action.executedAt ? `<p style="font-size:0.75rem;color:#9CA3AF;margin-top:8px;">Executed: ${fmtDate(action.executedAt)}</p>` : ''}
        ${action.reviewedBy ? `<p style="font-size:0.75rem;color:#9CA3AF;margin-top:4px;">Reviewed by: ${esc(action.reviewedBy)}</p>` : ''}
      </div>
    </details>
  `;
}

// ─── Action Handlers ─────────────────────────────────────────────────────────
async function handleTrigger(name, btn) {
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Running…';
  // social-media-manager has a day-of-week guard — force bypasses it
  const body = name === 'social-media-manager' ? { force: true } : undefined;
  try {
    await apiPost(`/api/admin/agents/${encodeURIComponent(name)}/trigger`, body);
    showToast(`${name} triggered — running in background`);
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}

async function handleApprove(actionId) {
  try {
    await apiPost(`/api/admin/agents/actions/${actionId}/approve`);
    showToast('Action approved — executing now');
    removeQueueItem(actionId);
    refreshQueueBadge();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleReject(actionId) {
  try {
    await apiPost(`/api/admin/agents/actions/${actionId}/reject`);
    showToast('Action rejected', 'warning');
    removeQueueItem(actionId);
    refreshQueueBadge();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function removeQueueItem(actionId) {
  const el = document.getElementById(`qi-${actionId}`);
  if (el) {
    el.style.transition = 'opacity 0.2s';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 200);
  }
}

async function handleToggle(checkbox) {
  const name    = checkbox.dataset.agent;
  const enabled = checkbox.checked;
  try {
    await apiPost(`/api/admin/agents/${encodeURIComponent(name)}/toggle`, { enabled });
    showToast(`${agentLabel(name)} ${enabled ? 'enabled' : 'disabled'}`);
    // Sync all toggles for same agent
    document.querySelectorAll(`input[data-agent="${name}"]`).forEach(el => {
      if (el !== checkbox) el.checked = enabled;
    });
  } catch (err) {
    checkbox.checked = !enabled; // revert
    showToast(err.message, 'error');
  }
}

async function handleKillAll() {
  const confirmed = confirm(
    '⚠️ Kill all 6 operator agents?\n\n' +
    'All agents will stop running until individually re-enabled. ' +
    'This does NOT affect already-queued actions.'
  );
  if (!confirmed) return;
  try {
    await apiPost('/api/admin/agents/kill-all');
    showToast('All agents disabled', 'warning');
    if (window.location.hash.includes('overview')) loadOverview();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ─── Sidebar agent nav ───────────────────────────────────────────────────────
function buildAgentNav() {
  const el = document.getElementById('agent-nav-links');
  if (!el) return;
  el.innerHTML = AGENT_NAMES.map(name => `
    <a href="#agent/${encodeURIComponent(name)}"
       data-nav="agent/${encodeURIComponent(name)}"
       class="nav-item" style="font-size:0.8125rem;">
      <span>${agentIcon(name)}</span>
      <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(agentLabel(name))}</span>
    </a>
  `).join('');
}

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  buildAgentNav();

  document.getElementById('kill-all-btn')?.addEventListener('click', handleKillAll);
  document.getElementById('logout-btn')?.addEventListener('click', () => {
    clearToken();
    navigate('login');
  });
  document.getElementById('log-filter-btn')?.addEventListener('click', () => loadLog(1));

  routePage();
});
