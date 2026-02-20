'use strict';

// ─── Agent metadata ──────────────────────────────────────────────────────────
const AGENT_NAMES = [
  'lifecycle-email',
  'conversion-intelligence',
  'community-manager',
  'social-media-manager',
  'appstore-manager',
  'outreach-agent',
];
const AGENT_META = {
  'lifecycle-email':         { icon: '📧', label: 'Lifecycle Email' },
  'conversion-intelligence': { icon: '📈', label: 'Conversion Intel' },
  'community-manager':       { icon: '🤝', label: 'Community Mgr' },
  'social-media-manager':    { icon: '📱', label: 'Social Media' },
  'appstore-manager':        { icon: '⭐', label: 'App Store' },
  'outreach-agent':          { icon: '📨', label: 'Outreach' },
};

function agentIcon(name)  { return AGENT_META[name]?.icon  || '🤖'; }
function agentLabel(name) { return AGENT_META[name]?.label || name; }

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
  return `<div style="text-align:center;padding:48px;color:#9CA3AF;">
    <div style="font-size:2.5rem;margin-bottom:8px;">✅</div>
    <p style="font-size:0.875rem;">${esc(msg)}</p>
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
      { label: 'Actions Today',    value: summary.totalToday,    icon: '📊', color: '#1A1A1A',  click: null },
      { label: 'Pending Approval', value: summary.pendingCount,  icon: '⏳', color: '#D97706',  click: 'queue' },
      { label: 'Executed Today',   value: summary.executedToday, icon: '✅', color: '#059669',  click: null },
      { label: 'Failed Today',     value: summary.failedToday,   icon: '❌', color: '#DC2626',  click: null },
    ];
    statEl.innerHTML = cards.map(c => `
      <div class="card stat-card p-6 ${c.click ? 'cursor-pointer' : ''}"
           ${c.click ? `onclick="navigate('${c.click}')"` : ''}>
        <div style="font-size:1.5rem;margin-bottom:8px;">${c.icon}</div>
        <div style="font-size:2rem;font-weight:700;color:${c.color};">${c.value}</div>
        <div style="font-size:0.8125rem;color:#9CA3AF;margin-top:4px;">${c.label}</div>
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
        <div class="card agent-card p-5" style="${hasErrors ? 'border-color:#FECACA;' : ''}">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-size:1.25rem;">${agentIcon(name)}</span>
              <span style="font-weight:600;font-size:0.875rem;color:#1A1A1A;">${esc(agentLabel(name))}</span>
            </div>
            <label class="toggle-switch" title="${enabled ? 'Disable' : 'Enable'} agent">
              <input type="checkbox" ${enabled ? 'checked' : ''} data-agent="${esc(name)}" onchange="handleToggle(this)">
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;">
            <span class="pill ${enabled ? 'pill-executed' : 'pill-rejected'}">${enabled ? 'Enabled' : 'Disabled'}</span>
            ${pending  > 0 ? `<span class="pill pill-pending">${pending} pending</span>` : ''}
            ${hasErrors    ? `<span class="pill pill-failed">⚠ ${failed} failed</span>` : ''}
          </div>
          <div style="border-top:1px solid #F9FAFB;padding-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:0.75rem;color:#9CA3AF;">
            <div><span style="font-weight:600;color:#1A1A1A;">${executed}</span> executed</div>
            <div><span style="font-weight:600;color:${hasErrors ? '#DC2626' : '#1A1A1A'};">${failed}</span> failed</div>
          </div>
          <a href="#agent/${encodeURIComponent(name)}"
             style="display:block;margin-top:10px;text-align:center;font-size:0.75rem;color:var(--coral);font-weight:500;text-decoration:none;">
            View details →
          </a>
        </div>
      `;
    }).join('');

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
        <div style="padding:16px 20px;border-bottom:1px solid #F3F4F6;display:flex;justify-content:space-between;align-items:center;">
          <span style="font-weight:600;font-size:0.9375rem;">${data.total} action${data.total !== 1 ? 's' : ''} awaiting approval</span>
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

function queueItemHTML(action) {
  const id      = esc(action.id);
  const payload = prettyJSON(action.payload);
  return `
    <div id="qi-${id}" style="padding:16px 20px;border-bottom:1px solid #F9FAFB;">
      <div style="display:flex;align-items:flex-start;gap:12px;">
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px;">
            <span style="font-weight:600;font-size:0.875rem;">
              ${agentIcon(action.agent)} ${esc(agentLabel(action.agent))}
            </span>
            <span style="color:#9CA3AF;font-size:0.75rem;">·</span>
            <span style="color:#6B7280;font-size:0.875rem;">${esc(action.actionType)}</span>
            ${riskBadge(action.riskLevel)}
          </div>
          <div style="font-size:0.75rem;color:#9CA3AF;margin-bottom:8px;">${fmtRelative(action.createdAt)}</div>
          <details>
            <summary style="font-size:0.75rem;color:var(--coral);cursor:pointer;font-weight:500;user-select:none;">
              View payload ▾
            </summary>
            <pre style="margin-top:8px;padding:10px;background:#F9FAFB;border-radius:8px;font-size:0.72rem;color:#4B5563;overflow:auto;max-height:160px;white-space:pre-wrap;word-break:break-all;">${esc(payload)}</pre>
          </details>
        </div>
        <div style="display:flex;gap:8px;flex-shrink:0;padding-top:2px;">
          <button onclick="handleApprove('${id}')" class="btn-approve" style="padding:6px 12px;border-radius:8px;font-size:0.8125rem;font-weight:500;">✓ Approve</button>
          <button onclick="handleReject('${id}')"  class="btn-reject"  style="padding:6px 12px;border-radius:8px;font-size:0.8125rem;font-weight:500;">✕ Reject</button>
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
        <div style="display:flex;align-items:flex-start;justify-content:space-between;">
          <div>
            <h2 style="font-weight:600;color:#1A1A1A;margin-bottom:4px;">Agent Configuration</h2>
            <code style="font-size:0.8125rem;color:#9CA3AF;">${esc(name)}</code>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" ${enabled ? 'checked' : ''} data-agent="${esc(name)}" onchange="handleToggle(this)">
            <span class="toggle-slider"></span>
          </label>
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
