# Poemgram

A fake Instagram for the class. Everyone is in the same class, there is no class code.
- Start page: **Sign in** (type your name) or **Create new** (name + a unique username).
- Profile styled like Instagram: profile picture, photo posts with captions, Edit profile, Delete account (menu and Edit profile).
- Magnifier tab: every other classmate's profile.
- Every account shows 9 followers and 9 following (same 9 names, no pictures). To change them, edit `FRIENDS` in `client/src/App.tsx`.

Same stack as Koum Kan: React + TypeScript client, Node + Socket.IO server, shared types in /shared.

## Run on your computer
```
npm install
npm run build
npm start          # http://localhost:3000
```
Development with hot reload: `npm run dev:server` in one terminal and `npm run dev:client` in another (open http://localhost:5173).

## Put it online for free (Render)
1. Push this folder to a GitHub repo.
2. On render.com: New > Web Service > pick the repo, free plan.
3. Build command: `npm install && npm run build`   Start command: `npm start`
4. Send the link to the class.

## Good to know
- Signing in only needs a name, so anyone who types your name can get into your account. If two students share a name, the app asks which username is theirs.
- Free Render services sleep after ~15 minutes idle and wipe their disk when they restart. Each device re-sends its own profile when it reconnects, so profiles come back as students reopen the page.
- Limits: 60 accounts, 12 posts per account. Photos are shrunk on the phone before uploading.
