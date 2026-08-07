# Job Tracker — Chrome Extension

Track job applications as a personal Kanban board. No backend, no API keys — everything is stored locally in your browser via `chrome.storage.local`.

## How to load it (unpacked extension)

1. Open Chrome and go to `chrome://extensions`
2. Turn on **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select this whole `job-tracker-extension` folder
5. You should see "Job Tracker" appear in your extensions list, and a new tab should open automatically showing the empty board (first-install behavior)

Pin it to your toolbar (puzzle-piece icon → pin) so it's one click away.

## How it works

- **Click the extension icon** on any page:
  - On a recognized job board (LinkedIn, Naukri, Indeed) or a common ATS page (Greenhouse, Lever, Workday) — it shows what it detected (editable before saving), with "Save for later" or "I just applied" buttons
  - On a Google Form — it asks "Is this a job application?" before logging anything
  - Anywhere else — a simple manual-entry form
- **"View full board"** (bottom of the popup, or the extension's default tab) opens the Kanban view
- **Drag a card** between columns — a small form pops up asking for that column's relevant info (date, interview round/time, revert method, outcome), with "Today"/"Tomorrow" quick-select chips
- **Click a card** to see its full history, edit details, add notes, or delete it
- **"+ Add card"** on any column, or "+ Add application" up top, for adding something manually without needing to be on a job page at all

## Step-by-step: test it

1. Load the extension (steps above) — confirm the board opens automatically and is empty
2. Visit a real job posting on LinkedIn or Naukri, click the extension icon — confirm it detects a role/company (may not be perfect; edit fields to confirm they're editable either way), click "Save for later"
3. Open the board — confirm the card appears in **Saved** with a "View posting" link
4. **Drag that card into Applied** — confirm the date popup appears, try the "Today" chip, confirm
5. **Drag it into Interview** — confirm it asks for round/date/time; enter values
6. **Drag it into Interview again** (simulating a second round) — confirm the round number suggests one higher than last time
7. **Click the card** — confirm the timeline shows every step in order (Saved → Applied → Interview Round 1 → Interview Round 2), notes field, and edit fields all work; try editing the role and saving
8. **Delete a card** — confirm the confirmation prompt, and that it's actually removed
9. Visit any Google Form — click the extension icon — confirm the "Is this a job application?" nudge appears instead of a generic form
10. **Close and reopen Chrome entirely**, then check the board again — confirm all your data is still there (this is `chrome.storage.local` actually persisting, not just an in-memory session)

## Notes on the detection logic

- Site-specific extraction is included for LinkedIn, Naukri, Indeed, Greenhouse, Lever, and Workday — covers a good chunk of real postings, but selectors can break if a site changes its markup. Every extracted field is editable before saving, so a broken selector never blocks you from logging the application.
- Logos are guessed from the company name via Clearbit's free public logo API (e.g. "Figma" → `logo.clearbit.com/figma.com`). Wrong guesses just fall back to initials — nothing breaks.
- Everything is fully editable after the fact from the card detail view, so imperfect auto-detection is never a dead end.
