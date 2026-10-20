/* gallery.js – public portfolio page (Chief x Creative) */
(async () => {
  const gallery         = document.getElementById('gallery');
  const emptyMsg        = document.getElementById('gallery-empty');
  const filterBtns      = document.querySelectorAll('.filter-btn');
  const categoryFilters = document.getElementById('category-filters');
  const lightbox        = document.getElementById('lightbox');
  const lbContent       = document.getElementById('lb-content');
  const lbCaption       = document.getElementById('lb-caption');
  const lbClose         = document.getElementById('lb-close');
  const lbPrev          = document.getElementById('lb-prev');
  const lbNext          = document.getElementById('lb-next');
  document.getElementById('year').textContent = new Date().getFullYear();

  let allMedia     = [];
  let filtered     = [];
  let lbIndex      = 0;
  let activeType   = 'all';
  let activeCat    = 'all';

  // ── Category keywords ────────────────────────────────────────────────────────
  const CATEGORIES = [
    { id: 'events',  label: 'Events & Nightlife', keywords: ['event','party','nightclub','crowd','raft','celebration','nightlife','disco'] },
    { id: 'dance',   label: 'Dance',               keywords: ['dance','dancing','dancer','dancefloor','moving','bokeh-feet','vhs-style-women'] },
    { id: 'film',    label: 'Film & Edits',        keywords: ['film','vhs','editorial','title','glitch','logo','intro','outro','qbfa','hyve','find-your-look'] },
    { id: 'portrait',label: 'Portraits',           keywords: ['portrait','person','face','people','selfie','model','headshot','trinidad'] },
    { id: 'art',     label: 'Art & Design',        keywords: ['art','design','graphic','abstract','studio'] },
    { id: 'street',  label: 'Street',              keywords: ['street','city','urban','canada','autumn','drive','cityscape'] },
  ];

  function detectCategory(media) {
    if (media.type === 'video') return 'video';
    const name = media.name.toLowerCase();
    for (const cat of CATEGORIES) {
      if (cat.keywords.some(kw => name.includes(kw))) return cat.id;
    }
    return 'other';
  }

  // ── Fetch media ─────────────────────────────────────────────────────────────
  async function fetchMedia() {
    try {
      const res  = await fetch('/api/media');
      const raw  = await res.json();
      allMedia   = raw.map(m => ({ ...m, category: detectCategory(m) }));
      buildCategoryFilters();
      applyFilters();
    } catch {
      gallery.innerHTML = '<p style="text-align:center;color:#888;padding:4rem">Could not load media.</p>';
    }
  }

  // ── Build dynamic category filter buttons ────────────────────────────────────
  function buildCategoryFilters() {
    const usedCats = [...new Set(allMedia.map(m => m.category))];
    categoryFilters.innerHTML = '';
    usedCats.forEach(catId => {
      const def = CATEGORIES.find(c => c.id === catId);
      const label = def ? def.label : (catId.charAt(0).toUpperCase() + catId.slice(1));
      const btn = document.createElement('button');
      btn.className = 'filter-btn cat-btn';
      btn.dataset.cat = catId;
      btn.textContent = label;
      btn.addEventListener('click', () => {
        document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        filterBtns.forEach(b => b.classList.remove('active'));
        activeCat = catId;
        activeType = 'all';
        applyFilters();
      });
      categoryFilters.appendChild(btn);
    });
  }

  // ── Type filters (All / Photos / Videos) ─────────────────────────────────────
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeType = btn.dataset.filter;
      activeCat  = 'all';
      applyFilters();
    });
  });

  // ── Apply filters ────────────────────────────────────────────────────────────
  function applyFilters() {
    filtered = allMedia.filter(m => {
      const typeOk = activeType === 'all' || m.type === activeType;
      const catOk  = activeCat  === 'all' || m.category === activeCat;
      return typeOk && catOk;
    });
    renderGallery();
  }

  // ── Render gallery ───────────────────────────────────────────────────────────
  function renderGallery() {
    [...gallery.querySelectorAll('.gallery-item')].forEach(el => el.remove());

    if (filtered.length === 0) {
      emptyMsg.style.display = 'block';
      return;
    }
    emptyMsg.style.display = 'none';

    filtered.forEach((media, i) => {
      const item    = document.createElement('div');
      item.className = 'gallery-item';
      item.dataset.index = i;

      const overlay = `<div class="overlay"><span class="overlay-label">${friendlyName(media.name)}</span></div>`;

      if (media.type === 'video') {
        item.innerHTML = `
          <video src="${media.url}" muted preload="metadata" playsinline loop></video>
          <span class="video-badge">▶ Video</span>
          ${overlay}`;
        const vid = item.querySelector('video');
        item.addEventListener('mouseenter', () => vid.play().catch(() => {}));
        item.addEventListener('mouseleave', () => { vid.pause(); vid.currentTime = 0; });
      } else {
        item.innerHTML = `<img src="${media.url}" alt="${friendlyName(media.name)}" loading="lazy" />${overlay}`;
      }

      item.addEventListener('click', () => openLightbox(i));
      gallery.appendChild(item);
    });
  }

  // ── Lightbox ─────────────────────────────────────────────────────────────────
  function openLightbox(index) {
    lbIndex = index;
    renderLightbox();
    lightbox.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    lightbox.classList.remove('open');
    document.body.style.overflow = '';
    const vid = lbContent.querySelector('video');
    if (vid) vid.pause();
  }

  function renderLightbox() {
    const media = filtered[lbIndex];
    if (!media) return;
    if (media.type === 'video') {
      lbContent.innerHTML = `<video src="${media.url}" controls autoplay></video>`;
    } else {
      lbContent.innerHTML = `<img src="${media.url}" alt="${friendlyName(media.name)}" />`;
    }
    lbCaption.textContent = friendlyName(media.name);
    lbPrev.style.visibility = lbIndex > 0                  ? 'visible' : 'hidden';
    lbNext.style.visibility = lbIndex < filtered.length - 1 ? 'visible' : 'hidden';
  }

  lbClose.addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });
  lbPrev.addEventListener('click', () => { if (lbIndex > 0) { lbIndex--; renderLightbox(); } });
  lbNext.addEventListener('click', () => { if (lbIndex < filtered.length - 1) { lbIndex++; renderLightbox(); } });

  document.addEventListener('keydown', e => {
    if (!lightbox.classList.contains('open')) return;
    if (e.key === 'Escape')     closeLightbox();
    if (e.key === 'ArrowLeft')  { if (lbIndex > 0) { lbIndex--; renderLightbox(); } }
    if (e.key === 'ArrowRight') { if (lbIndex < filtered.length - 1) { lbIndex++; renderLightbox(); } }
  });

  // ── Helpers ──────────────────────────────────────────────────────────────────
  function friendlyName(raw) {
    return raw.replace(/^\d{13}-/, '').replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ');
  }

  fetchMedia();
})();
