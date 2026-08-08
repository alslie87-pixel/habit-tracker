# CLAUDE.md — habit-tracker

Guidance for Claude (and humans) working in this repo.

## Stack

- **Frontend:** a single vanilla web app — `index.html` (no framework, no build step).
- **Backend:** serverless functions in `/api`, talking to a **Google Sheet** as the
  data store via the `googleapis` library.
- **Hosting:** deployed on **Vercel** → https://habit-tracker-tau-tan.vercel.app
- **Runtime:** Node `24.x`. Only dependency: `googleapis`.

### API endpoints (`/api`)

| File | Sheet access | Purpose |
|---|---|---|
| `sheets.js` | — | Shared helper: builds Google auth + a `sheets` client. |
| `get-habits.js` | **read** (readonly scope) | Reads the Control Panel + habit tabs, returns habits/config. |
| `get-coaching.js` | **none** | No sheet access — takes stats from the request body, calls OpenAI (`OPENAI_API_KEY`), returns a coaching note. |
| `toggle-habit.js` | **write** | Toggles a single habit cell (checkbox) for a day. |
| `update-streak.js` | **write** | Updates streak values. |
| `update-focus.js` | **write** | Updates the current focus. |
| `update-config.js` | **write** | Updates Control Panel configuration. |

### Environment variables (set in Vercel — do not hardcode)

- `GOOGLE_SERVICE_ACCOUNT` — JSON service-account credentials for the Sheets API.
- `GOOGLE_SHEET_ID` — the spreadsheet the app reads/writes.
- `OPENAI_API_KEY` — used by `get-coaching.js`.

## App philosophy

- **In the app: positive feedback.** The day-to-day surface is encouraging and
  supportive — it nudges, celebrates progress, and stays kind.
- **On the Insights view: honest stats.** Insights is where the real, unvarnished
  numbers live — no rounding up, no cheerleading. Keep the two concerns separate:
  don't let the encouraging tone bleed into Insights, and don't let raw stats
  bleed into the everyday feedback.

## Standing rules (for any change in this repo)

1. **Always work on a new branch.** Never commit directly to `main`.
2. **Always open a PR** for the change.
3. **Never merge.** Leave the PR open for the human to review and merge.
4. **Never write to the live Google Sheet.** Don't run the write endpoints
   (`toggle-habit`, `update-streak`, `update-focus`, `update-config`) against the
   real sheet, and don't add code that does so as a side effect of testing.
5. **Never touch environment variables** (`GOOGLE_SERVICE_ACCOUNT`, `GOOGLE_SHEET_ID`,
   `OPENAI_API_KEY`) or their values **without asking first.**
6. **If blocked, don't guess.** Write your questions in the PR description and stop —
   wait for answers rather than making an assumption or a workaround.
