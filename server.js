require('dotenv').config();
const express = require('express');
const session = require('express-session');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Directories ──────────────────────────────────────────────────────────────
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// ── Multer (file uploads) ─────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOADS_DIR),
  filename: (_, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const name = `${Date.now()}-${safe}`;
    cb(null, name);
  },
});

const ALLOWED = /\.(jpe?g|png|gif|webp|avif|svg|mp4|webm|mov|avi|mkv|pdf)$/i;

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
  fileFilter: (_, file, cb) => {
    if (ALLOWED.test(path.extname(file.originalname))) cb(null, true);
    else cb(new Error('Unsupported file type'), false);
  },
});

// ── Session ───────────────────────────────────────────────────────────────────
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'change-me',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 8 * 60 * 60 * 1000 }, // 8 h
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Static files ──────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// Stream video with HTTP range support (enables seeking in <video> elements)
app.get('/uploads/:filename', (req, res) => {
  const safe     = path.basename(req.params.filename);
  const filePath = path.join(UPLOADS_DIR, safe);

  if (!fs.existsSync(filePath)) return res.status(404).send('Not found');

  const stat = fs.statSync(filePath);
  const ext  = path.extname(safe).toLowerCase();
  const isVideo = /\.(mp4|webm|mov|avi|mkv)$/.test(ext);

  if (!isVideo) {
    // Serve images directly
    return res.sendFile(filePath);
  }

  // Video streaming with range support
  const fileSize = stat.size;
  const range    = req.headers.range;

  const MIME = { '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
                 '.avi': 'video/x-msvideo', '.mkv': 'video/x-matroska' };
  const contentType = MIME[ext] || 'video/mp4';

  if (range) {
    const parts  = range.replace(/bytes=/, '').split('-');
    const start  = parseInt(parts[0], 10);
    const end    = parts[1] ? parseInt(parts[1], 10) : Math.min(start + 10 * 1024 * 1024, fileSize - 1);
    const chunkSize = end - start + 1;

    res.writeHead(206, {
      'Content-Range':  `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges':  'bytes',
      'Content-Length': chunkSize,
      'Content-Type':   contentType,
    });
    fs.createReadStream(filePath, { start, end }).pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type':   contentType,
      'Accept-Ranges':  'bytes',
    });
    fs.createReadStream(filePath).pipe(res);
  }
});

// ── Auth middleware ───────────────────────────────────────────────────────────
const requireAuth = (req, res, next) =>
  req.session.admin ? next() : res.status(401).json({ error: 'Unauthorized' });

// ── Hashed admin password (generated once at startup) ────────────────────────
const ADMIN_HASH = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'changeme123', 10);

// ── Auth routes ───────────────────────────────────────────────────────────────
app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (bcrypt.compareSync(password, ADMIN_HASH)) {
    req.session.admin = true;
    res.json({ ok: true });
  } else {
    res.status(401).json({ error: 'Wrong password' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

app.get('/api/auth-status', (req, res) => {
  res.json({ admin: !!req.session.admin });
});

// ── Media routes ──────────────────────────────────────────────────────────────

// List all media files
app.get('/api/media', (_, res) => {
  const files = fs.readdirSync(UPLOADS_DIR).map((name) => {
    const stat = fs.statSync(path.join(UPLOADS_DIR, name));
    const ext  = path.extname(name).toLowerCase();
    const isVideo = /\.(mp4|webm|mov|avi|mkv)$/.test(ext);
    return {
      name,
      url:   `/uploads/${name}`,
      size:  stat.size,
      type:  isVideo ? 'video' : 'image',
      mtime: stat.mtimeMs,
    };
  });
  // Newest first
  files.sort((a, b) => b.mtime - a.mtime);
  res.json(files);
});

// Upload (admin only)
app.post('/api/media', requireAuth, upload.array('files', 50), (req, res) => {
  if (!req.files || req.files.length === 0)
    return res.status(400).json({ error: 'No files uploaded' });
  const uploaded = req.files.map((f) => ({
    name: f.filename,
    url: `/uploads/${f.filename}`,
  }));
  res.json({ ok: true, files: uploaded });
});

// Delete (admin only)
app.delete('/api/media/:filename', requireAuth, (req, res) => {
  const safe = path.basename(req.params.filename);
  const filePath = path.join(UPLOADS_DIR, safe);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' });
  fs.unlinkSync(filePath);
  res.json({ ok: true });
});

// ── SPA fallback ──────────────────────────────────────────────────────────────
app.get('/admin', (_, res) =>
  res.sendFile(path.join(__dirname, 'public', 'admin.html'))
);
app.get('*', (_, res) =>
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
);

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () =>
  console.log(`Portfolio running → http://localhost:${PORT}`)
);
