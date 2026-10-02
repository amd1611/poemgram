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
let rooms: Record<string, Record<string, Stored>> = {};
try { if (existsSync(FILE)) rooms = JSON.parse(readFileSync(FILE, 'utf8')); } catch {}

let timer: any;
const persist = () => { clearTimeout(timer); timer = setTimeout(() => { try { writeFileSync(FILE, JSON.stringify(rooms)); } catch {} }, 1000); };
const summaries = (room: string): Summary[] =>
  Object.values(rooms[room] || {}).map(({ key, posts, ...p }) => ({ ...p, n: posts.length })).sort((a, b) => b.updated - a.updated);

const str = (v: any, n: number) => String(v ?? '').slice(0, n);
const im = (v: any, max: number) => (typeof v === 'string' && v.startsWith('data:image/jpeg;base64,') && v.length < max ? v : '');
const clean = (p: any, id: string): Profile => ({
  id, username: str(p.username, 30).toLowerCase().replace(/[^a-z0-9._]/g, ''), name: str(p.name, 40), bio: str(p.bio, 150),
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
  let room = '';
  s.on('join', (code: string, ack: (l: Summary[]) => void) => {
    code = str(code, 12).toUpperCase().replace(/[^A-Z0-9-]/g, '');
    if (!code) return;
    if (room) s.leave(room);
    room = code; s.join(code); rooms[code] ??= {};
    ack?.(summaries(code));
  });
  // Full profile (with photos) of one classmate, loaded only when opened.
  s.on('get', (id: string, ack: (p: Profile | null) => void) => {
    const o = rooms[room]?.[str(id, 64)];
    if (!o) return ack?.(null);
    const { key, ...p } = o;
    ack?.(p);
  });
  // A profile can only be changed by whoever holds its secret key (kept on their own device).
  s.on('save', (p: any, ack: (r: string) => void) => {
    const id = str(p?.id, 64), key = str(p?.key, 64), r = rooms[room];
    if (!r || !id || !key) return ack?.('bad');
    const cur = r[id];
    if (cur ? cur.key !== key : Object.keys(r).length >= 40) return ack?.('bad');
    const c = clean(p, id);
    if (!c.username) return ack?.('bad');
    if (Object.values(r).some((o) => o.id !== id && o.username === c.username)) return ack?.('taken');
    r[id] = { ...c, key }; persist();
    io.to(room).emit('list', summaries(room));
    ack?.('ok');
  });
});
http.listen(+(process.env.PORT || 3000), () => console.log('Poemgram running'));
