import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Profile, Summary } from '../shared/types';

const here = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(here, 'data.json');
type Stored = Profile & { key: string };
// One class for everybody. `gone` remembers deleted accounts so no device brings them back.
let db: { profiles: Record<string, Stored>; gone: string[] } = { profiles: {}, gone: [] };
try { if (existsSync(FILE)) db = { ...db, ...JSON.parse(readFileSync(FILE, 'utf8')) }; } catch {}
if (!db.profiles || typeof db.profiles !== 'object') db = { profiles: {}, gone: [] };

let timer: any;
const persist = () => { clearTimeout(timer); timer = setTimeout(() => { try { writeFileSync(FILE, JSON.stringify(db)); } catch {} }, 1000); };
const sum = ({ key, posts, ...p }: Stored): Summary => ({ ...p, n: posts.length });
const summaries = (): Summary[] => Object.values(db.profiles).map(sum).sort((a, b) => b.updated - a.updated);

const str = (v: any, n: number) => String(v ?? '').slice(0, n);
const im = (v: any, max: number) => (typeof v === 'string' && v.startsWith('data:image/jpeg;base64,') && v.length < max ? v : '');
const norm = (v: any) => str(v, 60).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ς/g, 'σ');
const clean = (p: any, id: string): Profile => ({
  id, username: str(p.username, 30).toLowerCase().replace(/[^a-z0-9._]/g, ''), name: str(p.name, 40).trim(), bio: str(p.bio, 150),
  avatar: im(p.avatar, 30000),
  posts: (Array.isArray(p.posts) ? p.posts : []).slice(0, 12)
    .map((x: any) => ({ id: str(x?.id, 40), img: im(x?.img, 100000), cap: str(x?.cap, 300), t: Math.floor(+x?.t || Date.now()) }))
    .filter((x: any) => x.id && x.img),
  updated: Date.now(),
});

const app = express();
const http = createServer(app);
const io = new Server(http, { maxHttpBufferSize: 3e6 });
const dist = path.join(here, '../client/dist');
app.use(express.static(dist));
app.get('*', (_q, r) => r.sendFile(path.join(dist, 'index.html')));

io.on('connection', (s) => {
  s.on('hello', (ack: (l: Summary[]) => void) => ack?.(summaries()));

  // Full profile (with photos) of one classmate, loaded only when opened.
  s.on('get', (id: string, ack: (p: Profile | null) => void) => {
    const o = db.profiles[str(id, 64)];
    if (!o) return ack?.(null);
    const { key, ...p } = o;
    ack?.(p);
  });

  // Sign in by name (or username). Several matches: the app asks which one is theirs.
  s.on('login', (p: any, ack: (r: any) => void) => {
    const all = Object.values(db.profiles), id = str(p?.id, 64), q = norm(p?.q);
    const m = id ? all.filter((o) => o.id === id) : q ? all.filter((o) => norm(o.name) === q || o.username === q) : [];
    if (!m.length) return ack?.({ ok: false, r: 'none' });
    if (m.length > 1) return ack?.({ ok: false, r: 'many', list: m.map(sum) });
    const { key, ...profile } = m[0];
    ack?.({ ok: true, key, profile });
  });

  // Create or update a profile. Usernames are unique across the class.
  s.on('save', (p: any, ack: (r: string) => void) => {
    const id = str(p?.id, 64), key = str(p?.key, 64);
    if (!id || !key) return ack?.('bad');
    if (db.gone.includes(id)) return ack?.('gone');
    const cur = db.profiles[id];
    if (cur && cur.key !== key) return ack?.('bad');
    if (!cur && Object.keys(db.profiles).length >= 60) return ack?.('full');
    const c = clean(p, id);
    if (!c.username || !c.name) return ack?.('bad');
    if (Object.values(db.profiles).some((o) => o.id !== id && o.username === c.username)) return ack?.('taken');
    db.profiles[id] = { ...c, key }; persist();
    io.emit('list', summaries());
    ack?.('ok');
  });

  s.on('remove', (p: any, ack: (r: string) => void) => {
    const id = str(p?.id, 64), cur = db.profiles[id];
    if (!cur || cur.key !== str(p?.key, 64)) return ack?.('bad');
    delete db.profiles[id]; db.gone = [...db.gone, id].slice(-500); persist();
    io.emit('list', summaries());
    ack?.('ok');
  });
});
http.listen(+(process.env.PORT || 3000), () => console.log('Poemgram running'));
