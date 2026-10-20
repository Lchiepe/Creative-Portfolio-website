/* admin.js – password-protected admin panel */
(async () => {
  // ── Elements ────────────────────────────────────────────────────────────────
  const loginScreen  = document.getElementById('login-screen');
  const adminPanel   = document.getElementById('admin-panel');
  const loginForm    = document.getElementById('login-form');
  const pwInput      = document.getElementById('pw-input');
  const loginError   = document.getElementById('login-error');
  const logoutBtn    = document.getElementById('logout-btn');

  const dropZone     = document.getElementById('drop-zone');
  const fileInput    = document.getElementById('file-input');
  const uploadQueue  = document.getElementById('upload-queue');
  const uploadBtn    = document.getElementById('upload-btn');
  const uploadCount  = document.getElementById('upload-count');

  const adminGallery = document.getElementById('admin-gallery');
  const adminStats   = document.getElementById('admin-stats');
  const toast        = document.getElementById('toast');

  let queuedFiles = [];

  // ── Toast ────────────────────────────────────────────────────────────────────
  let toastTimer;
  function showToast(msg, type = '') {
    toast.textContent = msg;
    toast.className   = `toast show ${type}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
  }

  // ── Check auth status ────────────────────────────────────────────────────────
  async function checkAuth() {
    const res  = await fetch('/api/auth-status');
    const data = await res.json();
    if (data.admin) showAdminPanel();
    else            showLoginScreen();
  }

  function showLoginScreen() {
    loginScreen.style.display = 'flex';
    adminPanel.style.display  = 'none';
    logoutBtn.style.display   = 'none';
  }

  function showAdminPanel() {
    loginScreen.style.display = 'none';
    adminPanel.style.display  = 'block';
    logoutBtn.style.display   = 'inline-block';
    loadMedia();
  }

  // ── Login ────────────────────────────────────────────────────────────────────
  loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    loginError.textContent = '';
    const res  = await fetch('/api/login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ password: pwInput.value }),
    });
    const data = await res.json();
    if (data.ok) {
      showAdminPanel();
    } else {
      loginError.textContent = 'Incorrect password.';
      pwInput.value = '';
      pwInput.focus();
    }
  });

  // ── Logout ───────────────────────────────────────────────────────────────────
  logoutBtn.addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST' });
    showLoginScreen();
  });

  // ── Drop zone ────────────────────────────────────────────────────────────────
  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') fileInput.click(); });

  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragging'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragging'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('dragging');
    addFiles([...e.dataTransfer.files]);
  });

  fileInput.addEventListener('change', () => {
    addFiles([...fileInput.files]);
    fileInput.value = '';
  });

  function addFiles(files) {
    files.forEach(f => {
      // Avoid duplicates by name+size
      if (!queuedFiles.some(q => q.name === f.name && q.size === f.size)) {
        queuedFiles.push(f);
      }
    });
    renderQueue();
  }

  function renderQueue() {
    uploadQueue.innerHTML = '';
    queuedFiles.forEach((f, i) => {
      const chip = document.createElement('span');
      chip.className = 'queue-chip';
      chip.innerHTML = `${truncate(f.name, 28)} <span class="rm" data-i="${i}">✕</span>`;
      uploadQueue.appendChild(chip);
    });

    uploadQueue.querySelectorAll('.rm').forEach(btn =>
      btn.addEventListener('click', () => {
        queuedFiles.splice(Number(btn.dataset.i), 1);
        renderQueue();
      })
    );

    if (queuedFiles.length > 0) {
      uploadBtn.style.display  = 'inline-flex';
      uploadCount.textContent  = queuedFiles.length;
    } else {
      uploadBtn.style.display  = 'none';
    }
  }

  // ── Upload ───────────────────────────────────────────────────────────────────
  uploadBtn.addEventListener('click', async () => {
    if (queuedFiles.length === 0) return;
    uploadBtn.textContent = 'Uploading…';
    uploadBtn.disabled    = true;

    const fd = new FormData();
    queuedFiles.forEach(f => fd.append('files', f));

    try {
      const res  = await fetch('/api/media', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.ok) {
        showToast(`✓ Uploaded ${data.files.length} file(s)`, 'success');
        queuedFiles = [];
        renderQueue();
        loadMedia();
      } else {
        showToast(data.error || 'Upload failed', 'error');
      }
    } catch {
      showToast('Upload failed — server error', 'error');
    }

    uploadBtn.textContent = `Upload`;
    uploadBtn.disabled    = false;
  });

  // ── Load & render media ──────────────────────────────────────────────────────
  async function loadMedia() {
    adminGallery.innerHTML = '<p style="color:var(--muted);font-size:.85rem;grid-column:1/-1;padding:2rem 0">Loading…</p>';
    const res   = await fetch('/api/media');
    const files = await res.json();

    const totalMB = (files.reduce((a, f) => a + f.size, 0) / 1048576).toFixed(1);
    adminStats.textContent = `${files.length} file${files.length !== 1 ? 's' : ''} · ${totalMB} MB`;

    adminGallery.innerHTML = '';

    if (files.length === 0) {
      adminGallery.innerHTML = '<p style="color:var(--muted);font-size:.85rem;grid-column:1/-1;padding:2rem 0">No files yet. Upload some above.</p>';
      return;
    }

    files.forEach(media => {
      const card = document.createElement('div');
      card.className = 'admin-card';

      const thumb = media.type === 'video'
        ? `<video class="thumb-video" src="${media.url}" muted preload="metadata"></video>`
        : `<img class="thumb" src="${media.url}" alt="${media.name}" loading="lazy" />`;

      card.innerHTML = `
        ${thumb}
        <div class="card-info">
          <span class="card-name" title="${media.name}">${friendlyName(media.name)}</span>
          <button class="btn-danger" data-name="${media.name}">Delete</button>
        </div>`;

      card.querySelector('.btn-danger').addEventListener('click', () => deleteMedia(media.name, card));
      adminGallery.appendChild(card);
    });
  }

  // ── Delete ───────────────────────────────────────────────────────────────────
  async function deleteMedia(filename, card) {
    if (!confirm(`Delete "${friendlyName(filename)}"?`)) return;
    const res = await fetch(`/api/media/${encodeURIComponent(filename)}`, { method: 'DELETE' });
    if (res.ok) {
      card.style.opacity = '0';
      card.style.transition = 'opacity .3s';
      setTimeout(() => { card.remove(); loadMedia(); }, 300);
      showToast('Deleted', 'success');
    } else {
      showToast('Delete failed', 'error');
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────
  function friendlyName(raw) {
    return raw.replace(/^\d{13}-/, '').replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ');
  }
  function truncate(str, n) {
    return str.length > n ? str.slice(0, n - 1) + '…' : str;
  }

  // ── Init ─────────────────────────────────────────────────────────────────────
  checkAuth();
})();
