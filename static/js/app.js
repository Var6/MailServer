'use strict';
/* ================================================================
   Enterprise Mail Client - Complete Single Page Application
   ================================================================ */

// ── API Client ─────────────────────────────────────────────────────────────────
class ApiClient {
  constructor(baseUrl = '') {
    this.baseUrl = baseUrl;
    this.accessToken = localStorage.getItem('access_token');
    this.refreshToken = localStorage.getItem('refresh_token');
    this._refreshing = false;
    this._refreshQueue = [];
  }

  setTokens(access, refresh) {
    this.accessToken = access;
    if (refresh !== undefined) this.refreshToken = refresh;
    localStorage.setItem('access_token', access || '');
    if (refresh !== undefined) localStorage.setItem('refresh_token', refresh || '');
  }

  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  }

  async request(method, path, body = null, isFormData = false, retry = true) {
    const headers = {};
    if (this.accessToken) headers['Authorization'] = `Bearer ${this.accessToken}`;
    if (!isFormData && body) headers['Content-Type'] = 'application/json';

    const options = { method, headers };
    if (body) options.body = isFormData ? body : JSON.stringify(body);

    let res;
    try {
      res = await fetch(this.baseUrl + path, options);
    } catch (err) {
      throw new Error('Network error: ' + err.message);
    }

    if (res.status === 401 && retry && this.refreshToken) {
      const newToken = await this._doRefresh();
      if (newToken) return this.request(method, path, body, isFormData, false);
      else throw new Error('Session expired. Please log in again.');
    }

    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const j = await res.json();
        detail = j.detail || JSON.stringify(j);
      } catch (_) {}
      throw new Error(detail);
    }

    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) return res.json();
    return res;
  }

  async _doRefresh() {
    if (this._refreshing) {
      return new Promise(resolve => this._refreshQueue.push(resolve));
    }
    this._refreshing = true;
    try {
      const data = await this.request('POST', '/api/auth/refresh', { refresh_token: this.refreshToken }, false, false);
      this.setTokens(data.access_token);
      this._refreshQueue.forEach(r => r(data.access_token));
      this._refreshQueue = [];
      return data.access_token;
    } catch (_) {
      this._refreshQueue.forEach(r => r(null));
      this._refreshQueue = [];
      this.clearTokens();
      return null;
    } finally {
      this._refreshing = false;
    }
  }

  get(path) { return this.request('GET', path); }
  post(path, body) { return this.request('POST', path, body); }
  put(path, body) { return this.request('PUT', path, body); }
  del(path) { return this.request('DELETE', path); }
  postForm(path, formData) { return this.request('POST', path, formData, true); }
}

// ── State Store ────────────────────────────────────────────────────────────────
class Store {
  constructor(initial = {}) {
    this._state = initial;
    this._listeners = {};
  }

  get(key) { return this._state[key]; }

  set(key, value) {
    this._state[key] = value;
    if (this._listeners[key]) this._listeners[key].forEach(fn => fn(value));
  }

  subscribe(key, fn) {
    if (!this._listeners[key]) this._listeners[key] = [];
    this._listeners[key].push(fn);
  }

  getAll() { return { ...this._state }; }
}

// ── Toast Notifications ────────────────────────────────────────────────────────
class Toast {
  constructor() {
    this.container = document.getElementById('toast-container');
  }

  show(message, type = 'info', duration = 4000) {
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
      <span>${message}</span>
      <span class="toast-close">✕</span>
    `;
    this.container.appendChild(toast);

    requestAnimationFrame(() => { requestAnimationFrame(() => toast.classList.add('show')); });

    toast.querySelector('.toast-close').onclick = () => this._remove(toast);
    if (duration > 0) setTimeout(() => this._remove(toast), duration);
    return toast;
  }

  _remove(toast) {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }

  success(msg) { return this.show(msg, 'success'); }
  error(msg) { return this.show(msg, 'error', 6000); }
  warning(msg) { return this.show(msg, 'warning'); }
  info(msg) { return this.show(msg, 'info'); }
}

// ── WebSocket Manager ──────────────────────────────────────────────────────────
class WSManager {
  constructor(onMessage) {
    this.onMessage = onMessage;
    this.ws = null;
    this.reconnectDelay = 1000;
    this.maxDelay = 30000;
    this._pingInterval = null;
    this._shouldConnect = false;
  }

  connect(token) {
    this._shouldConnect = true;
    this.token = token;
    this._doConnect();
  }

  _doConnect() {
    if (!this._shouldConnect || !this.token) return;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${proto}://${location.host}/ws?token=${this.token}`;
    try {
      this.ws = new WebSocket(url);
      this.ws.onopen = () => {
        this.reconnectDelay = 1000;
        this._startPing();
      };
      this.ws.onmessage = e => {
        try { this.onMessage(JSON.parse(e.data)); } catch (_) {}
      };
      this.ws.onclose = () => {
        this._stopPing();
        if (this._shouldConnect) {
          setTimeout(() => this._doConnect(), this.reconnectDelay);
          this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxDelay);
        }
      };
      this.ws.onerror = () => this.ws.close();
    } catch (_) {}
  }

  _startPing() {
    this._pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send('ping');
    }, 25000);
  }

  _stopPing() {
    if (this._pingInterval) { clearInterval(this._pingInterval); this._pingInterval = null; }
  }

  disconnect() {
    this._shouldConnect = false;
    this._stopPing();
    if (this.ws) { this.ws.close(); this.ws = null; }
  }
}

// ── Utility Functions ──────────────────────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;
  const sameDay = date.toDateString() === now.toDateString();
  const sameWeek = diff < 7 * 86400000;
  const sameYear = date.getFullYear() === now.getFullYear();

  if (sameDay) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (sameWeek) return date.toLocaleDateString([], { weekday: 'short' });
  if (sameYear) return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateLong(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleString([], {
    weekday: 'short', month: 'short', day: 'numeric',
    year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i];
}

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function getEmailName(addr) {
  if (!addr) return 'Unknown';
  const match = addr.match(/^"?([^"<]+)"?\s*</);
  if (match) return match[1].trim();
  return addr.split('@')[0];
}

function getAvatarColor(str) {
  const colors = ['#667eea','#764ba2','#f093fb','#4facfe','#43e97b',
                  '#fa709a','#fda085','#30cfd0','#a18cd1','#f5576c',
                  '#4e54c8','#38f9d7','#fd7043','#ab47bc','#26c6da'];
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return colors[Math.abs(h) % colors.length];
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function el(id) { return document.getElementById(id); }
function qs(sel, root = document) { return root.querySelector(sel); }
function qsAll(sel, root = document) { return [...root.querySelectorAll(sel)]; }

// ── Main App ───────────────────────────────────────────────────────────────────
class MailApp {
  constructor() {
    this.api = new ApiClient();
    this.store = new Store({
      user: null,
      emails: [],
      currentEmail: null,
      currentFolder: 'INBOX',
      currentPage: 1,
      totalEmails: 0,
      unreadCounts: {},
      labels: [],
      contacts: [],
      selectedIds: new Set(),
      searchQuery: '',
      loading: false,
    });
    this.toast = new Toast();
    this.ws = new WSManager(msg => this._onWsMessage(msg));
    this._draftId = null;
    this._replyTo = null;
    this._attachments = [];
    this._editingContactId = null;
    this._editingUserId = null;
    this._contextEmailId = null;
    this._searchTimer = null;
    this._loadMoreObserver = null;
    this._gKeyPressed = false;
    this._gKeyTimer = null;
    this._composeRecipients = { to: [], cc: [], bcc: [] };
  }

  // ── Init ─────────────────────────────────────────────────────────────────────
  async init() {
    // Check if already logged in
    if (this.api.accessToken) {
      try {
        const user = await this.api.get('/api/auth/me');
        this.store.set('user', user);
        this._showApp();
        return;
      } catch (_) {
        this.api.clearTokens();
      }
    }
    this._showLogin();
  }

  _showLogin() {
    el('login-page').classList.remove('hidden');
    el('app').classList.add('hidden');
    this._setupLoginForm();
    // Set company name from API
    fetch('/api/health').then(r => r.json()).then(d => {
      const name = d.server || 'Enterprise Mail';
      el('company-name').textContent = name;
      el('login-company-brand').textContent = name;
    }).catch(() => {});
  }

  _setupLoginForm() {
    // Password visibility toggle
    const pwdToggle = el('pwd-toggle');
    const pwdInput  = el('login-password');
    const eyeShow   = el('eye-show');
    const eyeHide   = el('eye-hide');
    if (pwdToggle) {
      pwdToggle.onclick = () => {
        const isText = pwdInput.type === 'text';
        pwdInput.type = isText ? 'password' : 'text';
        eyeShow.style.display = isText ? '' : 'none';
        eyeHide.style.display = isText ? 'none' : '';
      };
    }

    el('login-form').onsubmit = async e => {
      e.preventDefault();
      const email    = el('login-email').value.trim();
      const password = el('login-password').value;
      const btn      = el('login-btn');
      const errEl    = el('login-error');
      const btnText  = el('login-btn-text');
      const spinner  = el('login-spinner');
      const arrow    = el('login-arrow');

      btn.disabled = true;
      btnText.textContent = 'Signing in…';
      if (spinner) { spinner.style.display = ''; arrow.style.display = 'none'; }
      errEl.style.display = 'none';

      try {
        const data = await this.api.post('/api/auth/login', { email, password });
        this.api.setTokens(data.access_token, data.refresh_token);
        this.store.set('user', data.user);
        this._showApp();
      } catch (err) {
        errEl.textContent = err.message || 'Invalid email or password.';
        errEl.style.display = 'block';
      } finally {
        btn.disabled = false;
        btnText.textContent = 'Sign In';
        if (spinner) { spinner.style.display = 'none'; arrow.style.display = ''; }
      }
    };
  }

  _showApp() {
    el('login-page').classList.add('hidden');
    el('app').classList.remove('hidden');

    const user = this.store.get('user');
    this._updateUserUI(user);
    this._setupEventListeners();
    this._connectWebSocket();

    // Load initial data
    this._loadLabels();
    this._loadUnreadCounts();
    this.loadEmails();
    this._loadStorageInfo();
  }

  _updateUserUI(user) {
    if (!user) return;
    const btn = el('user-avatar-btn');
    btn.textContent = getInitials(user.display_name);
    btn.style.background = user.avatar_color || getAvatarColor(user.email);

    if (user.is_admin) {
      el('nav-admin').style.display = '';
      el('menu-admin').style.display = '';
    }

    const companyName = 'Enterprise Mail';
    el('sidebar-company').textContent = companyName;
  }

  _connectWebSocket() {
    if (this.api.accessToken) this.ws.connect(this.api.accessToken);
  }

  _onWsMessage(msg) {
    switch (msg.type) {
      case 'new_email':
        this.toast.info(`📧 New email from ${getEmailName(msg.data.from)}: ${msg.data.subject}`);
        el('notif-dot').style.display = '';
        this._loadUnreadCounts();
        if (this.store.get('currentFolder') === msg.data.folder) this.loadEmails();
        break;
      case 'email_read':
        this._loadUnreadCounts();
        break;
    }
  }

  // ── Event Listeners ──────────────────────────────────────────────────────────
  _setupEventListeners() {
    // Compose button
    el('compose-btn').onclick = () => this.openCompose();
    el('compose-close-btn').onclick = () => this.closeCompose();
    el('compose-discard-btn').onclick = () => this.closeCompose();
    el('compose-expand-btn').onclick = () => {
      el('compose-modal').classList.toggle('fullscreen');
    };
    el('compose-send-btn').onclick = () => this.sendEmail();
    el('compose-draft-btn').onclick = () => this.saveDraft();

    // Toggle CC/BCC
    el('toggle-cc-btn').onclick = () => {
      const ccRow = el('cc-bcc-row');
      const bccRow = el('bcc-row');
      const show = ccRow.style.display === 'none';
      ccRow.style.display = show ? '' : 'none';
      bccRow.style.display = show ? '' : 'none';
      if (show) el('cc-input').focus();
    };

    // Folder navigation
    qsAll('.nav-item[data-folder]').forEach(item => {
      item.onclick = () => {
        const folder = item.dataset.folder;
        this._switchFolder(folder);
      };
    });

    // Panel navigation
    qsAll('.nav-item[data-panel]').forEach(item => {
      item.onclick = () => this._showPanel(item.dataset.panel);
    });

    // Search
    el('search-input').oninput = e => {
      clearTimeout(this._searchTimer);
      this._searchTimer = setTimeout(() => {
        this.store.set('searchQuery', e.target.value);
        this.store.set('currentPage', 1);
        this.loadEmails();
      }, 400);
    };

    el('search-input').onkeydown = e => {
      if (e.key === 'Escape') { el('search-input').value = ''; el('search-input').dispatchEvent(new Event('input')); }
    };

    // Refresh
    el('refresh-btn').onclick = () => this.loadEmails();

    // Select all
    el('select-all-cb').onchange = e => {
      const emails = this.store.get('emails');
      const ids = new Set(e.target.checked ? emails.map(em => em.id) : []);
      this.store.set('selectedIds', ids);
      this._renderEmailList();
      this._updateBulkToolbar();
    };

    // Bulk actions
    el('bulk-read-btn').onclick = () => this._bulkAction('read');
    el('bulk-unread-btn').onclick = () => this._bulkAction('unread');
    el('bulk-flag-btn').onclick = () => this._bulkAction('flag');
    el('bulk-archive-btn').onclick = () => this._bulkAction('move', 'Archive');
    el('bulk-delete-btn').onclick = () => this._bulkAction('delete');

    // Email toolbar
    el('btn-reply').onclick = () => this._replyToCurrentEmail();
    el('btn-reply-all').onclick = () => this._replyAllToCurrentEmail();
    el('btn-forward').onclick = () => this._forwardCurrentEmail();
    el('btn-flag-email').onclick = () => this._flagCurrentEmail();
    el('btn-move-email').onclick = () => this._showMoveDialog();
    el('btn-archive-email').onclick = () => this._archiveCurrentEmail();
    el('btn-delete-email').onclick = () => this._deleteCurrentEmail();

    // Recipients toggle
    el('recipients-toggle').onclick = () => {
      el('recipients-detail').classList.toggle('show');
      el('recipients-toggle').textContent =
        el('recipients-detail').classList.contains('show') ? 'Hide details' : 'Show details';
    };

    // User menu
    el('user-avatar-btn').onclick = e => {
      e.stopPropagation();
      el('user-menu').classList.toggle('show');
    };
    document.onclick = () => {
      el('user-menu').classList.remove('show');
      el('context-menu').classList.remove('show');
    };

    el('menu-profile').onclick = () => { this._showPanel('settings'); el('user-menu').classList.remove('show'); };
    el('menu-settings').onclick = () => { this._showPanel('settings'); el('user-menu').classList.remove('show'); };
    el('menu-admin').onclick = () => { this._showPanel('admin'); el('user-menu').classList.remove('show'); };
    el('menu-shortcuts').onclick = () => { this._showShortcuts(); el('user-menu').classList.remove('show'); };
    el('menu-logout').onclick = () => this.logout();

    // Move dialog
    el('move-cancel-btn').onclick = () => el('move-dialog-overlay').classList.remove('show');

    // Admin
    el('admin-add-user-btn').onclick = () => this._showAddUserDialog();
    el('add-user-cancel-btn').onclick = () => el('add-user-overlay').classList.remove('show');
    el('add-user-save-btn').onclick = () => this._createUser();

    // Contacts
    el('add-contact-btn').onclick = () => this._showAddContactDialog();
    el('contact-cancel-btn').onclick = () => el('add-contact-overlay').classList.remove('show');
    el('contact-save-btn').onclick = () => this._saveContact();
    el('contacts-search').oninput = e => this._searchContacts(e.target.value);

    // Settings
    el('save-profile-btn').onclick = () => this._saveProfile();
    el('save-password-btn').onclick = () => this._changePassword();
    el('add-label-btn').onclick = () => this._createLabel();

    // Shortcuts
    el('close-shortcuts-btn').onclick = () => el('shortcuts-overlay').classList.remove('show');
    el('shortcuts-overlay').onclick = e => {
      if (e.target === el('shortcuts-overlay')) el('shortcuts-overlay').classList.remove('show');
    };

    // Context menu
    el('ctx-reply').onclick = () => { this.openCompose({ replyTo: this._contextEmailId }); el('context-menu').classList.remove('show'); };
    el('ctx-forward').onclick = () => { this.openCompose({ forwardId: this._contextEmailId }); el('context-menu').classList.remove('show'); };
    el('ctx-mark-read').onclick = () => { this._markEmail(this._contextEmailId, 'read'); el('context-menu').classList.remove('show'); };
    el('ctx-mark-unread').onclick = () => { this._markEmail(this._contextEmailId, 'unread'); el('context-menu').classList.remove('show'); };
    el('ctx-flag').onclick = () => { this._flagEmail(this._contextEmailId); el('context-menu').classList.remove('show'); };
    el('ctx-archive').onclick = () => { this._moveEmail(this._contextEmailId, 'Archive'); el('context-menu').classList.remove('show'); };
    el('ctx-delete').onclick = () => { this._deleteEmail(this._contextEmailId); el('context-menu').classList.remove('show'); };

    // Keyboard shortcuts
    document.addEventListener('keydown', e => this._handleKeydown(e));

    // Compose - tag inputs
    this._setupTagInput('to');
    this._setupTagInput('cc');
    this._setupTagInput('bcc');

    // Compose - Rich Text Editor
    this._setupRTE();

    // Attach file
    el('attach-file-input').onchange = e => {
      for (const f of e.target.files) {
        this._attachments.push(f);
        this._renderAttachments();
      }
      e.target.value = '';
    };

    // Infinite scroll
    this._setupInfiniteScroll();

    // Notifications button
    el('notif-btn').onclick = () => {
      el('notif-dot').style.display = 'none';
    };

    // Drag and drop on folders
    this._setupDragAndDrop();
  }

  // ── Folder Navigation ─────────────────────────────────────────────────────────
  _switchFolder(folder) {
    this.store.set('currentFolder', folder);
    this.store.set('currentPage', 1);
    this.store.set('selectedIds', new Set());
    this.store.set('currentEmail', null);

    // Update active nav item
    qsAll('.nav-item[data-folder]').forEach(item => {
      item.classList.toggle('active', item.dataset.folder === folder);
    });

    // Update folder title
    const titles = { INBOX: 'Inbox', Sent: 'Sent', Drafts: 'Drafts', Spam: 'Spam', Trash: 'Trash', Archive: 'Archive', Starred: 'Starred' };
    el('folder-title').textContent = titles[folder] || folder;

    // Show email list, hide panels
    this._showEmailView();
    this.loadEmails();
  }

  _showPanel(panel) {
    // Hide all nav active states
    qsAll('.nav-item[data-folder]').forEach(i => i.classList.remove('active'));
    qsAll('.nav-item[data-panel]').forEach(i => {
      i.classList.toggle('active', i.dataset.panel === panel);
    });

    // Hide reading pane content, show panels
    el('email-view-area').classList.add('hidden');
    el('admin-panel').classList.add('hidden');
    el('settings-panel').classList.add('hidden');
    el('contacts-panel').classList.add('hidden');

    const panels = { admin: 'admin-panel', settings: 'settings-panel', contacts: 'contacts-panel' };
    if (panels[panel]) {
      el(panels[panel]).classList.remove('hidden');
      this._loadPanel(panel);
    }
  }

  _showEmailView() {
    el('email-view-area').classList.remove('hidden');
    el('admin-panel').classList.add('hidden');
    el('settings-panel').classList.add('hidden');
    el('contacts-panel').classList.add('hidden');
    qsAll('.nav-item[data-panel]').forEach(i => i.classList.remove('active'));
  }

  async _loadPanel(panel) {
    if (panel === 'admin') await this._loadAdminPanel();
    else if (panel === 'settings') await this._loadSettings();
    else if (panel === 'contacts') await this._loadContacts();
  }

  // ── Email Loading ─────────────────────────────────────────────────────────────
  async loadEmails(append = false) {
    if (this.store.get('loading')) return;
    this.store.set('loading', true);

    const folder = this.store.get('currentFolder');
    const page = this.store.get('currentPage');
    const search = this.store.get('searchQuery');

    if (!append) this._showSkeletonLoader();

    try {
      const params = new URLSearchParams({ folder, page, limit: 50 });
      if (search) params.set('search', search);
      const data = await this.api.get(`/api/emails?${params}`);

      if (append) {
        const existing = this.store.get('emails');
        this.store.set('emails', [...existing, ...data.emails]);
      } else {
        this.store.set('emails', data.emails);
      }
      this.store.set('totalEmails', data.total);
      this._renderEmailList();
    } catch (err) {
      this.toast.error('Failed to load emails: ' + err.message);
    } finally {
      this.store.set('loading', false);
    }
  }

  _showSkeletonLoader() {
    const list = el('email-list');
    list.innerHTML = Array(8).fill(0).map(() => `
      <div class="skeleton-item">
        <div class="skeleton skeleton-avatar"></div>
        <div class="skeleton-content">
          <div class="skeleton skeleton-line medium"></div>
          <div class="skeleton skeleton-line long"></div>
          <div class="skeleton skeleton-line short"></div>
        </div>
      </div>
    `).join('');
  }

  _renderEmailList() {
    const emails = this.store.get('emails');
    const selected = this.store.get('selectedIds');
    const list = el('email-list');

    if (!emails.length) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📭</div>
          <h3>No messages here</h3>
          <p>This folder is empty or no results match your search.</p>
        </div>`;
      return;
    }

    list.innerHTML = emails.map(em => this._renderEmailItem(em, selected.has(em.id))).join('');

    // Attach events
    list.querySelectorAll('.email-item').forEach(item => {
      const id = item.dataset.id;

      item.onclick = e => {
        if (e.target.classList.contains('checkbox') || e.target.classList.contains('flag-btn')) return;
        this.openEmail(id);
      };

      item.oncontextmenu = e => {
        e.preventDefault();
        this._contextEmailId = id;
        const ctx = el('context-menu');
        ctx.style.left = e.pageX + 'px';
        ctx.style.top = e.pageY + 'px';
        ctx.classList.add('show');
        e.stopPropagation();
      };

      const cb = item.querySelector('.checkbox');
      if (cb) {
        cb.onchange = e => {
          const ids = new Set(this.store.get('selectedIds'));
          e.target.checked ? ids.add(id) : ids.delete(id);
          this.store.set('selectedIds', ids);
          item.classList.toggle('checked', e.target.checked);
          this._updateBulkToolbar();
        };
        cb.checked = selected.has(id);
      }

      const flagBtn = item.querySelector('.flag-btn');
      if (flagBtn) {
        flagBtn.onclick = e => {
          e.stopPropagation();
          this._flagEmail(id);
        };
      }
    });
  }

  _renderEmailItem(em, isSelected) {
    const name = getEmailName(em.from_addr);
    const color = getAvatarColor(em.from_addr || '');
    const initials = getInitials(name);
    const time = formatDate(em.created_at);
    const preview = (em.body_text || '').replace(/\s+/g, ' ').substring(0, 80);
    const isUnread = !em.is_read;

    return `
      <div class="email-item ${isUnread ? 'unread' : ''} ${isSelected ? 'checked' : ''}"
           data-id="${em.id}" draggable="true" data-email-id="${em.id}">
        <input type="checkbox" class="checkbox" ${isSelected ? 'checked' : ''}>
        <div class="email-avatar" style="background:${color}">${initials}</div>
        <div class="email-content">
          <div class="email-meta">
            <span class="email-sender">${escapeHtml(name)}</span>
            <span class="email-time">${time}</span>
          </div>
          <div class="email-subject">${escapeHtml(em.subject || '(no subject)')}</div>
          <div class="email-preview">${escapeHtml(preview)}</div>
        </div>
        <div class="email-indicators">
          <button class="flag-btn ${em.is_flagged ? 'active' : ''}" data-flagged="${em.is_flagged}" title="Flag">⭐</button>
          ${em.has_attachments ? '<span class="att-indicator">📎</span>' : ''}
        </div>
      </div>`;
  }

  _updateBulkToolbar() {
    const count = this.store.get('selectedIds').size;
    const toolbar = el('bulk-toolbar');
    toolbar.style.display = count > 0 ? '' : 'none';
    el('bulk-count-text').textContent = count > 0 ? `${count} selected` : '';
    el('select-all-cb').checked = count > 0 && count === this.store.get('emails').length;
  }

  _setupInfiniteScroll() {
    const list = el('email-list');
    list.addEventListener('scroll', () => {
      if (list.scrollTop + list.clientHeight >= list.scrollHeight - 100) {
        const total = this.store.get('totalEmails');
        const emails = this.store.get('emails');
        if (emails.length < total && !this.store.get('loading')) {
          this.store.set('currentPage', this.store.get('currentPage') + 1);
          this.loadEmails(true);
        }
      }
    });
  }

  // ── Email View ────────────────────────────────────────────────────────────────
  async openEmail(id) {
    // Highlight in list
    qsAll('.email-item').forEach(i => i.classList.toggle('selected', i.dataset.id === id));

    try {
      const email = await this.api.get(`/api/emails/${id}`);
      this.store.set('currentEmail', email);
      this._renderEmail(email);

      // Update unread state in list
      const emails = this.store.get('emails');
      const idx = emails.findIndex(e => e.id === id);
      if (idx >= 0 && !emails[idx].is_read) {
        emails[idx].is_read = true;
        this.store.set('emails', emails);
        this._loadUnreadCounts();
      }
    } catch (err) {
      this.toast.error('Failed to load email: ' + err.message);
    }
  }

  _renderEmail(email) {
    el('email-view-empty').classList.add('hidden');
    el('email-view').classList.remove('hidden');

    el('view-subject').textContent = email.subject || '(no subject)';

    const name = getEmailName(email.from_addr);
    const color = getAvatarColor(email.from_addr || '');
    const avatar = el('view-sender-avatar');
    avatar.textContent = getInitials(name);
    avatar.style.background = color;

    el('view-sender-name').textContent = name;
    el('view-sender-addr').textContent = email.from_addr || '';
    el('view-date').textContent = formatDateLong(email.created_at);

    // Recipients detail
    const toList = email.to_addrs || [];
    const ccList = email.cc || [];
    el('recipients-detail').innerHTML = `
      <strong>From:</strong> ${escapeHtml(email.from_addr || '')}<br>
      <strong>To:</strong> ${escapeHtml(toList.join(', '))}<br>
      ${ccList.length ? `<strong>Cc:</strong> ${escapeHtml(ccList.join(', '))}<br>` : ''}
      <strong>Date:</strong> ${formatDateLong(email.created_at)}
    `;
    el('recipients-detail').classList.remove('show');
    el('recipients-toggle').textContent = 'Show details';

    // Update flag button
    const flagBtn = el('btn-flag-email');
    flagBtn.textContent = email.is_flagged ? '⭐ Unflag' : '⭐ Flag';

    // Body
    const bodyEl = el('email-body-content');
    if (email.body_html) {
      // Use sandboxed iframe for HTML
      const iframe = document.createElement('iframe');
      iframe.className = 'email-body-iframe';
      iframe.sandbox = 'allow-same-origin';
      iframe.style.width = '100%';
      iframe.style.minHeight = '300px';
      iframe.style.border = 'none';
      bodyEl.innerHTML = '';
      bodyEl.appendChild(iframe);
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      doc.open();
      doc.write(`<!DOCTYPE html><html><head>
        <meta charset="UTF-8">
        <style>body{font-family:Inter,sans-serif;font-size:14px;line-height:1.7;color:#2d3748;padding:0;margin:0;word-break:break-word;}
        a{color:#667eea;}img{max-width:100%;}</style>
        </head><body>${email.body_html}</body></html>`);
      doc.close();
      // Auto-resize
      setTimeout(() => {
        try {
          iframe.style.height = iframe.contentDocument.body.scrollHeight + 'px';
        } catch (_) {}
      }, 100);
    } else {
      bodyEl.innerHTML = `<div class="email-body-text">${escapeHtml(email.body_text || '')}</div>`;
    }

    // Attachments
    const attSection = el('attachments-section');
    const attList = el('attachment-list');
    if (email.attachments && email.attachments.length > 0) {
      attSection.style.display = '';
      attList.innerHTML = email.attachments.map(att => {
        const icon = this._getAttIcon(att.content_type);
        return `
          <a class="attachment-chip"
             href="/api/emails/${email.id}/attachment/${att.id}"
             download="${escapeHtml(att.filename)}"
             onclick="event.stopPropagation()">
            <span class="att-icon">${icon}</span>
            <div class="att-info">
              <span class="att-name">${escapeHtml(att.filename)}</span>
              <span class="att-size">${formatBytes(att.size_bytes)}</span>
            </div>
          </a>`;
      }).join('');
    } else {
      attSection.style.display = 'none';
    }
  }

  _getAttIcon(contentType) {
    if (!contentType) return '📄';
    if (contentType.startsWith('image/')) return '🖼️';
    if (contentType.startsWith('video/')) return '🎬';
    if (contentType.startsWith('audio/')) return '🎵';
    if (contentType.includes('pdf')) return '📕';
    if (contentType.includes('word') || contentType.includes('document')) return '📝';
    if (contentType.includes('excel') || contentType.includes('spreadsheet')) return '📊';
    if (contentType.includes('zip') || contentType.includes('archive')) return '📦';
    return '📎';
  }

  // ── Email Actions ─────────────────────────────────────────────────────────────
  async _markEmail(id, action) {
    try {
      await this.api.put(`/api/emails/${id}/${action}`);
      const emails = this.store.get('emails');
      const em = emails.find(e => e.id === id);
      if (em) em.is_read = action === 'read';
      this.store.set('emails', emails);
      this._renderEmailList();
      this._loadUnreadCounts();
    } catch (err) {
      this.toast.error(err.message);
    }
  }

  async _flagEmail(id) {
    try {
      const emails = this.store.get('emails');
      const em = emails.find(e => e.id === id);
      const action = em && em.is_flagged ? 'unflag' : 'flag';
      await this.api.put(`/api/emails/${id}/${action}`);
      if (em) em.is_flagged = action === 'flag';
      this.store.set('emails', emails);
      this._renderEmailList();

      // Update view toolbar if viewing this email
      const currentEmail = this.store.get('currentEmail');
      if (currentEmail && currentEmail.id === id) {
        currentEmail.is_flagged = action === 'flag';
        el('btn-flag-email').textContent = currentEmail.is_flagged ? '⭐ Unflag' : '⭐ Flag';
      }
    } catch (err) {
      this.toast.error(err.message);
    }
  }

  async _moveEmail(id, folder) {
    try {
      await this.api.put(`/api/emails/${id}/move`, { folder });
      this.toast.success(`Moved to ${folder}`);
      const emails = this.store.get('emails').filter(e => e.id !== id);
      this.store.set('emails', emails);
      this._renderEmailList();
      if (this.store.get('currentEmail')?.id === id) {
        el('email-view').classList.add('hidden');
        el('email-view-empty').classList.remove('hidden');
      }
    } catch (err) {
      this.toast.error(err.message);
    }
  }

  async _deleteEmail(id) {
    try {
      await this.api.del(`/api/emails/${id}`);
      this.toast.success('Email deleted');
      const emails = this.store.get('emails').filter(e => e.id !== id);
      this.store.set('emails', emails);
      this._renderEmailList();
      if (this.store.get('currentEmail')?.id === id) {
        el('email-view').classList.add('hidden');
        el('email-view-empty').classList.remove('hidden');
      }
      this._loadUnreadCounts();
    } catch (err) {
      this.toast.error(err.message);
    }
  }

  _flagCurrentEmail() {
    const email = this.store.get('currentEmail');
    if (email) this._flagEmail(email.id);
  }

  _archiveCurrentEmail() {
    const email = this.store.get('currentEmail');
    if (email) this._moveEmail(email.id, 'Archive');
  }

  _deleteCurrentEmail() {
    const email = this.store.get('currentEmail');
    if (email) this._deleteEmail(email.id);
  }

  _showMoveDialog() {
    const email = this.store.get('currentEmail');
    if (!email) return;
    const folders = ['INBOX', 'Archive', 'Spam', 'Trash'];
    el('move-folder-list').innerHTML = folders.map(f => `
      <button class="btn btn-secondary w-full" style="justify-content:flex-start;"
        onclick="app._moveEmail('${email.id}','${f}');el('move-dialog-overlay').classList.remove('show');">
        📁 ${f}
      </button>`).join('');
    el('move-dialog-overlay').classList.add('show');
  }

  async _bulkAction(action, folder = null) {
    const ids = [...this.store.get('selectedIds')];
    if (!ids.length) return;
    try {
      await this.api.put('/api/emails/bulk', { ids, action, folder });
      this.toast.success(`${ids.length} emails updated`);
      this.store.set('selectedIds', new Set());
      await this.loadEmails();
      this._loadUnreadCounts();
    } catch (err) {
      this.toast.error(err.message);
    }
  }

  // ── Compose ───────────────────────────────────────────────────────────────────
  openCompose(options = {}) {
    this._draftId = null;
    this._attachments = [];
    this._composeRecipients = { to: [], cc: [], bcc: [] };
    el('to-wrap').querySelector('.tag-input-inner').value = '';
    el('cc-input').value = '';
    el('bcc-input').value = '';
    el('compose-subject').value = '';
    el('compose-editor').innerHTML = '';
    el('attach-preview').innerHTML = '';
    el('cc-bcc-row').style.display = 'none';
    el('bcc-row').style.display = 'none';
    el('compose-title').textContent = 'New Message';
    this._renderTagInputs();

    // Set up reply/forward context
    if (options.replyTo || options.forwardId) {
      const emailId = options.replyTo || options.forwardId;
      const emails = this.store.get('emails');
      let email = emails.find(e => e.id === emailId) || this.store.get('currentEmail');

      if (email) {
        const isForward = !!options.forwardId;
        el('compose-title').textContent = isForward ? 'Forward Message' : 'Reply';

        if (!isForward) {
          this._addTag('to', email.from_addr);
          el('compose-subject').value = `Re: ${email.subject || ''}`;
        } else {
          el('compose-subject').value = `Fwd: ${email.subject || ''}`;
        }

        const user = this.store.get('user');
        const sig = user?.signature ? `<br><br>--<br>${user.signature}` : '';
        const quoted = `<br><br>On ${formatDateLong(email.created_at)}, ${escapeHtml(email.from_addr)} wrote:<br>
          <blockquote style="border-left:3px solid #ccc;margin:0;padding:0 0 0 12px;color:#555;">
            ${email.body_html || escapeHtml(email.body_text || '')}
          </blockquote>${sig}`;
        el('compose-editor').innerHTML = quoted;
      }
    } else {
      const user = this.store.get('user');
      if (user?.signature) {
        el('compose-editor').innerHTML = `<br><br>--<br>${user.signature}`;
      }
    }

    el('compose-overlay').classList.add('show');
    setTimeout(() => el('to-wrap').querySelector('.tag-input-inner').focus(), 100);
  }

  closeCompose() {
    el('compose-overlay').classList.remove('show');
    this._attachments = [];
  }

  async sendEmail() {
    const to = this._composeRecipients.to.join(',');
    if (!to) { this.toast.warning('Please add at least one recipient'); return; }

    const subject = el('compose-subject').value.trim();
    const bodyHtml = el('compose-editor').innerHTML;
    const bodyText = el('compose-editor').innerText;
    const cc = this._composeRecipients.cc.join(',');
    const bcc = this._composeRecipients.bcc.join(',');

    const fd = new FormData();
    fd.append('to', to);
    fd.append('subject', subject || '(no subject)');
    fd.append('body_html', bodyHtml);
    fd.append('body_text', bodyText);
    if (cc) fd.append('cc', cc);
    if (bcc) fd.append('bcc', bcc);
    if (this._draftId) fd.append('thread_id', this._draftId);

    for (const f of this._attachments) fd.append('attachments', f);

    const btn = el('compose-send-btn');
    btn.disabled = true;
    btn.querySelector('span:last-child').textContent = 'Sending...';

    try {
      await this.api.postForm('/api/emails', fd);
      this.toast.success('Email sent!');
      this.closeCompose();
    } catch (err) {
      this.toast.error('Failed to send: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.querySelector('span:last-child').textContent = 'Send';
    }
  }

  async saveDraft() {
    const bodyHtml = el('compose-editor').innerHTML;
    const bodyText = el('compose-editor').innerText;
    const draft = {
      to: this._composeRecipients.to,
      cc: this._composeRecipients.cc,
      bcc: this._composeRecipients.bcc,
      subject: el('compose-subject').value,
      body_html: bodyHtml,
      body_text: bodyText,
    };

    try {
      if (this._draftId) {
        await this.api.put(`/api/emails/${this._draftId}/draft`, draft);
      } else {
        const result = await this.api.post('/api/emails/draft', draft);
        this._draftId = result.id;
      }
      this.toast.success('Draft saved');
    } catch (err) {
      this.toast.error('Failed to save draft: ' + err.message);
    }
  }

  _replyToCurrentEmail() {
    const email = this.store.get('currentEmail');
    if (email) this.openCompose({ replyTo: email.id });
  }

  _replyAllToCurrentEmail() {
    const email = this.store.get('currentEmail');
    if (!email) return;
    this.openCompose({ replyTo: email.id });
    // Also add all To recipients
    (email.to_addrs || []).forEach(addr => {
      if (addr !== this.store.get('user')?.email) this._addTag('to', addr);
    });
  }

  _forwardCurrentEmail() {
    const email = this.store.get('currentEmail');
    if (email) this.openCompose({ forwardId: email.id });
  }

  // ── Tag Input (email address chips) ───────────────────────────────────────────
  _setupTagInput(field) {
    const wrap = el(`${field}-wrap`);
    const input = wrap.querySelector('.tag-input-inner');
    const ac = el(`${field}-autocomplete`);

    input.addEventListener('keydown', async e => {
      if ((e.key === 'Enter' || e.key === ',' || e.key === ';' || e.key === 'Tab') && input.value.trim()) {
        e.preventDefault();
        this._addTag(field, input.value.trim());
        input.value = '';
        if (ac) ac.style.display = 'none';
      } else if (e.key === 'Backspace' && !input.value) {
        const recipients = this._composeRecipients[field];
        if (recipients.length) {
          recipients.pop();
          this._renderTagInputs();
        }
      }
    });

    input.addEventListener('blur', () => {
      if (input.value.trim()) {
        this._addTag(field, input.value.trim());
        input.value = '';
      }
      setTimeout(() => { if (ac) ac.style.display = 'none'; }, 200);
    });

    if (field === 'to' && ac) {
      input.addEventListener('input', async e => {
        const q = e.target.value.trim();
        if (q.length < 2) { ac.style.display = 'none'; return; }
        try {
          const suggestions = await this.api.get(`/api/contacts/suggest?q=${encodeURIComponent(q)}`);
          if (suggestions.length) {
            ac.innerHTML = suggestions.map(s => `
              <div class="autocomplete-item" data-email="${escapeHtml(s.email)}">
                <span class="ac-name">${escapeHtml(s.name)}</span>
                <span class="ac-email">${escapeHtml(s.email)}</span>
              </div>`).join('');
            ac.style.display = '';
            ac.querySelectorAll('.autocomplete-item').forEach(item => {
              item.onclick = () => {
                this._addTag(field, item.dataset.email);
                input.value = '';
                ac.style.display = 'none';
              };
            });
          } else {
            ac.style.display = 'none';
          }
        } catch (_) { ac.style.display = 'none'; }
      });
    }
  }

  _addTag(field, email) {
    email = email.replace(/,|;/g, '').trim();
    if (!email) return;
    if (!this._composeRecipients[field].includes(email)) {
      this._composeRecipients[field].push(email);
    }
    this._renderTagInputs();
  }

  _renderTagInputs() {
    ['to', 'cc', 'bcc'].forEach(field => {
      const wrap = el(`${field}-wrap`);
      if (!wrap) return;
      const input = wrap.querySelector('.tag-input-inner');
      const tags = this._composeRecipients[field].map(email => `
        <div class="tag">
          <span>${escapeHtml(email)}</span>
          <span class="tag-remove" data-field="${field}" data-email="${escapeHtml(email)}">✕</span>
        </div>`).join('');

      wrap.innerHTML = tags + `<input type="text" class="tag-input-inner" id="${field}-input" placeholder="" autocomplete="off">`;
      wrap.querySelectorAll('.tag-remove').forEach(btn => {
        btn.onclick = () => {
          const f = btn.dataset.field;
          const e = btn.dataset.email;
          this._composeRecipients[f] = this._composeRecipients[f].filter(x => x !== e);
          this._renderTagInputs();
        };
      });
      const newInput = wrap.querySelector('.tag-input-inner');
      if (input && document.activeElement === input) newInput.focus();
      this._setupTagInput(field);
    });
  }

  _renderAttachments() {
    el('attach-preview').innerHTML = this._attachments.map((f, i) => `
      <div class="attach-chip">
        <span>📎 ${escapeHtml(f.name)} (${formatBytes(f.size)})</span>
        <span class="chip-remove" data-idx="${i}">✕</span>
      </div>`).join('');
    el('attach-preview').querySelectorAll('.chip-remove').forEach(btn => {
      btn.onclick = () => {
        this._attachments.splice(parseInt(btn.dataset.idx), 1);
        this._renderAttachments();
      };
    });
  }

  // ── Rich Text Editor ──────────────────────────────────────────────────────────
  _setupRTE() {
    const editor = el('compose-editor');

    // Format commands
    qsAll('[data-cmd]').forEach(btn => {
      btn.onclick = e => {
        e.preventDefault();
        const cmd = btn.dataset.cmd;
        document.execCommand(cmd, false, null);
        editor.focus();
        this._updateRTEState();
      };
    });

    // Heading selector
    el('rte-heading').onchange = e => {
      const tag = e.target.value;
      document.execCommand('formatBlock', false, tag);
      editor.focus();
    };

    // Update toolbar state on selection change
    editor.addEventListener('keyup', () => this._updateRTEState());
    editor.addEventListener('mouseup', () => this._updateRTEState());

    // Link insertion
    el('rte-link-btn').onclick = e => {
      e.preventDefault();
      const dialog = el('link-dialog');
      dialog.classList.toggle('show');
      if (dialog.classList.contains('show')) el('link-url-input').focus();
    };

    el('insert-link-btn').onclick = () => {
      const url = el('link-url-input').value.trim();
      if (url) {
        document.execCommand('createLink', false, url);
        editor.focus();
      }
      el('link-dialog').classList.remove('show');
      el('link-url-input').value = '';
    };

    el('cancel-link-btn').onclick = () => el('link-dialog').classList.remove('show');

    // Color picker
    const colors = ['#000000','#333333','#666666','#999999','#cccccc',
      '#ff0000','#ff6600','#ffcc00','#00cc00','#0066cc',
      '#6600cc','#cc00cc','#ff0066','#00cccc','#ffffff',
      '#667eea','#764ba2','#f093fb','#4facfe','#43e97b',
      '#fa709a','#fda085','#30cfd0','#a18cd1','#f5576c'];

    const picker = el('color-picker-popup');
    picker.innerHTML = colors.map(c =>
      `<div class="color-swatch" style="background:${c}" data-color="${c}"></div>`
    ).join('');

    picker.querySelectorAll('.color-swatch').forEach(sw => {
      sw.onclick = () => {
        document.execCommand('foreColor', false, sw.dataset.color);
        editor.focus();
        picker.classList.remove('show');
      };
    });

    el('rte-color-btn').onclick = e => {
      e.preventDefault();
      picker.classList.toggle('show');
    };

    // Tab key in editor
    editor.addEventListener('keydown', e => {
      if (e.key === 'Tab') {
        e.preventDefault();
        document.execCommand('insertHTML', false, '&nbsp;&nbsp;&nbsp;&nbsp;');
      }
    });
  }

  _updateRTEState() {
    const cmds = ['bold', 'italic', 'underline', 'strikeThrough', 'insertUnorderedList', 'insertOrderedList'];
    cmds.forEach(cmd => {
      const btn = qs(`[data-cmd="${cmd}"]`);
      if (btn) btn.classList.toggle('active', document.queryCommandState(cmd));
    });
  }

  // ── Keyboard Shortcuts ────────────────────────────────────────────────────────
  _handleKeydown(e) {
    const active = document.activeElement;
    const isTyping = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.contentEditable === 'true');
    if (isTyping && e.key !== 'Escape') return;

    // Two-key sequences (G+key)
    if (this._gKeyPressed && !e.ctrlKey && !e.metaKey) {
      clearTimeout(this._gKeyTimer);
      this._gKeyPressed = false;
      switch (e.key.toLowerCase()) {
        case 'i': this._switchFolder('INBOX'); return;
        case 's': this._switchFolder('Sent'); return;
        case 'd': this._switchFolder('Drafts'); return;
        case 'a': this._switchFolder('Archive'); return;
        case 't': this._switchFolder('Trash'); return;
      }
    }

    if (e.key === 'g' && !e.ctrlKey && !e.metaKey && !isTyping) {
      this._gKeyPressed = true;
      this._gKeyTimer = setTimeout(() => { this._gKeyPressed = false; }, 1000);
      return;
    }

    if (e.key === 'Escape') {
      if (el('compose-overlay').classList.contains('show')) { this.closeCompose(); return; }
      if (el('shortcuts-overlay').classList.contains('show')) { el('shortcuts-overlay').classList.remove('show'); return; }
      if (el('move-dialog-overlay').classList.contains('show')) { el('move-dialog-overlay').classList.remove('show'); return; }
      return;
    }

    if (!isTyping) {
      switch (e.key) {
        case 'c': this.openCompose(); break;
        case '/': e.preventDefault(); el('search-input').focus(); break;
        case '?': this._showShortcuts(); break;
        case 'e': case 'E':
          if (this.store.get('currentEmail')) this._archiveCurrentEmail();
          break;
        case '#':
          if (this.store.get('currentEmail')) this._deleteCurrentEmail();
          break;
        case 'r': case 'R':
          if (!e.shiftKey && this.store.get('currentEmail')) this._replyToCurrentEmail();
          else if (e.shiftKey) this.loadEmails();
          break;
        case 'f': case 'F':
          if (this.store.get('currentEmail')) this._forwardCurrentEmail();
          break;
        case 's': case 'S':
          if (this.store.get('currentEmail')) this._flagCurrentEmail();
          break;
        case 'i': case 'I':
          if (this.store.get('currentEmail')) {
            const em = this.store.get('currentEmail');
            this._markEmail(em.id, em.is_read ? 'unread' : 'read');
          }
          break;
      }
    }
  }

  _showShortcuts() {
    el('shortcuts-overlay').classList.add('show');
  }

  // ── Labels ────────────────────────────────────────────────────────────────────
  async _loadLabels() {
    try {
      const labels = await this.api.get('/api/labels');
      this.store.set('labels', labels);
      this._renderLabelsNav(labels);
    } catch (_) {}
  }

  _renderLabelsNav(labels) {
    el('labels-nav').innerHTML = labels.map(l => `
      <div class="nav-item" data-folder="label:${l.id}">
        <span class="label-dot" style="background:${l.color}"></span>
        <span class="nav-label">${escapeHtml(l.name)}</span>
      </div>`).join('');

    el('labels-nav').querySelectorAll('.nav-item').forEach(item => {
      item.onclick = () => {
        const labelId = item.dataset.folder.replace('label:', '');
        this.store.set('currentFolder', 'INBOX');
        qsAll('.nav-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        el('folder-title').textContent = item.querySelector('.nav-label').textContent;
        this._showEmailView();
        this._loadEmailsByLabel(labelId);
      };
    });
  }

  async _loadEmailsByLabel(labelId) {
    try {
      const data = await this.api.get(`/api/emails?label=${labelId}`);
      this.store.set('emails', data.emails);
      this._renderEmailList();
    } catch (err) {
      this.toast.error(err.message);
    }
  }

  async _loadUnreadCounts() {
    try {
      const data = await this.api.get('/api/emails/count');
      this.store.set('unreadCounts', data.unread || {});
      this._renderUnreadBadges(data.unread || {});
    } catch (_) {}
  }

  _renderUnreadBadges(counts) {
    const folders = { INBOX: 'inbox', Drafts: 'drafts', Spam: 'spam', Starred: 'starred' };
    for (const [folder, id] of Object.entries(folders)) {
      const badge = el(`badge-${id}`);
      if (!badge) continue;
      const count = counts[folder] || 0;
      badge.style.display = count > 0 ? '' : 'none';
      badge.textContent = count > 99 ? '99+' : count;
    }
  }

  async _loadStorageInfo() {
    try {
      const user = await this.api.get('/api/auth/me');
      this.store.set('user', user);
      const used = user.used_bytes || 0;
      const quota = user.quota_bytes || (1024 * 1024 * 1024);
      const pct = Math.min((used / quota) * 100, 100);
      el('storage-text').textContent = `${formatBytes(used)} / ${formatBytes(quota)}`;
      const fill = el('storage-fill');
      fill.style.width = pct + '%';
      fill.className = 'storage-fill' + (pct > 90 ? ' critical' : pct > 75 ? ' warning' : '');
    } catch (_) {}
  }

  // ── Settings ──────────────────────────────────────────────────────────────────
  async _loadSettings() {
    try {
      const settings = await this.api.get('/api/settings');
      el('settings-name').value = settings.display_name || '';
      el('settings-email').value = settings.email || '';
      el('settings-signature').value = settings.signature || '';
    } catch (err) {
      this.toast.error(err.message);
    }
    await this._loadLabelsSettings();
  }

  async _saveProfile() {
    const name = el('settings-name').value.trim();
    const sig = el('settings-signature').value;
    try {
      await this.api.put('/api/auth/profile', { display_name: name, signature: sig });
      this.toast.success('Profile saved');
      const user = await this.api.get('/api/auth/me');
      this.store.set('user', user);
      this._updateUserUI(user);
    } catch (err) {
      this.toast.error(err.message);
    }
  }

  async _changePassword() {
    const cur = el('current-password').value;
    const np = el('new-password').value;
    const cp = el('confirm-password').value;
    if (np !== cp) { this.toast.warning('New passwords do not match'); return; }
    try {
      await this.api.put('/api/auth/password', { current_password: cur, new_password: np });
      this.toast.success('Password updated');
      el('current-password').value = '';
      el('new-password').value = '';
      el('confirm-password').value = '';
    } catch (err) {
      this.toast.error(err.message);
    }
  }

  async _loadLabelsSettings() {
    await this._loadLabels();
    const labels = this.store.get('labels');
    el('labels-settings-list').innerHTML = labels.map(l => `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
        <span class="label-dot" style="background:${l.color};width:12px;height:12px;border-radius:50%;flex-shrink:0;"></span>
        <span style="flex:1;">${escapeHtml(l.name)}</span>
        <button class="icon-btn" onclick="app._deleteLabel('${l.id}')" title="Delete">🗑️</button>
      </div>`).join('');
  }

  async _createLabel() {
    const name = el('new-label-name').value.trim();
    const color = el('new-label-color').value;
    if (!name) return;
    try {
      await this.api.post('/api/labels', { name, color });
      el('new-label-name').value = '';
      this.toast.success('Label created');
      this._loadLabelsSettings();
    } catch (err) {
      this.toast.error(err.message);
    }
  }

  async _deleteLabel(id) {
    try {
      await this.api.del(`/api/labels/${id}`);
      this.toast.success('Label deleted');
      this._loadLabelsSettings();
    } catch (err) {
      this.toast.error(err.message);
    }
  }

  // ── Admin Panel ───────────────────────────────────────────────────────────────
  async _loadAdminPanel() {
    try {
      const [stats, users] = await Promise.all([
        this.api.get('/api/admin/stats'),
        this.api.get('/api/admin/users'),
      ]);
      this._renderAdminStats(stats);
      this._renderAdminUsers(users);
    } catch (err) {
      this.toast.error('Failed to load admin data: ' + err.message);
    }
  }

  _renderAdminStats(stats) {
    el('admin-stats-grid').innerHTML = [
      { icon: '👥', value: stats.total_users, label: 'Total Users' },
      { icon: '✅', value: stats.active_users, label: 'Active Users' },
      { icon: '📧', value: stats.total_emails?.toLocaleString(), label: 'Total Emails' },
      { icon: '💾', value: formatBytes(stats.total_storage_bytes), label: 'Storage Used' },
    ].map(s => `
      <div class="stat-card">
        <div class="stat-icon">${s.icon}</div>
        <div class="stat-value">${s.value || 0}</div>
        <div class="stat-label">${s.label}</div>
      </div>`).join('');
  }

  _renderAdminUsers(users) {
    el('admin-users-tbody').innerHTML = users.map(u => `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:8px;">
            <div style="width:32px;height:32px;border-radius:50%;background:${u.avatar_color || '#667eea'};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:12px;">
              ${getInitials(u.display_name)}
            </div>
            <span>${escapeHtml(u.display_name)}</span>
          </div>
        </td>
        <td>${escapeHtml(u.email)}</td>
        <td><span class="badge ${u.is_admin ? 'badge-primary' : 'badge-info'}">${u.is_admin ? '🛡️ Admin' : '👤 User'}</span></td>
        <td><span class="badge ${u.is_active ? 'badge-success' : 'badge-error'}">${u.is_active ? 'Active' : 'Disabled'}</span></td>
        <td>${formatBytes(u.used_bytes)} / ${formatBytes(u.quota_bytes)}</td>
        <td>${u.last_login ? formatDate(u.last_login) : 'Never'}</td>
        <td>
          <div style="display:flex;gap:4px;">
            <button class="icon-btn" onclick="app._toggleUserActive('${u.id}', ${!u.is_active})" title="${u.is_active ? 'Disable' : 'Enable'}">${u.is_active ? '🚫' : '✅'}</button>
            <button class="icon-btn" onclick="app._resetUserPassword('${u.id}')" title="Reset Password">🔑</button>
            <button class="icon-btn" onclick="app._deleteUser('${u.id}')" title="Delete User">🗑️</button>
          </div>
        </td>
      </tr>`).join('') || '<tr><td colspan="7" style="text-align:center;color:var(--muted);">No users found</td></tr>';
  }

  _showAddUserDialog() {
    el('new-user-name').value = '';
    el('new-user-email').value = '';
    el('new-user-password').value = '';
    el('new-user-admin').checked = false;
    el('add-user-overlay').classList.add('show');
    setTimeout(() => el('new-user-name').focus(), 100);
  }

  async _createUser() {
    const name = el('new-user-name').value.trim();
    const email = el('new-user-email').value.trim();
    const password = el('new-user-password').value;
    const isAdmin = el('new-user-admin').checked;
    if (!name || !email || !password) { this.toast.warning('All fields required'); return; }
    try {
      await this.api.post('/api/admin/users', { display_name: name, email, password, is_admin: isAdmin });
      this.toast.success('User created');
      el('add-user-overlay').classList.remove('show');
      this._loadAdminPanel();
    } catch (err) {
      this.toast.error(err.message);
    }
  }

  async _toggleUserActive(userId, active) {
    try {
      await this.api.put(`/api/admin/users/${userId}`, { is_active: active });
      this.toast.success(`User ${active ? 'enabled' : 'disabled'}`);
      this._loadAdminPanel();
    } catch (err) {
      this.toast.error(err.message);
    }
  }

  async _resetUserPassword(userId) {
    try {
      const result = await this.api.post(`/api/admin/users/${userId}/reset-password`);
      this.toast.success(`New password: ${result.new_password}`, undefined, 10000);
    } catch (err) {
      this.toast.error(err.message);
    }
  }

  async _deleteUser(userId) {
    const user = this.store.get('user');
    if (userId === user?.id) { this.toast.warning('Cannot delete yourself'); return; }
    if (!confirm('Delete this user and all their data? This cannot be undone.')) return;
    try {
      await this.api.del(`/api/admin/users/${userId}`);
      this.toast.success('User deleted');
      this._loadAdminPanel();
    } catch (err) {
      this.toast.error(err.message);
    }
  }

  // ── Contacts ──────────────────────────────────────────────────────────────────
  async _loadContacts(search = '') {
    try {
      const url = search ? `/api/contacts?search=${encodeURIComponent(search)}` : '/api/contacts';
      const contacts = await this.api.get(url);
      this.store.set('contacts', contacts);
      this._renderContacts(contacts);
    } catch (err) {
      this.toast.error(err.message);
    }
  }

  _renderContacts(contacts) {
    el('contacts-tbody').innerHTML = contacts.map(c => `
      <tr>
        <td>${escapeHtml(c.name)}</td>
        <td><a href="#" onclick="app._composeToContact('${escapeHtml(c.email)}')">${escapeHtml(c.email)}</a></td>
        <td>${escapeHtml(c.phone || '—')}</td>
        <td>
          <div style="display:flex;gap:4px;">
            <button class="icon-btn" onclick="app._editContact('${c.id}')" title="Edit">✏️</button>
            <button class="icon-btn" onclick="app._deleteContact('${c.id}')" title="Delete">🗑️</button>
          </div>
        </td>
      </tr>`).join('') || '<tr><td colspan="4" style="text-align:center;color:var(--muted);">No contacts yet</td></tr>';
  }

  _searchContacts(query) {
    clearTimeout(this._contactsSearchTimer);
    this._contactsSearchTimer = setTimeout(() => this._loadContacts(query), 300);
  }

  _composeToContact(email) {
    this.openCompose();
    this._addTag('to', email);
    this._renderTagInputs();
  }

  _showAddContactDialog(contact = null) {
    el('contact-dialog-title').textContent = contact ? 'Edit Contact' : 'Add Contact';
    el('contact-name').value = contact?.name || '';
    el('contact-email').value = contact?.email || '';
    el('contact-phone').value = contact?.phone || '';
    el('contact-notes').value = contact?.notes || '';
    this._editingContactId = contact?.id || null;
    el('add-contact-overlay').classList.add('show');
    setTimeout(() => el('contact-name').focus(), 100);
  }

  _editContact(id) {
    const contacts = this.store.get('contacts');
    const contact = contacts.find(c => c.id === id);
    if (contact) this._showAddContactDialog(contact);
  }

  async _saveContact() {
    const name = el('contact-name').value.trim();
    const email = el('contact-email').value.trim();
    const phone = el('contact-phone').value.trim();
    const notes = el('contact-notes').value.trim();
    if (!name || !email) { this.toast.warning('Name and email are required'); return; }
    try {
      if (this._editingContactId) {
        await this.api.put(`/api/contacts/${this._editingContactId}`, { name, email, phone, notes });
        this.toast.success('Contact updated');
      } else {
        await this.api.post('/api/contacts', { name, email, phone, notes });
        this.toast.success('Contact added');
      }
      el('add-contact-overlay').classList.remove('show');
      this._loadContacts();
    } catch (err) {
      this.toast.error(err.message);
    }
  }

  async _deleteContact(id) {
    if (!confirm('Delete this contact?')) return;
    try {
      await this.api.del(`/api/contacts/${id}`);
      this.toast.success('Contact deleted');
      this._loadContacts();
    } catch (err) {
      this.toast.error(err.message);
    }
  }

  // ── Drag and Drop ─────────────────────────────────────────────────────────────
  _setupDragAndDrop() {
    const emailList = el('email-list');

    emailList.addEventListener('dragstart', e => {
      const item = e.target.closest('.email-item');
      if (!item) return;
      e.dataTransfer.setData('text/plain', item.dataset.emailId);
      e.dataTransfer.effectAllowed = 'move';
      item.style.opacity = '0.5';
    });

    emailList.addEventListener('dragend', e => {
      const item = e.target.closest('.email-item');
      if (item) item.style.opacity = '';
    });

    qsAll('.nav-item[data-folder]').forEach(navItem => {
      navItem.addEventListener('dragover', e => {
        e.preventDefault();
        navItem.classList.add('drag-over');
        navItem.style.background = 'var(--sidebar-active)';
      });
      navItem.addEventListener('dragleave', () => {
        navItem.classList.remove('drag-over');
        navItem.style.background = '';
      });
      navItem.addEventListener('drop', e => {
        e.preventDefault();
        navItem.classList.remove('drag-over');
        navItem.style.background = '';
        const emailId = e.dataTransfer.getData('text/plain');
        const folder = navItem.dataset.folder;
        if (emailId && folder) this._moveEmail(emailId, folder);
      });
    });
  }

  // ── Logout ────────────────────────────────────────────────────────────────────
  async logout() {
    try {
      if (this.api.refreshToken) {
        await this.api.post('/api/auth/logout', { refresh_token: this.api.refreshToken });
      }
    } catch (_) {}
    this.ws.disconnect();
    this.api.clearTokens();
    location.reload();
  }
}

// ── Bootstrap ──────────────────────────────────────────────────────────────────
const app = new MailApp();
document.addEventListener('DOMContentLoaded', () => app.init());

// Expose for inline event handlers
window.app = app;
window.el = el;
