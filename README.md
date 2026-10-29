# Class Attendance System

Full-stack attendance app: teachers start a live session (QR code + short code),
students check in from their phone or laptop, attendance is recorded in real time.

- `backend/` — Node.js + Express + Prisma (SQLite) API
- `frontend/` — React + Vite + Tailwind, mobile-friendly (installable as a PWA)

## 1. Backend setup

```bash
cd backend
cp .env.example .env
npm install
npx prisma migrate dev --name init   # creates the SQLite DB and tables
npm run seed                         # creates a demo teacher + 2 students + 1 class
npm run dev                          # starts the API on http://localhost:4000
```

Demo logins after seeding:
- Teacher: `teacher@example.com` / `password123`
- Student: `student1@example.com` / `password123`
- Student: `student2@example.com` / `password123`

## 2. Frontend setup

In a second terminal:

```bash
cd frontend
cp .env.example .env
npm install
npm run dev     # starts on http://localhost:5173

```
<!-- to see my datbas on the browser run this command -->
npx prisma studio

Open http://localhost:5173, log in as the teacher, create/open a class, click
**Start attendance session** — you'll get a QR code and a 6-character code.
Log in as a student in another browser/incognito tab (or on your phone once
you expose the servers on your network), go to **Check in to a session**, and
scan the QR or type the code.

## 3. Checking in from a real phone

By default this only works on `localhost`. To test from an actual phone on the
same Wi-Fi:
1. Find your computer's local IP (e.g. `192.168.1.23`).
2. Set `VITE_API_URL=http://192.168.1.23:4000/api` in `frontend/.env` and
   `CORS_ORIGIN=http://192.168.1.23:5173` + `PUBLIC_APP_URL=http://192.168.1.23:5173`
   in `backend/.env`.
3. Restart both servers, and open `http://192.168.1.23:5173` on your phone.
4. Camera-based QR scanning requires HTTPS on most mobile browsers except for
   `localhost`/local-network testing in dev mode — for a real deployment, put
   both behind HTTPS (e.g. via a reverse proxy or hosting platform's built-in TLS).

## What's implemented

- Signup/login with JWT, roles: TEACHER / STUDENT (ADMIN role exists in the
  schema for future use)
- Teacher: create classes, enroll students by email, start/close attendance
  sessions with a configurable duration and grace period
- QR code + 6-character manual code check-in, with PRESENT vs LATE based on
  the grace period, and automatic ABSENT marking for anyone enrolled who
  never checks in once a session closes (or its time window passes)
- Optional GPS radius check per session (only enforced if the teacher sets a
  location + radius when starting the session)
- Live attendance updates on the teacher's session screen via Socket.IO
- Per-student attendance history and running attendance percentage
- CSV export of a class's full attendance history
- Duplicate check-in prevention, rate limiting on the check-in endpoint

## Suggested next steps

- Add an admin UI for managing teachers/schools (the role and basic checks
  already exist in the API)
- Push/email notifications when a session opens or is about to close
- Wrap the frontend in React Native or Capacitor for a native mobile app
  (the current PWA already installs to a phone home screen)
- Deploy: e.g. backend on Render/Railway with a managed Postgres instead of
  SQLite (swap the Prisma `provider` and `DATABASE_URL`), frontend on Vercel/Netlify
