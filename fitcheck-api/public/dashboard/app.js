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

// ─── New: image assignments and page order ─────────────────────────────────────
const AGENT_IMAGES = {
  'lifecycle-email':         'editorial-blue.jpg',
  'conversion-intelligence': 'editorial-purple.jpg',
  'community-manager':       'editorial-tan.jpg',
  'social-media-manager':    'editorial-orange.jpg',
  'appstore-manager':        'editorial-teal.jpg',
  'outreach-agent':          'editorial-sketches.jpg',
};

const PAGE_ORDER = ['overview', 'social', 'queue', 'log'];

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

  // Find and transition to target page
  const targetPage = document.querySelector(`[data-page="${page}"]`);
  if (!targetPage) { navigate('overview'); return; }

  transitionToPage(targetPage);

  // Update dot nav active state
  // For agent detail, keep the overview dot active (it's a drill-down)
  document.querySelectorAll('[data-dot]').forEach(dot => {
    const isActive = dot.dataset.dot === page ||
                     (page === 'agent' && dot.dataset.dot === 'overview');
    dot.classList.toggle('active', isActive);
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

// ─── Page transition (crossfade + slide) ─────────────────────────────────────
let _isTransitioning = false;

function transitionToPage(newPageEl) {
  const currentPage = document.querySelector('.magazine-page:not(.hidden)');

  // No transition needed (same page or first load)
  if (!currentPage || currentPage === newPageEl) {
    document.querySelectorAll('.magazine-page').forEach(p => p.classList.add('hidden'));
    newPageEl.classList.remove('hidden');
    return;
  }

  // If mid-transition, jump immediately
  if (_isTransitioning) {
    document.querySelectorAll('.magazine-page').forEach(p => {
      p.classList.add('hidden');
      p.style.cssText = '';
    });
    newPageEl.classList.remove('hidden');
    _isTransitioning = false;

    const container = document.getElementById('page-container');
    if (container) container.scrollTop = 0;
    return;
  }

  _isTransitioning = true;

  const container = document.getElementById('page-container');
  if (container) container.scrollTop = 0;

  // Animate out current page
  const ease = 'cubic-bezier(0.25,0.46,0.45,0.94)';
  currentPage.style.transition = `opacity 0.4s ${ease}, transform 0.4s ${ease}`;
  currentPage.style.opacity    = '0';
  currentPage.style.transform  = 'translateX(-30px)';

  setTimeout(() => {
    if (!_isTransitioning) return;

    currentPage.classList.add('hidden');
    currentPage.style.cssText = '';

    // Stage new page off-screen
    newPageEl.style.opacity   = '0';
    newPageEl.style.transform = 'translateX(30px)';
    newPageEl.classList.remove('hidden');

    // Force reflow before animating in
    void newPageEl.offsetHeight;

    newPageEl.style.transition = `opacity 0.4s ${ease}, transform 0.4s ${ease}`;
    newPageEl.style.opacity    = '1';
    newPageEl.style.transform  = 'translateX(0)';

    setTimeout(() => {
      if (!_isTransitioning) return;
      newPageEl.style.cssText = '';
      _isTransitioning = false;
    }, 400);
  }, 400);
}

// ─── Dot nav init ─────────────────────────────────────────────────────────────
function initDotNav() {
  document.querySelectorAll('[data-dot]').forEach(dot => {
    dot.addEventListener('click', () => navigate(dot.dataset.dot));
  });
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
  const imgs = ['/dashboard/images/editorial-purple.jpg','/dashboard/images/editorial-tan.jpg','/dashboard/images/editorial-teal.jpg'];
  const img = imgs[Math.floor(Math.random() * imgs.length)];
  return `<div style="position:relative;overflow:hidden;min-height:200px;display:flex;align-items:center;justify-content:center;">
    <img src="${img}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0.06;pointer-events:none;">
    <div style="position:relative;text-align:center;padding:56px 24px;">
      <span class="editorial-rule" style="margin:0 auto 20px;"></span>
      <p style="font-family:'Playfair Display',Georgia,serif;font-style:italic;font-size:1rem;color:var(--muted);margin-bottom:6px;">Nothing here yet</p>
      <p class="section-label">${esc(msg)}</p>
    </div>
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

// ─── Count-up animation ───────────────────────────────────────────────────────
function countUp(el, target, duration) {
  if (target === 0) { el.textContent = '0'; return; }
  const start = performance.now();
  function tick(now) {
    const elapsed  = now - start;
    const progress = Math.min(elapsed / duration, 1);
    // Ease-out cubic: 1 - (1-t)^3
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.floor(eased * target);
    if (progress < 1) requestAnimationFrame(tick);
    else el.textContent = target;
  }
  requestAnimationFrame(tick);
}

// ─── Scroll-reveal ────────────────────────────────────────────────────────────
let _scrollObserver = null;

function initScrollReveal() {
  const container = document.getElementById('page-container');
  if (!container) return;

  if (_scrollObserver) _scrollObserver.disconnect();

  _scrollObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          // Stagger via inline transition-delay
          entry.target.style.transitionDelay = `${i * 80}ms`;
          entry.target.classList.add('revealed');
          _scrollObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, root: container }
  );

  document.querySelectorAll('.reveal').forEach(el => {
    if (!el.classList.contains('revealed')) {
      _scrollObserver.observe(el);
    }
  });
}

// ─── Overview ────────────────────────────────────────────────────────────────
async function loadOverview() {
  const sectionEl = document.querySelector('[data-page="overview"]');
  if (!sectionEl) return;

  sectionEl.innerHTML = `<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;">${loadingHTML()}</div>`;

  try {
    const [summary, dash] = await Promise.all([
      apiGet('/api/admin/agents/summary'),
      apiGet('/api/admin/agents'),
    ]);

    const statMap = dash.agentStats || {};

    // Stat definitions for hero
    const heroStats = [
      { label: 'Actions Today',    value: summary.totalToday    || 0 },
      { label: 'Pending Approval', value: summary.pendingCount  || 0 },
      { label: 'Executed Today',   value: summary.executedToday || 0 },
      { label: 'Failed Today',     value: summary.failedToday   || 0 },
    ];

    // Portrait cards for horizontal strip
    const stripCards = AGENT_NAMES.map(name => {
      const agentStats = statMap[name] || {};
      const executed   = agentStats.executed || 0;
      const pending    = agentStats.pending  || 0;
      const imgFile    = AGENT_IMAGES[name]  || 'editorial-blue.jpg';
      const label      = agentLabel(name);
      const isSketch   = imgFile === 'editorial-sketches.jpg';

      return `
        <div class="portrait-card reveal" onclick="navigate('agent', '${esc(name)}')">
          <div class="portrait-card-img">
            <img src="/dashboard/images/${esc(imgFile)}" alt="${esc(label)}"
                 style="${isSketch
                   ? 'object-fit:contain;object-position:center;background:var(--cream-dark);'
                   : 'object-fit:cover;object-position:center 20%;'}">
          </div>
          <div class="portrait-card-info">
            <div>
              <div style="font-family:'Playfair Display',Georgia,serif;font-weight:400;font-style:normal;font-size:1.125rem;color:var(--black);line-height:1.2;margin-bottom:8px;">${esc(label)}</div>
              <div style="font-size:0.8125rem;color:var(--muted);">${executed} actions · ${pending} pending</div>
            </div>
            <div style="font-size:0.6875rem;font-weight:500;letter-spacing:0.15em;text-transform:uppercase;color:var(--coral);">View Story →</div>
          </div>
        </div>`;
    }).join('');

    // Reporting masthead
    const mastheadItems = REPORTING_AGENTS.map(a => `
      <div class="masthead-item reveal">
        <span style="font-family:'DM Sans',sans-serif;font-weight:600;font-size:0.9375rem;color:var(--black);">${esc(a.label)}</span>
        <button onclick="handleTrigger('${esc(a.name)}', this)"
                class="btn-coral" style="padding:6px 14px;font-size:0.6875rem;flex-shrink:0;">Run ▶</button>
      </div>`).join('');

    // Pending preview
    const pending = (dash.recentActions || []).filter(a => a.status === 'pending').slice(0, 5);
    const pendingHTML = pending.length === 0
      ? emptyHTML('Queue is clear — no actions pending')
      : `<div class="card" style="overflow:hidden;">${pending.map(a => queueItemHTML(a)).join('')}</div>`;

    sectionEl.innerHTML = `
      <!-- Full-bleed hero -->
      <div class="hero-fullbleed">
        <img src="/dashboard/images/editorial-duo.jpg" alt="" class="hero-img">
        <div class="hero-overlay"></div>
        <div class="hero-content">
          <p class="section-label" style="color:rgba(255,255,255,0.65);margin-bottom:20px;">The Issue</p>
          <span class="editorial-rule" style="margin:0 0 20px 0;display:block;"></span>
          <h1 style="font-family:'Playfair Display',Georgia,serif;font-weight:400;font-style:normal;font-size:clamp(3.5rem,8vw,6rem);color:white;line-height:0.95;letter-spacing:-0.03em;margin-bottom:40px;">Your Agents.</h1>
          <div class="hero-stats">
            ${heroStats.map((s, i) => `
              <div>
                <div class="hero-stat-number" data-count-target="${s.value}" data-count-delay="${i * 150}">0</div>
                <p class="hero-stat-label">${esc(s.label)}</p>
              </div>`).join('')}
          </div>
          <div style="margin-top:48px;">
            <span style="font-size:0.625rem;font-weight:500;letter-spacing:0.25em;text-transform:uppercase;color:rgba(255,255,255,0.45);">Scroll for Agents ↓</span>
          </div>
        </div>
      </div>

      <!-- Operator agent strip -->
      <div style="background:var(--cream);padding:56px 0 48px;">
        <div style="padding:0 40px;display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:24px;">
          <div>
            <span class="editorial-rule" style="margin:0 0 12px 0;display:block;"></span>
            <p class="section-label">Operator Agents</p>
          </div>
          <button onclick="document.getElementById('reporting-section').scrollIntoView({behavior:'smooth'})"
                  style="font-size:0.6875rem;font-weight:500;letter-spacing:0.15em;text-transform:uppercase;color:var(--coral);background:none;border:none;cursor:pointer;padding:0;">
            11 Reporting Agents ↓
          </button>
        </div>
        <div class="h-scroll-strip" id="agent-strip">
          ${stripCards}
        </div>
      </div>

      <!-- Reporting masthead -->
      <div id="reporting-section" style="background:white;padding:56px 64px;">
        <span class="editorial-rule" style="margin:0 0 12px 0;display:block;"></span>
        <p class="section-label" style="margin-bottom:32px;">Reporting &amp; Intelligence</p>
        <div class="masthead-grid" id="reporting-agents">
          ${mastheadItems}
        </div>
      </div>

      <!-- Pending preview -->
      <div style="background:var(--cream);padding:56px 64px;">
        <div style="display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:24px;">
          <div>
            <span class="editorial-rule" style="margin:0 0 12px 0;display:block;"></span>
            <p class="section-label">Pending Approval</p>
          </div>
          <a href="#queue" style="font-size:0.6875rem;font-weight:500;letter-spacing:0.15em;text-transform:uppercase;color:var(--coral);text-decoration:none;">View All →</a>
        </div>
        <div id="pending-preview">${pendingHTML}</div>
      </div>

      <div class="photo-credit">Photography by Fabian Kunzel-Zeller &amp; Charlota Blunarova via Unsplash</div>
    `;

    // Trigger count-up on stat numbers
    sectionEl.querySelectorAll('[data-count-target]').forEach(el => {
      const target = parseInt(el.dataset.countTarget, 10) || 0;
      const delay  = parseInt(el.dataset.countDelay,  10) || 0;
      setTimeout(() => countUp(el, target, 800), delay);
    });

    // Set up scroll-reveal
    initScrollReveal();

  } catch (err) {
    sectionEl.innerHTML = `<div style="padding:80px;">${errorHTML(err.message)}</div>`;
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

    // Pending social posts only
    const pendingPosts = (queueData.actions || []).filter(
      a => a.agent === 'social-media-manager' && a.actionType === 'post_social'
    );

    if (pendingPosts.length === 0) {
      queueEl.innerHTML = emptyHTML('No posts awaiting review');
    } else {
      queueEl.innerHTML = pendingPosts.map(a => socialPostCardHTML(a)).join('');
    }

    // History — non-pending social posts
    const historyPosts = (logData.actions || []).filter(
      a => a.actionType === 'post_social' && a.status !== 'pending'
    );

    if (historyPosts.length === 0) {
      historyEl.innerHTML = emptyHTML('No post history yet');
    } else {
      historyEl.innerHTML = historyPosts.map(a => socialPostCardHTML(a, { showActions: false, showHistory: true })).join('');
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
  const contentEl  = document.getElementById('queue-content');
  const paginEl    = document.getElementById('queue-pagination');
  const heroCount  = document.getElementById('queue-hero-count');
  if (!contentEl) return;

  contentEl.innerHTML = loadingHTML();
  if (paginEl) paginEl.innerHTML = '';

  try {
    const data = await apiGet(`/api/admin/agents/queue?page=${page}&limit=20`);

    if (heroCount) heroCount.textContent = data.total;

    if (data.actions.length === 0) {
      contentEl.innerHTML = emptyHTML('Queue is empty — no actions awaiting approval');
      return;
    }

    contentEl.innerHTML = data.actions.map(a => queueItemHTML(a)).join('');
    if (paginEl) paginEl.innerHTML = paginationHTML(page, data.total, 20, 'loadQueue');
  } catch (err) {
    contentEl.innerHTML = errorHTML(err.message);
  }
}

// ─── Social post card ─────────────────────────────────────────────────────────
function socialPostCardHTML(action, opts = {}) {
  const id       = esc(action.id);
  const p        = action.payload || {};
  const content  = p.content || '';
  const hashtags = Array.isArray(p.hashtags) ? p.hashtags : [];
  const platform = (p.platform || 'twitter').toLowerCase();
  const ctLabel  = CONTENT_TYPE_LABELS[p.contentType] || p.contentType || '';
  const imgHint  = p.imageDescription || '';
  const postId   = p.socialPostId || '';
  const pmeta    = PLATFORM_META[platform] || PLATFORM_META.twitter;

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
    <div id="qi-${id}" style="background:white;border:1px solid var(--border-solid);border-radius:8px;padding:32px 36px;margin-bottom:24px;${showHistory ? 'opacity:0.85;' : ''}">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:16px;">
        <span class="pill ${pmeta.cls}" style="font-size:0.75rem;font-weight:600;">${pmeta.icon} ${esc(pmeta.label)}</span>
        ${ctLabel ? `<span class="content-type-chip">${esc(ctLabel)}</span>` : ''}
        ${riskBadge(action.riskLevel)}
        <span style="margin-left:auto;font-size:0.8125rem;color:var(--muted);">${fmtRelative(action.createdAt)}</span>
        ${showHistory ? statusPill(action.status) : ''}
      </div>

      <!-- Read view -->
      <div class="post-read-view-${id}">
        <div class="post-text" style="margin-bottom:16px;">${esc(content)}</div>
        <div style="display:flex;align-items:center;flex-wrap:wrap;gap:4px;margin-bottom:${imgHint ? '12px' : '0'};">
          ${hashtagHTML}
          ${pmeta.limit ? `<span class="char-count ${charCls}" style="margin-left:auto;">${charLen}/${pmeta.limit}</span>` : ''}
        </div>
        ${imgHint ? `<p class="image-hint" style="margin-bottom:16px;">📷 ${esc(imgHint)}</p>` : ''}
      </div>

      <!-- Edit view (hidden by default) -->
      <div class="post-edit-view-${id}" style="display:none;">
        <textarea
          id="post-edit-content-${id}"
          style="width:100%;min-height:120px;padding:16px;border:1px solid var(--coral);background:var(--cream);font-family:'DM Sans',sans-serif;font-size:1rem;line-height:1.65;resize:vertical;color:var(--black);letter-spacing:-0.01em;"
        >${esc(content)}</textarea>
        <div style="margin-top:8px;">
          <input
            id="post-edit-hashtags-${id}"
            type="text"
            value="${esc(hashtags.join(' '))}"
            placeholder="hashtag1 hashtag2 (no # needed)"
            style="width:100%;padding:10px 14px;border:1px solid var(--border-solid);font-family:'DM Sans',sans-serif;font-size:0.875rem;color:var(--charcoal);background:white;"
          >
          <p style="font-size:0.6875rem;color:var(--muted);margin-top:4px;letter-spacing:0.05em;">Space-separated hashtags, without #</p>
        </div>
      </div>

      ${showActions ? `
        <div style="display:flex;gap:10px;padding-top:16px;border-top:1px solid var(--border-solid);flex-wrap:wrap;">
          <button onclick="handleApprove('${id}')" class="btn-approve" style="padding:10px 24px;">Approve ✓</button>
          <button onclick="togglePostEdit('${id}')" class="btn-outline" style="padding:10px 18px;" id="post-edit-btn-${id}">Edit</button>
          <button onclick="handleEditAndApprove('${id}', '${esc(postId)}')" class="btn-coral" style="padding:10px 24px;display:none;" id="post-save-btn-${id}">Save &amp; Approve →</button>
          <button onclick="handleReject('${id}')" class="btn-reject" style="padding:10px 18px;margin-left:auto;">Reject ✕</button>
        </div>` : ''}
    </div>`;
}

// ─── Social post edit helpers ─────────────────────────────────────────────────
function togglePostEdit(actionId) {
  const readView = document.querySelector(`.post-read-view-${actionId}`);
  const editView = document.querySelector(`.post-edit-view-${actionId}`);
  const editBtn  = document.getElementById(`post-edit-btn-${actionId}`);
  const saveBtn  = document.getElementById(`post-save-btn-${actionId}`);
  if (!readView || !editView) return;

  const isEditing = editView.style.display !== 'none';
  if (isEditing) {
    // Cancel — restore read view
    readView.style.display = '';
    editView.style.display = 'none';
    editBtn.textContent = 'Edit';
    saveBtn.style.display = 'none';
  } else {
    // Enter edit mode
    readView.style.display = 'none';
    editView.style.display = '';
    editBtn.textContent = 'Cancel';
    saveBtn.style.display = '';
    document.getElementById(`post-edit-content-${actionId}`)?.focus();
  }
}

async function handleEditAndApprove(actionId, postId) {
  if (!postId) {
    // No socialPostId in payload — just approve as-is
    return handleApprove(actionId);
  }

  const contentEl  = document.getElementById(`post-edit-content-${actionId}`);
  const hashtagsEl = document.getElementById(`post-edit-hashtags-${actionId}`);
  const saveBtn    = document.getElementById(`post-save-btn-${actionId}`);
  if (!contentEl) return;

  const content  = contentEl.value.trim();
  const hashtags = hashtagsEl?.value.trim()
    ? hashtagsEl.value.trim().split(/\s+/).map(h => h.replace(/^#/, ''))
    : [];

  if (!content) { showToast('Post content cannot be empty', 'error'); return; }

  const origText = saveBtn.textContent;
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving…';

  try {
    await apiPost(`/api/admin/agents/social-posts/${postId}`, { content, hashtags });
    await apiPost(`/api/admin/agents/actions/${actionId}/approve`);
    showToast('Post updated and approved — executing now');
    removeQueueItem(actionId);
  } catch (err) {
    showToast(err.message, 'error');
    saveBtn.disabled = false;
    saveBtn.textContent = origText;
  }
}

// ─── Queue item ───────────────────────────────────────────────────────────────
function queueItemHTML(action) {
  // Social media posts get a rich preview card
  if (action.agent === 'social-media-manager' && action.actionType === 'post_social') {
    return socialPostCardHTML(action);
  }

  const id      = esc(action.id);
  const payload = prettyJSON(action.payload);

  return `
    <div id="qi-${id}" style="background:white;border:1px solid var(--border-solid);border-radius:8px;padding:28px 32px;margin-bottom:20px;">
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px;">
        ${riskBadge(action.riskLevel)}
        <span style="font-weight:600;font-size:0.875rem;color:var(--black);">${esc(agentLabel(action.agent))}</span>
        <span style="margin-left:auto;font-size:0.8125rem;color:var(--muted);">${fmtRelative(action.createdAt)}</span>
      </div>
      <p style="font-size:1.0625rem;color:var(--black);line-height:1.6;margin-bottom:16px;">${esc(action.actionType)}</p>
      <details style="margin-bottom:16px;">
        <summary style="font-size:0.75rem;color:var(--coral);cursor:pointer;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;user-select:none;">
          View Details ▾
        </summary>
        <pre style="margin-top:10px;padding:12px 16px;background:var(--cream-dark);font-size:0.72rem;color:var(--charcoal);overflow:auto;max-height:160px;white-space:pre-wrap;word-break:break-all;">${esc(payload)}</pre>
      </details>
      <div style="display:flex;gap:10px;">
        <button onclick="handleApprove('${id}')" class="btn-approve" style="padding:10px 24px;">Approve</button>
        <button onclick="handleReject('${id}')"  class="btn-reject"  style="padding:10px 18px;">Reject</button>
      </div>
    </div>`;
}

// ─── Agent Detail ────────────────────────────────────────────────────────────
let _currentAgent = '';

async function loadAgent(name) {
  if (!name) { navigate('overview'); return; }
  _currentAgent = name;

  const el = document.getElementById('agent-detail-content');
  if (!el) return;
  el.innerHTML = loadingHTML();

  try {
    const [dash, actionsData] = await Promise.all([
      apiGet('/api/admin/agents'),
      apiGet(`/api/admin/agents/${encodeURIComponent(name)}/actions?page=1&limit=20`),
    ]);

    const cfg      = (dash.configs || []).find(c => c.agent === name);
    const stats    = (dash.agentStats || {})[name] || {};
    const enabled  = cfg ? cfg.enabled : true;
    const imgFile  = AGENT_IMAGES[name] || 'editorial-blue.jpg';
    const label    = agentLabel(name);
    const isSketch = imgFile === 'editorial-sketches.jpg';

    el.innerHTML = `
      <!-- Agent hero -->
      <div class="agent-hero">
        <img src="/dashboard/images/${esc(imgFile)}" alt="${esc(label)}"
             style="${isSketch
               ? 'object-fit:contain;object-position:center;background:var(--cream-dark);'
               : 'object-fit:cover;object-position:center 30%;'}">
        <div class="agent-hero-overlay"></div>
        <div class="agent-hero-text">
          <span class="editorial-rule" style="margin:0 0 12px 0;display:block;width:40px;"></span>
          <p class="section-label" style="color:rgba(255,255,255,0.65);margin-bottom:8px;">${esc(name)}</p>
          <h1 style="font-family:'Playfair Display',Georgia,serif;font-weight:400;font-style:normal;font-size:3.5rem;color:white;line-height:1.1;letter-spacing:-0.02em;">${esc(label)}</h1>
        </div>
      </div>

      <!-- Fact sheet -->
      <div style="background:var(--cream);padding:56px 64px;">
        <a href="#overview" style="font-size:0.75rem;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;color:var(--coral);text-decoration:none;display:inline-block;margin-bottom:40px;">← Overview</a>

        <div style="display:grid;grid-template-columns:60% 40%;gap:56px;">
          <!-- Left: narrative -->
          <div>
            <p class="section-label" style="margin-bottom:16px;">About This Agent</p>
            <p style="font-size:1rem;color:var(--charcoal);line-height:1.7;max-width:560px;margin-bottom:32px;">
              ${esc(cfg?.description || `The ${label} agent manages automated tasks and actions on your behalf.`)}
            </p>

            <div style="display:flex;align-items:center;gap:16px;padding:20px 0;border-top:1px solid var(--border-solid);border-bottom:1px solid var(--border-solid);margin-bottom:28px;">
              <p class="section-label">Agent Status</p>
              <label class="toggle-switch">
                <input type="checkbox" ${enabled ? 'checked' : ''} data-agent="${esc(name)}" onchange="handleToggle(this)">
                <span class="toggle-slider"></span>
              </label>
              <span style="font-size:0.875rem;color:var(--charcoal);">${enabled ? 'Enabled' : 'Paused'}</span>
            </div>

            <button onclick="handleTrigger('${esc(AGENT_TRIGGER_NAME[name] || name)}', this)"
                    class="btn-coral" style="padding:14px 28px;">
              ▶ Run Now
            </button>
          </div>

          <!-- Right: stats sidebar -->
          <div>
            <span class="editorial-rule" style="margin:0 0 24px 0;width:30px;display:block;"></span>
            <div style="display:flex;flex-direction:column;gap:0;">
              ${[
                { label: 'Actions Today', value: stats.executed || 0 },
                { label: 'Failed Today',  value: stats.failed   || 0 },
                { label: 'Pending',       value: stats.pending  || 0 },
                { label: 'Max / Day',     value: cfg?.maxActionsPerDay ?? 50 },
              ].map(s => `
                <div style="display:flex;align-items:baseline;justify-content:space-between;padding:16px 0;border-bottom:1px solid rgba(0,0,0,0.06);">
                  <p class="section-label">${esc(s.label)}</p>
                  <span style="font-family:'Playfair Display',Georgia,serif;font-weight:400;font-style:normal;font-size:2rem;color:var(--black);">${s.value}</span>
                </div>`).join('')}
            </div>
          </div>
        </div>
      </div>

      <!-- Action history -->
      <div style="background:white;padding:48px 64px 64px;">
        <span class="editorial-rule" style="margin:0 0 12px 0;display:block;"></span>
        <p class="section-label" style="margin-bottom:24px;">Recent Actions</p>
        <div class="card" style="overflow:hidden;">
          <div id="agent-actions-table">
            ${actionsTableHTML(actionsData.actions)}
          </div>
          <div style="padding:16px 20px;border-top:1px solid rgba(0,0,0,0.06);">
            ${paginationHTML(1, actionsData.total, 20, 'loadAgentPage')}
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    el.innerHTML = `<div style="padding:80px;">${errorHTML(err.message)}</div>`;
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
    </table>`;
}

// ─── Action Log ──────────────────────────────────────────────────────────────
async function loadLog(page) {
  page = page || 1;
  const contentEl = document.getElementById('log-content');
  const paginEl   = document.getElementById('log-pagination');
  if (!contentEl) return;

  contentEl.innerHTML = loadingHTML();
  if (paginEl) paginEl.innerHTML = '';

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
      contentEl.innerHTML = emptyHTML('No actions match the current filters');
      return;
    }

    contentEl.innerHTML = `
      <div class="card" style="overflow:hidden;">
        ${data.actions.map(a => logRowHTML(a)).join('')}
      </div>`;
    if (paginEl) paginEl.innerHTML = paginationHTML(page, data.total, 50, 'loadLog');
  } catch (err) {
    contentEl.innerHTML = errorHTML(err.message);
  }
}

function logRowHTML(action) {
  const payload = prettyJSON(action.payload);
  const result  = action.result ? prettyJSON(action.result) : null;
  return `
    <details style="border-bottom:1px solid rgba(0,0,0,0.06);">
      <summary style="padding:16px 24px;cursor:pointer;user-select:none;list-style:none;">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          <span style="font-size:0.75rem;color:var(--muted);">▶</span>
          ${statusPill(action.status)}
          ${riskBadge(action.riskLevel)}
          <span style="font-weight:600;font-size:0.875rem;color:var(--black);">${esc(agentLabel(action.agent))}</span>
          <span style="color:var(--charcoal);font-size:0.875rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:300px;">${esc(action.actionType)}</span>
          <span style="margin-left:auto;font-size:0.75rem;color:var(--muted);white-space:nowrap;">${fmtDate(action.createdAt)}</span>
        </div>
      </summary>
      <div style="padding:16px 24px 20px;background:var(--cream-dark);border-top:1px solid rgba(0,0,0,0.06);">
        <p class="section-label" style="margin-bottom:8px;">Payload</p>
        <pre style="padding:12px 16px;background:white;border:1px solid var(--border-solid);font-size:0.72rem;color:var(--charcoal);overflow:auto;max-height:160px;white-space:pre-wrap;word-break:break-all;">${esc(payload)}</pre>
        ${result ? `
          <p class="section-label" style="margin-top:12px;margin-bottom:8px;">Result</p>
          <pre style="padding:12px 16px;background:white;border:1px solid var(--border-solid);font-size:0.72rem;color:var(--charcoal);overflow:auto;max-height:160px;white-space:pre-wrap;word-break:break-all;">${esc(result)}</pre>` : ''}
        ${action.executedAt ? `<p style="font-size:0.75rem;color:var(--muted);margin-top:10px;">Executed: ${fmtDate(action.executedAt)}</p>` : ''}
        ${action.reviewedBy ? `<p style="font-size:0.75rem;color:var(--muted);margin-top:4px;">Reviewed by: ${esc(action.reviewedBy)}</p>` : ''}
      </div>
    </details>`;
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
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleReject(actionId) {
  try {
    await apiPost(`/api/admin/agents/actions/${actionId}/reject`);
    showToast('Action rejected', 'warning');
    removeQueueItem(actionId);
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
    'Kill all 6 operator agents?\n\n' +
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

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initDotNav();

  document.getElementById('kill-all-btn')?.addEventListener('click', handleKillAll);
  document.getElementById('logout-btn')?.addEventListener('click', () => {
    clearToken();
    navigate('login');
  });
  document.getElementById('log-filter-btn')?.addEventListener('click', () => loadLog(1));

  routePage();
});
