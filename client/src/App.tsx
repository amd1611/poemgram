import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type { Profile, Summary } from '../../shared/types';

// Every account shows the same 9 followers and 9 following, with no profile pictures.
const FRIENDS = ['mana_insta', 'adelfos.bro1', 'adelfos.bro2', 'adelfos.bro3', 'adelfos.bro4', 'adelfos.bro5', 'adelfos.bro6', 'adelfos.bro7', 'not_areti.spamm'];
const MAX_POSTS = 12;
type Sess = { room: string; id: string; key: string; name: string };

const get = (k: string) => { try { return localStorage.getItem(k) || ''; } catch { return ''; } };
const set = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch {} };
const load = (k: string) => { try { return JSON.parse(get(k) || 'null'); } catch { return null; } };
const rand = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, '0')).join('');
const ok = (s?: string) => (s && s.startsWith('data:image/jpeg;base64,') ? s : '');
const EL: Record<string, string> = { α: 'a', β: 'v', γ: 'g', δ: 'd', ε: 'e', ζ: 'z', η: 'i', θ: 'th', ι: 'i', κ: 'k', λ: 'l', μ: 'm', ν: 'n', ξ: 'x', ο: 'o', π: 'p', ρ: 'r', σ: 's', ς: 's', τ: 't', υ: 'y', φ: 'f', χ: 'ch', ψ: 'ps', ω: 'o' };
const slug = (n: string) => n.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[α-ω]/g, (c) => EL[c] || '').replace(/[^a-z0-9._]+/g, '.').replace(/^\.+|\.+$/g, '').slice(0, 24) || 'user';
const pl = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'} ago`;
const ago = (t: number) => { const m = Math.floor((Date.now() - t) / 6e4); return m < 1 ? 'Just now' : m < 60 ? pl(m, 'minute') : m < 1440 ? pl(Math.floor(m / 60), 'hour') : pl(Math.floor(m / 1440), 'day'); };
const S0: Sess | null = load('pgs');

function shrink(f: File, max: number, q: number): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => {
      const im = new Image();
      im.onload = () => {
        const k = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas');
        c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
        c.getContext('2d')!.drawImage(im, 0, 0, c.width, c.height);
        res(c.toDataURL('image/jpeg', q));
      };
      im.onerror = rej; im.src = r.result as string;
    };
    r.onerror = rej; r.readAsDataURL(f);
  });
}

const Ic = ({ c, s = 24, children }: { c?: string; s?: number; children?: any }) => (
  <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{c ? <path d={c} /> : children}</svg>
);
const HEART = 'M12 21s-8-5.3-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.7-8 11-8 11z';
const BACK = 'M15 5l-7 7 7 7';

function Av({ src, s, badge, thin, onClick }: { src?: string; s: number; badge?: boolean; thin?: boolean; onClick?: () => void }) {
  const a = ok(src);
  return (
    <div className={'avw' + (thin ? ' t' : '')} style={{ width: s, height: s, cursor: onClick ? 'pointer' : undefined }} onClick={onClick}>
      <div className="av">{a ? <img src={a} alt="" /> : <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="9" r="4.2" /><path d="M3.5 22c.8-4.6 4.2-7 8.5-7s7.7 2.4 8.5 7z" /></svg>}</div>
      {badge && <span className="plus">+</span>}
    </div>
  );
}

export default function App() {
  const [sess, setSess] = useState<Sess | null>(S0);
  const [me, setMe] = useState<Profile | null>(S0 ? load('pgm-' + S0.room) : null);
  const [list, setList] = useState<Summary[]>([]);
  const [ready, setReady] = useState(false);
  const [online, setOnline] = useState(true);
  const [screen, setScreen] = useState<'profile' | 'people' | 'other' | 'edit' | 'new'>('profile');
  const [viewId, setViewId] = useState('');
  const [other, setOther] = useState<Profile | null>(null);
  const [open, setOpen] = useState<{ p: Profile; i: number } | null>(null);
  const [sheet, setSheet] = useState<'' | 'followers' | 'following' | 'menu'>('');
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [q, setQ] = useState('');
  const [nameIn, setNameIn] = useState('');
  const [codeIn, setCodeIn] = useState('');
  const [df, setDf] = useState({ name: '', username: '', bio: '' });
  const [np, setNp] = useState({ img: '', cap: '' });
  const [msg, setMsg] = useState('');
  const sock = useRef<Socket>();
  const meRef = useRef(me); meRef.current = me;
  const avRef = useRef<HTMLInputElement>(null);
  const postRef = useRef<HTMLInputElement>(null);

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 2600); };

  useEffect(() => {
    if (!sess) return;
    const s = io(); sock.current = s; setReady(false);
    s.on('connect', () => {
      setOnline(true);
      s.emit('join', sess.room, (l: Summary[]) => {
        setList(l); setReady(true);
        let m = meRef.current;
        if (!m) { // first time: create the profile from the name typed at sign-up
          let u = slug(sess.name); const b = u; let n = 2;
          while (l.some((p) => p.username === u)) u = b + n++;
          m = { id: sess.id, username: u, name: sess.name, bio: '', avatar: '', posts: [], updated: 0 };
          setMe(m); set('pgm-' + sess.room, JSON.stringify(m));
        }
        // New profile, or the server restarted and forgot it: send this device's copy.
        if (!l.some((p) => p.id === m!.id)) s.emit('save', { ...m, key: sess.key }, () => {});
      });
    });
    s.on('disconnect', () => setOnline(false));
    s.on('list', setList);
    return () => { s.disconnect(); };
  }, [sess]);

  const sumOf = list.find((p) => p.id === viewId);
  useEffect(() => {
    if (screen !== 'other' || !viewId) return;
    sock.current?.emit('get', viewId, (p: Profile | null) => setOther(p));
  }, [screen, viewId, sumOf?.updated]);

  const commit = (next: Profile) => {
    setMe(next); set('pgm-' + sess!.room, JSON.stringify(next));
    sock.current?.emit('save', { ...next, key: sess!.key }, (r: string) => { if (r !== 'ok') flash(r === 'taken' ? 'That username is taken' : 'Could not save. Try again.'); });
  };
  const pickAvatar = async (f?: File) => { if (!f || !me) return; try { commit({ ...me, avatar: await shrink(f, 160, 0.8) }); } catch { flash('Could not read that photo'); } };
  const pickPost = async (f?: File) => { if (!f) return; try { setNp((x) => ({ ...x, img: '' })); const d = await shrink(f, 480, 0.6); setNp((x) => ({ ...x, img: d })); } catch { flash('Could not read that photo'); } };
  const sharePost = () => {
    if (!me || !np.img) return;
    if (me.posts.length >= MAX_POSTS) return flash(`You can have up to ${MAX_POSTS} posts. Delete one first.`);
    commit({ ...me, posts: [{ id: rand(), img: np.img, cap: np.cap.trim(), t: Date.now() }, ...me.posts] });
    setNp({ img: '', cap: '' }); setScreen('profile'); flash('Posted');
  };
  const saveEdit = () => {
    if (!me) return;
    const u = slug(df.username);
    if (list.some((p) => p.id !== me.id && p.username === u)) return flash('That username is taken');
    commit({ ...me, name: df.name.trim() || me.name, username: u, bio: df.bio.slice(0, 150) });
    setScreen('profile');
  };
  const delPost = () => { if (!me || !open || !confirm('Delete this post?')) return; commit({ ...me, posts: me.posts.filter((x) => x.id !== open.p.posts[open.i].id) }); setOpen(null); };
  const shareLink = () => { const u = location.href.split('#')[0]; if (navigator.share) navigator.share({ title: 'Poemgram', url: u }).catch(() => {}); else navigator.clipboard?.writeText(u).then(() => flash('Link copied')); };
  const logout = () => {
    if (!confirm('Log out? Your profile stays visible to classmates, but you will not be able to edit it on this device.')) return;
    set('pgs', ''); setSess(null); setMe(null); setSheet(''); setScreen('profile');
  };
  const goOther = (id: string) => { if (id === me?.id) return setScreen('profile'); setOther(null); setViewId(id); setScreen('other'); };

  if (!sess) {
    const go = () => { const s: Sess = { room: codeIn, id: rand(), key: rand(), name: nameIn.trim() }; set('pgs', JSON.stringify(s)); setMe(null); setSess(s); };
    return (
      <div id="app"><div className="form">
        <h1 className="logo">Poemgram</h1>
        <label className="f"><span>Your name</span><input value={nameIn} maxLength={40} placeholder="e.g. Markos" onChange={(e) => setNameIn(e.target.value)} /></label>
        <label className="f"><span>Class code</span><input value={codeIn} maxLength={12} autoCapitalize="characters" onChange={(e) => setCodeIn(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))} /></label>
        <button className="btn p" style={{ width: '100%' }} disabled={!nameIn.trim() || !codeIn} onClick={go}>Sign up</button>
        <p className="empty">Your profile is saved automatically on this device.</p>
      </div></div>
    );
  }
  if (!me) return <div id="app"><div className="empty">{online ? 'Setting up your profile…' : 'Connecting…'}</div></div>;

  const Tabs = (
    <div className="tabs">
      <div className="on"><Ic s={26}><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></Ic></div>
      <div><Ic s={26}><rect x="3" y="3" width="18" height="18" rx="5" /><path d="M10 8l6 4-6 4z" /></Ic></div>
      <div><Ic s={26} c="M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3" /></div>
      <div><Ic s={26}><rect x="4" y="4" width="16" height="16" rx="4" /><circle cx="12" cy="11" r="3" /><path d="M6 19c1-3 3-4 6-4s5 1 6 4" /></Ic></div>
    </div>
  );

  const profileView = (p: Profile, own: boolean) => (
    <>
      <div className="bar">
        {own
          ? <button aria-label="New post" onClick={() => { setNp({ img: '', cap: '' }); setScreen('new'); }}><Ic c="M12 4v16M4 12h16" s={30} /></button>
          : <button aria-label="Back" onClick={() => setScreen('people')}><Ic c={BACK} s={28} /></button>}
        <div className="un">{own && <Ic s={18}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></Ic>}<b>{p.username}</b>{own && <Ic c="M6 9l6 6 6-6" s={18} />}</div>
        {own ? <button aria-label="Menu" onClick={() => setSheet('menu')}><Ic c="M4 7h16M4 12h16M4 17h16" s={30} /></button> : <span />}
      </div>
      <div className="head">
        <Av src={p.avatar} s={96} badge={own} onClick={own ? () => avRef.current?.click() : undefined} />
        <div className="hr">
          <div className="nm">{p.name}</div>
          <div className="stats">
            <div className="st"><b>{p.posts.length}</b><span>posts</span></div>
            <button className="st" onClick={() => setSheet('followers')}><b>{FRIENDS.length}</b><span>followers</span></button>
            <button className="st" onClick={() => setSheet('following')}><b>{FRIENDS.length}</b><span>following</span></button>
          </div>
        </div>
      </div>
      {p.bio && <div className="bio">{p.bio}</div>}
      {own && (
        <div className="acts">
          <button className="btn" onClick={() => { setDf({ name: p.name, username: p.username, bio: p.bio }); setScreen('edit'); }}>Edit profile</button>
          <button className="btn" onClick={shareLink}>Share profile</button>
          <button className="btn sm" aria-label="Find classmates" onClick={() => setScreen('people')}><Ic s={22}><circle cx="9" cy="8" r="4" /><path d="M2 21c0-4 3-6 7-6M18 8v6M15 11h6" /></Ic></button>
        </div>
      )}
      {Tabs}
      {p.posts.length
        ? <div className="grid">{p.posts.map((x, i) => <button key={x.id} className="tile" onClick={() => setOpen({ p, i })}><img src={ok(x.img)} alt="" /></button>)}</div>
        : <div className="empty">{own ? <>No posts yet.<br /><button className="lk" onClick={() => { setNp({ img: '', cap: '' }); setScreen('new'); }}>Share your first photo</button></> : 'No posts yet'}</div>}
    </>
  );

  const others = list.filter((p) => p.id !== me.id && (p.username + ' ' + p.name).toLowerCase().includes(q.toLowerCase()));
  const people = (
    <>
      <div className="bar"><span /><div className="un"><b>Classmates</b></div><span /></div>
      <label className="search"><Ic s={20}><circle cx="11" cy="11" r="7" /><path d="M16 16l5 5" /></Ic><input placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} /></label>
      {others.length ? others.map((p) => (
        <button key={p.id} className="row" onClick={() => goOther(p.id)}>
          <Av src={p.avatar} s={56} thin /><div><b>{p.username}</b><span>{p.name} · {p.n} {p.n === 1 ? 'post' : 'posts'}</span></div>
        </button>
      )) : <div className="empty">{ready ? (q ? 'No results' : 'No classmates yet. Share the link and the class code!') : '…'}</div>}
    </>
  );

  const likeKey = open ? open.p.id + ':' + open.p.posts[open.i].id : '';
  return (
    <>
      {!online && <div className="banner">Reconnecting…</div>}
      <div id="app">{screen === 'people' ? people : screen === 'other' ? (other ? profileView(other, false) : <div className="empty">…</div>) : profileView(me, true)}</div>

      <nav><div>
        <button aria-label="Classmates" className={screen === 'people' || screen === 'other' ? 'on' : ''} onClick={() => { setQ(''); setScreen('people'); }}><Ic s={28}><circle cx="11" cy="11" r="7" /><path d="M16 16l5 5" /></Ic></button>
        <button aria-label="Profile" className={screen === 'profile' ? 'on' : ''} onClick={() => setScreen('profile')}><Av src={me.avatar} s={32} thin /></button>
      </div></nav>

      <input ref={avRef} type="file" accept="image/*" hidden onChange={(e) => { pickAvatar(e.target.files?.[0]); e.target.value = ''; }} />
      <input ref={postRef} type="file" accept="image/*" hidden onChange={(e) => { pickPost(e.target.files?.[0]); e.target.value = ''; }} />

      {screen === 'edit' && (
        <div className="full"><div>
          <div className="bar"><button className="lk" style={{ color: 'var(--fg)', fontWeight: 400 }} onClick={() => setScreen('profile')}>Cancel</button><b>Edit profile</b><button className="lk" onClick={saveEdit}>Done</button></div>
          <div className="form">
            <div className="pic"><Av src={me.avatar} s={96} onClick={() => avRef.current?.click()} /><button className="lk" onClick={() => avRef.current?.click()}>Edit picture</button></div>
            <label className="f"><span>Name</span><input value={df.name} maxLength={40} onChange={(e) => setDf({ ...df, name: e.target.value })} /></label>
            <label className="f"><span>Username</span><input value={df.username} maxLength={30} autoCapitalize="none" onChange={(e) => setDf({ ...df, username: e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, '') })} /></label>
            <label className="f"><span>Bio</span><textarea rows={3} maxLength={150} value={df.bio} onChange={(e) => setDf({ ...df, bio: e.target.value })} /></label>
          </div>
        </div></div>
      )}

      {screen === 'new' && (
        <div className="full"><div>
          <div className="bar"><button aria-label="Back" onClick={() => setScreen('profile')}><Ic c={BACK} s={28} /></button><b>New post</b><button className="lk" style={{ opacity: np.img ? 1 : 0.4 }} onClick={sharePost}>Share</button></div>
          <div className="form">
            <button className="drop" onClick={() => postRef.current?.click()}>{np.img ? <img src={np.img} alt="" /> : 'Tap to choose a photo'}</button>
            <label className="f" style={{ marginTop: 14 }}><span>Caption</span><textarea rows={3} maxLength={300} placeholder="Write a caption…" value={np.cap} onChange={(e) => setNp({ ...np, cap: e.target.value })} /></label>
          </div>
        </div></div>
      )}

      {open && (
        <div className="full" style={{ zIndex: 45 }}><div>
          <div className="bar"><button aria-label="Back" onClick={() => setOpen(null)}><Ic c={BACK} s={28} /></button><div className="un"><b style={{ fontSize: 17 }}>Posts</b></div>{open.p.id === me.id ? <button className="lk" style={{ color: '#ed4956', fontSize: 14 }} onClick={delPost}>Delete</button> : <span />}</div>
          <div className="ph"><Av src={open.p.avatar} s={38} thin /><b>{open.p.username}</b></div>
          <div className="media"><img src={ok(open.p.posts[open.i].img)} alt="" /></div>
          <div className="pa">
            <button className={liked.has(likeKey) ? 'on' : ''} aria-label="Like" onClick={() => setLiked((s) => { const n = new Set(s); n.has(likeKey) ? n.delete(likeKey) : n.add(likeKey); return n; })}><Ic c={HEART} s={28} /></button>
            <Ic s={28} c="M21 12a8 8 0 0 1-11.5 7.2L4 20l1-4.5A8 8 0 1 1 21 12z" />
            <Ic s={28} c="M22 3L11 14M22 3l-7 18-4-7-7-4 18-7z" />
          </div>
          {liked.has(likeKey) && <div className="cap"><b>Liked by you</b></div>}
          {open.p.posts[open.i].cap && <div className="cap"><b>{open.p.username}</b> {open.p.posts[open.i].cap}</div>}
          <div className="when">{ago(open.p.posts[open.i].t)}</div>
        </div></div>
      )}

      {sheet && (
        <div className="bg" onClick={() => setSheet('')}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            {sheet === 'menu' ? (
              <div className="form">
                <p>Class code: <b>{sess.room}</b></p>
                <button className="btn" style={{ width: '100%', color: '#ed4956' }} onClick={logout}>Log out</button>
              </div>
            ) : (
              <>
                <div className="tabs">
                  <button className={sheet === 'followers' ? 'on' : ''} onClick={() => setSheet('followers')}>{FRIENDS.length} followers</button>
                  <button className={sheet === 'following' ? 'on' : ''} onClick={() => setSheet('following')}>{FRIENDS.length} following</button>
                </div>
                {FRIENDS.map((f) => <div key={f} className="row"><Av s={48} thin /><b>{f}</b></div>)}
              </>
            )}
          </div>
        </div>
      )}
      {msg && <div id="toast">{msg}</div>}
    </>
  );
}
