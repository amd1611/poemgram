# Poemgram

A fake Instagram for the class. Students sign up with just a name (plus the class code), get a profile styled like Instagram,
add a profile picture and photo posts, and browse every classmate's profile in the "Classmates" tab (magnifier icon).
Every account shows 9 followers and 9 following (the same 9 names, no pictures). To change them, edit `FRIENDS` in `client/src/App.tsx`.
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
4. Share the link and the class code. Students open it on their phone, type their name and the code, and they are in.

## Good to know
- A profile is saved on the server and on the student's own device, and reopens automatically. It can only be edited from the device that created it.
- Free Render services sleep after ~15 minutes idle and wipe their disk when they restart. Each device re-sends its own profile when it reconnects, so profiles come back as students reopen the page.
- Limits: 40 profiles per class code, 12 posts per profile. Photos are shrunk on the phone before uploading.
