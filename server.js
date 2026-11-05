require("dotenv").config();
const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const helmet = require("helmet");
const cloudinary = require("cloudinary").v2;
const path = require("path");
const fs = require("fs/promises");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "data.json");
let store = { nextId: 1, collections: {} };
const allowedCollections = new Set([
  "diary", "wishlist", "memories", "my-photos", "letters", "reasons",
  "dates", "happiness", "timeline", "daily-messages"
]);

async function loadStore() {
  try {
    store = JSON.parse(await fs.readFile(DATA_FILE, "utf8"));
    if (!store || typeof store !== "object") throw new Error("Invalid data file");
    store.nextId ||= 1;
    store.collections ||= {};
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
    await saveStore();
  }
}
async function saveStore() {
  const temp = DATA_FILE + ".tmp";
  await fs.writeFile(temp, JSON.stringify(store, null, 2), "utf8");
  await fs.rename(temp, DATA_FILE);
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "1mb" }));
app.use(session({
  secret: process.env.SESSION_SECRET || "development-only-change-this-secret",
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 1000 * 60 * 60 * 24 * 14 }
}));

function requireSite(req, res, next) { return next(); }
function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.status(403).json({ error: "Admin access required." });
}
function cleanCollection(value) { return allowedCollections.has(value) ? value : null; }

app.get("/api/health", (req, res) => res.json({ ok: true, service: "A Little Universe Called Us" }));
app.post("/api/login", (req, res) => {
  const { password } = req.body || {};
  if (!process.env.SITE_PASSWORD) return res.status(503).json({ error: "SITE_PASSWORD is not configured." });
  if (typeof password !== "string" || password.length > 200) return res.status(400).json({ error: "Enter the passphrase." });
  if (password !== process.env.SITE_PASSWORD) return res.status(401).json({ error: "That isn't the right little secret. Try again." });
  req.session.siteAccess = true; res.json({ ok: true });
});
app.post("/api/admin/unlock", requireSite, (req, res) => {
  req.session.isAdmin = true;
  res.json({ ok: true });
});
app.get("/api/session", (req, res) => res.json({ unlocked: !!req.session.siteAccess, admin: !!req.session.isAdmin }));
app.post("/api/logout", (req, res) => req.session.destroy(() => res.json({ ok: true })));

app.get("/api/data/:collection", requireSite, (req, res) => {
  const c = cleanCollection(req.params.collection);
  if (!c) return res.status(404).json({ error: "Collection not found." });
  res.json(store.collections[c] || []);
});
app.post("/api/data/:collection", requireSite, async (req, res, next) => {
  try {
    const c = cleanCollection(req.params.collection), data = req.body;
    if (!c) return res.status(404).json({ error: "Collection not found." });
    if (!data || typeof data !== "object" || Array.isArray(data)) return res.status(400).json({ error: "Invalid entry." });
    if (JSON.stringify(data).length > 50000) return res.status(413).json({ error: "Entry is too large." });
    const row = { id: store.nextId++, ...data, createdAt: new Date().toISOString() };
    (store.collections[c] ||= []).unshift(row); await saveStore(); res.status(201).json(row);
  } catch (e) { next(e); }
});
app.put("/api/data/:collection/:id", requireSite, async (req, res, next) => {
  try {
    const c = cleanCollection(req.params.collection), data = req.body;
    if (!c) return res.status(404).json({ error: "Collection not found." });
    if (!data || typeof data !== "object" || Array.isArray(data) || JSON.stringify(data).length > 50000)
      return res.status(400).json({ error: "Invalid entry." });
    const rows = store.collections[c] || [], i = rows.findIndex(x => String(x.id) === req.params.id);
    if (i < 0) return res.status(404).json({ error: "Entry not found." });
    rows[i] = { ...rows[i], ...data, id: rows[i].id, updatedAt: new Date().toISOString() };
    await saveStore(); res.json(rows[i]);
  } catch (e) { next(e); }
});
app.delete("/api/data/:collection/:id", requireSite, async (req, res, next) => {
  try {
    const c = cleanCollection(req.params.collection);
    if (!c) return res.status(404).json({ error: "Collection not found." });
    const rows = store.collections[c] || [], i = rows.findIndex(x => String(x.id) === req.params.id);
    if (i < 0) return res.status(404).json({ error: "Entry not found." });
    rows.splice(i, 1); await saveStore(); res.json({ ok: true });
  } catch (e) { next(e); }
});
app.post("/api/upload", requireSite, requireAdmin, (req, res) => {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET)
    return res.status(503).json({ error: "Persistent photo storage is not configured. Add Cloudinary credentials." });
  const timestamp = Math.floor(Date.now() / 1000), folder = "little-universe";
  const signature = cloudinary.utils.api_sign_request({ timestamp, folder }, process.env.CLOUDINARY_API_SECRET);
  res.json({ cloudName: process.env.CLOUDINARY_CLOUD_NAME, apiKey: process.env.CLOUDINARY_API_KEY, timestamp, folder, signature });
});

app.use(express.static(path.join(__dirname, "public")));
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: "Something went wrong. Please try again in a moment." }); });

loadStore().then(() => app.listen(PORT, () => console.log(`A Little Universe is listening on ${PORT}`)))
  .catch(err => { console.error("Data initialization failed:", err); process.exit(1); });
