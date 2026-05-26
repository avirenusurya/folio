# Folio

**A quiet ledger for serious study.**

Folio is a calm, single-page study companion that turns hours of focused work into something you can see and stay accountable to — a focus timer, a study heatmap, habit streaks, a private journal, and a social "Society" where you and your friends can see who's actually putting in the hours. Built with React and Supabase, it syncs across devices and runs entirely on a managed backend (no server to operate).

> **Live demo:** _add link_ · Built by [Avirenu Surya](https://github.com/avirenusurya)

---

## Features

- **Focus timer** — start a session with a tap (or the spacebar), assign it to a subject, and switch subjects with the arrow keys. Every session is logged.
- **Study heatmap** — a calendar where each day fills in by hours studied; darker means more. Click any cell to see exactly what you worked on.
- **Habits** — track small daily things (read, run, meditate) and watch the dots build into a streak.
- **The Society** — create or join a group with friends, backed by Supabase with **realtime presence** (see who's online and studying right now) and an hours leaderboard.
- **Journal** — write what mattered today; Folio autosaves. Every Sunday a personal weekly note is generated for you.
- **Make it yours** — add subjects, set daily goals, swap themes and font pairings, and toggle privacy. Settings persist across devices.
- **Guided onboarding** — an interactive tour (running on mock data) walks new users through every surface before they start fresh.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite |
| Backend (BaaS) | Supabase — Postgres, Auth (PKCE), Realtime presence, Edge Functions |
| Data | SQL migrations (`supabase/migrations/`) for schema + the Society |
| Styling | Hand-rolled CSS with a paper-grain theme, swappable font pairings |

## Project structure

```
src/
├── App.jsx              # App shell — providers, theme/font injection, router
├── state.jsx            # Folio data store + date/format helpers
├── auth.jsx             # Auth screens
├── auth-context.jsx     # Supabase auth context
├── timer.jsx            # Focus timer
├── calendar.jsx         # Study heatmap
├── habits.jsx           # Habit tracking
├── society.jsx          # Groups + realtime presence + leaderboard
├── journal.jsx          # Journal + weekly notes
├── settings.jsx         # Subjects, goals, themes, privacy
├── shared.jsx           # Shared UI primitives + font pairs
├── onboarding/          # Interactive product tour (mock-data provider)
└── lib/supabase.js      # Supabase client
supabase/
├── migrations/          # 0001_init.sql, 0002_society.sql
└── functions/           # delete-account edge function
```

## Running locally

```bash
# 1. Install dependencies
npm install

# 2. Configure Supabase
cp .env.example .env.local
# then fill in:
#   VITE_SUPABASE_URL=...
#   VITE_SUPABASE_ANON_KEY=...

# 3. Apply the database schema to your Supabase project
#    (run the SQL in supabase/migrations/ via the Supabase SQL editor or CLI)

# 4. Start the dev server
npm run dev
```

## License

MIT — see [LICENSE](LICENSE).
