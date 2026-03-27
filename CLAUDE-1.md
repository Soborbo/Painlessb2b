# CLAUDE.md — B2B Prospect Tracker

## Project Overview

Internal B2B prospect tracker app. Astro 6 + React + Cloudflare D1 + Leaflet maps.
Full spec: `b2b-prospect-tracker-spec.md` — READ IT BEFORE WRITING ANY CODE.

## Critical Rules

- **Astro 6** — use `process.env.VARIABLE` for runtime env vars, NOT `import.meta.env`
- **Node 22+** required
- **Single React island** — everything interactive lives in `<ProspectApp client:only="react" />`
- **D1 access** — via `context.locals.runtime.env.DB` in API routes
- **No external state library** — useReducer + context only
- **Tailwind CSS 4** — use `@tailwindcss/vite` plugin, NOT the old PostCSS integration
- **Dark theme** — bg base #0c0e14, surfaces #13151e, elevated #1a1d2a, accent #818cf8/#6366f1
- **Font** — "DM Sans" for UI, "JetBrains Mono" for data/counts
- **All API responses** are JSON
- **All IDs** are UUIDs (use `crypto.randomUUID()`)
- **All dates** stored as ISO strings via `datetime('now')` in SQLite
- **Never use `import.meta.env`** for secrets or runtime config — Astro 6 inlines these at build time

## Dev Commands

```bash
npm run dev              # Start dev server (workerd runtime)
npm run build            # Production build
npm run preview          # Preview production build locally
npx wrangler d1 execute prospect-tracker-db --local --file=schema.sql  # Init local DB
npx wrangler pages deploy ./dist  # Deploy
```

## Local Environment

Create `.dev.vars` in project root:
```
AUTH_PASSWORD=testpass123
SESSION_SECRET=local-dev-secret-32-chars-min!!
RESEND_API_KEY=re_test_xxxxxxxxxxxx
SENDER_EMAIL=test@example.com
SENDER_NAME=Test Sender
```

---

## Phase 1: Project Setup + D1 Schema + Auth

### What to build
1. Init Astro 6 project with React, Tailwind CSS 4, Cloudflare adapter
2. `wrangler.toml` with D1 binding named `DB`
3. `schema.sql` — all 4 tables (categories, companies, notes, email_log) + INSERT 6 default categories
4. `src/lib/auth.ts` — sign/verify session cookie with HMAC-SHA256 using SESSION_SECRET
5. `src/middleware.ts` — check cookie on all routes except `/login`, `/api/auth/*`, and static assets
6. `src/pages/login.astro` — dark themed, single password field, POST to /api/auth/login
7. `src/pages/api/auth/login.ts` — verify password, set HTTP-only cookie (7 day expiry)
8. `src/pages/api/auth/logout.ts` — clear cookie, redirect to /login
9. `src/pages/index.astro` — protected, shows "Logged in as admin" placeholder
10. `src/lib/constants.ts` — STATUS_CONFIG and PRIORITY_CONFIG objects with labels and colours
11. `src/lib/utils.ts` — generateId(), formatDate(), formatRelativeTime()

### Tests — Phase 1

Run ALL these checks. Every one must pass before moving to Phase 2.

```bash
# T1.1: Project builds without errors
npm run build
# EXPECT: Exit code 0, no TypeScript errors, no build warnings about missing modules

# T1.2: D1 schema executes without errors
npx wrangler d1 execute prospect-tracker-db --local --file=schema.sql
# EXPECT: Exit code 0, no SQL errors

# T1.3: Seed categories exist
npx wrangler d1 execute prospect-tracker-db --local --command="SELECT count(*) as c FROM categories"
# EXPECT: c = 6

# T1.4: All 4 tables exist with correct columns
npx wrangler d1 execute prospect-tracker-db --local --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
# EXPECT: categories, companies, email_log, notes (4 tables)

npx wrangler d1 execute prospect-tracker-db --local --command="PRAGMA table_info(companies)"
# EXPECT: columns include id, name, category_id, address, postcode, lat, lng, phone, website, generic_email, contact_name, contact_email, contact_phone, status, priority, source, source_url, google_place_id, follow_up_date, created_at, updated_at

npx wrangler d1 execute prospect-tracker-db --local --command="PRAGMA table_info(email_log)"
# EXPECT: columns include id, company_id, to_email, subject, body, status, sent_at

# T1.5: Dev server starts
npm run dev &
sleep 5

# T1.6: Unauthenticated request redirects to login
curl -s -o /dev/null -w "%{http_code}" http://localhost:4321/
# EXPECT: 302 (redirect to /login)

# T1.7: Login page loads
curl -s -o /dev/null -w "%{http_code}" http://localhost:4321/login
# EXPECT: 200

# T1.8: Wrong password rejected
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:4321/api/auth/login \
  -H "Content-Type: application/json" -d '{"password":"wrong"}'
# EXPECT: 401

# T1.9: Correct password returns set-cookie
curl -s -D - -X POST http://localhost:4321/api/auth/login \
  -H "Content-Type: application/json" -d '{"password":"testpass123"}' 2>&1 | grep -i set-cookie
# EXPECT: Set-Cookie header present with HttpOnly flag

# T1.10: Authenticated request reaches index
COOKIE=$(curl -s -D - -X POST http://localhost:4321/api/auth/login \
  -H "Content-Type: application/json" -d '{"password":"testpass123"}' 2>&1 | grep -i set-cookie | sed 's/.*set-cookie: //i' | cut -d';' -f1)
curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE" http://localhost:4321/
# EXPECT: 200

# T1.11: Logout clears cookie
curl -s -D - -X POST -b "$COOKIE" http://localhost:4321/api/auth/logout 2>&1 | grep -i set-cookie
# EXPECT: Set-Cookie with Max-Age=0 or expired date

kill %1  # Stop dev server
```

---

## Phase 2: API Routes (CRUD)

### What to build
All endpoints under `src/pages/api/`. See spec for full details on each endpoint.
- Companies: GET (list+filter), POST, PUT/[id], DELETE/[id]
- Notes: GET/[companyId], POST, DELETE/[id]
- Categories: GET (with company counts), POST, PUT/[id], DELETE/[id] (409 if in use)
- Import: POST (bulk JSON, dedupe by name+postcode, auto-create categories)
- Export: GET (full dump)
- Reminders: GET (overdue follow-ups)

### Tests — Phase 2

Start dev server, get auth cookie, then run ALL tests.

```bash
npm run dev &
sleep 5
COOKIE=$(curl -s -D - -X POST http://localhost:4321/api/auth/login \
  -H "Content-Type: application/json" -d '{"password":"testpass123"}' 2>&1 | grep -i set-cookie | sed 's/.*set-cookie: //i' | cut -d';' -f1)

# T2.1: GET categories returns 6 seed categories
curl -s -b "$COOKIE" http://localhost:4321/api/categories | python3 -c "import sys,json; d=json.load(sys.stdin); assert len(d)==6, f'Expected 6 categories, got {len(d)}'; print('PASS: 6 categories')"

# T2.2: POST company creates a record
COMPANY_ID=$(curl -s -b "$COOKIE" -X POST http://localhost:4321/api/companies \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Solicitors","category_id":"SOLICITOR_CAT_ID_HERE","address":"1 High St, Bristol","postcode":"BS1 1AA","lat":51.4545,"lng":-2.5879,"phone":"0117 000 0000","status":"new","priority":"high"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['id'])")
echo "Created company: $COMPANY_ID"
# EXPECT: Valid UUID printed
# NOTE: Replace SOLICITOR_CAT_ID_HERE with actual category ID from T2.1, OR make the API accept category name

# T2.3: GET companies returns the created company
curl -s -b "$COOKIE" "http://localhost:4321/api/companies" | python3 -c "
import sys,json; d=json.load(sys.stdin)
assert len(d)>=1, 'No companies returned'
assert any(c['name']=='Test Solicitors' for c in d), 'Created company not found'
print('PASS: company exists')"

# T2.4: GET companies with status filter
curl -s -b "$COOKIE" "http://localhost:4321/api/companies?status=new" | python3 -c "
import sys,json; d=json.load(sys.stdin)
assert all(c['status']=='new' for c in d), 'Status filter not working'
print('PASS: status filter works')"

# T2.5: GET companies with search filter
curl -s -b "$COOKIE" "http://localhost:4321/api/companies?search=Test" | python3 -c "
import sys,json; d=json.load(sys.stdin)
assert any('Test' in c['name'] for c in d), 'Search not finding by name'
print('PASS: search filter works')"

# T2.6: PUT company updates fields
curl -s -b "$COOKIE" -X PUT "http://localhost:4321/api/companies/$COMPANY_ID" \
  -H "Content-Type: application/json" \
  -d '{"status":"contacted","follow_up_date":"2026-03-20"}' | python3 -c "
import sys,json; d=json.load(sys.stdin)
assert d['status']=='contacted', f'Status not updated: {d[\"status\"]}'
assert d['follow_up_date']=='2026-03-20', 'Follow-up date not set'
print('PASS: company updated')"

# T2.7: POST note
NOTE_ID=$(curl -s -b "$COOKIE" -X POST http://localhost:4321/api/notes \
  -H "Content-Type: application/json" \
  -d "{\"company_id\":\"$COMPANY_ID\",\"body\":\"Called and spoke to receptionist\"}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "Created note: $NOTE_ID"
# EXPECT: Valid UUID

# T2.8: GET notes for company
curl -s -b "$COOKIE" "http://localhost:4321/api/notes/$COMPANY_ID" | python3 -c "
import sys,json; d=json.load(sys.stdin)
assert len(d)>=1, 'No notes returned'
assert d[0]['body']=='Called and spoke to receptionist', 'Note body wrong'
print('PASS: notes work')"

# T2.9: POST category
NEW_CAT_ID=$(curl -s -b "$COOKIE" -X POST http://localhost:4321/api/categories \
  -H "Content-Type: application/json" \
  -d '{"name":"Home Staging","color":"#a855f7"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "Created category: $NEW_CAT_ID"

# T2.10: DELETE category that has no companies succeeds
curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE" -X DELETE "http://localhost:4321/api/categories/$NEW_CAT_ID"
# EXPECT: 200

# T2.11: DELETE category that HAS companies returns 409
# (First get the category ID of "Solicitor" that our test company uses, then try to delete it)
# EXPECT: 409 Conflict

# T2.12: Import with duplicate detection
curl -s -b "$COOKIE" -X POST http://localhost:4321/api/import \
  -H "Content-Type: application/json" \
  -d '[
    {"name":"Test Solicitors","postcode":"BS1 1AA","category":"Solicitor","address":"1 High St"},
    {"name":"New Estate Agent","postcode":"BS2 8AA","category":"Estate Agent","address":"5 Park St","contact_name":"Jane","notes":"Big agency"}
  ]' | python3 -c "
import sys,json; d=json.load(sys.stdin)
assert d['imported']==1, f'Expected 1 imported, got {d[\"imported\"]}'
assert d['skipped']==1, f'Expected 1 skipped, got {d[\"skipped\"]}'
print('PASS: import with dedupe works')"

# T2.13: Import auto-creates unknown category
curl -s -b "$COOKIE" -X POST http://localhost:4321/api/import \
  -H "Content-Type: application/json" \
  -d '[{"name":"Stage It Right","postcode":"BS3 1AA","category":"Home Staging","address":"10 Queen Rd"}]' | python3 -c "
import sys,json; d=json.load(sys.stdin)
assert d['imported']==1, 'Import failed'
print('PASS: auto-category creation works')"

curl -s -b "$COOKIE" http://localhost:4321/api/categories | python3 -c "
import sys,json; d=json.load(sys.stdin)
assert any(c['name']=='Home Staging' for c in d), 'Home Staging category not created'
print('PASS: Home Staging category exists')"

# T2.14: Export returns all data
curl -s -b "$COOKIE" http://localhost:4321/api/export | python3 -c "
import sys,json; d=json.load(sys.stdin)
assert 'companies' in d, 'No companies key'
assert 'categories' in d, 'No categories key'
assert 'notes' in d, 'No notes key'
assert len(d['companies'])>=3, f'Expected >=3 companies, got {len(d[\"companies\"])}'
print('PASS: export works')"

# T2.15: Reminders endpoint returns overdue companies
curl -s -b "$COOKIE" http://localhost:4321/api/reminders | python3 -c "
import sys,json; d=json.load(sys.stdin)
# Our test company has follow_up_date 2026-03-20 which is in the past
assert any(c['name']=='Test Solicitors' for c in d), 'Overdue company not in reminders'
print('PASS: reminders work')"

# T2.16: DELETE note
curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE" -X DELETE "http://localhost:4321/api/notes/$NOTE_ID"
# EXPECT: 200

# T2.17: DELETE company (cascades notes + email_log)
curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE" -X DELETE "http://localhost:4321/api/companies/$COMPANY_ID"
# EXPECT: 200

# T2.18: Unauthenticated API request is rejected
curl -s -o /dev/null -w "%{http_code}" http://localhost:4321/api/companies
# EXPECT: 401 or 302

kill %1
```

---

## Phase 3: App Shell + State + Sidebar

### What to build
See spec "Phase 3" section. Key components: ProspectApp.tsx, TopBar.tsx, Sidebar.tsx, CategoryManager.tsx, ImportExport.tsx, Toast.tsx, EmptyState.tsx, StatusBadge.tsx, PriorityBadge.tsx, FilterCheckbox.tsx.

### Tests — Phase 3

These are manual browser tests. Start dev server, log in, then verify each one.

```
T3.1: App loads after login — no console errors, no blank screen
T3.2: Stat chips show correct counts (Total, New, In Progress, Partners, Rejected)
      — import test data first via the Import button or Phase 2 curl commands
T3.3: Clicking a stat chip filters the data (e.g. clicking "New" shows only new prospects)
T3.4: Search input filters by company name — type "Solic", results update after 300ms debounce
T3.5: Search input filters by postcode — type "BS1", matching results shown
T3.6: Status checkboxes filter correctly — uncheck "New", new prospects disappear from count
T3.7: Category checkboxes filter correctly — check only "Solicitor", only solicitors remain
T3.8: Priority filter works — click "High", only high-priority prospects shown
T3.9: "Has email" toggle works — only prospects with contact_email OR generic_email shown
T3.10: "Has contact" toggle works — only prospects with contact_name shown
T3.11: "Overdue follow-up" toggle works — only prospects with follow_up_date in the past shown
T3.12: "Clear all filters" button resets everything
T3.13: Multiple filters combine correctly (AND logic) — check "Solicitor" + "New" = only new solicitors
T3.14: Category Manager opens as modal — can add new category with name + colour
T3.15: Category Manager — new category appears in sidebar filter immediately
T3.16: Category Manager — can edit category name and colour
T3.17: Category Manager — delete category with 0 companies succeeds
T3.18: Category Manager — delete category with companies shows error (409)
T3.19: Import — click Import, select valid JSON file, prospects appear in stat counts
T3.20: Import — importing duplicate (same name+postcode) shows "X skipped" in toast
T3.21: Export — click Export, JSON file downloads, contains all companies+notes+categories
T3.22: Toast — shows on successful import, disappears after ~3 seconds
T3.23: Toast — shows on error (e.g. import invalid JSON), red colour, stays longer
T3.24: Empty state — with no data, shows friendly message "No prospects yet. Import some data to get started."
T3.25: Empty state — with filters active that match nothing, shows "No prospects match your filters"
T3.26: Dark theme applied — bg is dark, text is light, accent is indigo, no white flash on load
T3.27: Fonts loaded — "DM Sans" for labels, "JetBrains Mono" for counts/numbers
T3.28: View toggle buttons visible in topbar (Map | List | Kanban | Heatmap) — Map may work, others can be placeholder
T3.29: Logout button works — clears session, redirects to login
```

---

## Phase 4: Map View + List Panel

### What to build
See spec "Phase 4" section. MapView.tsx, ListPanel.tsx, ProspectCard.tsx.

### Tests — Phase 4

Import at least 10 test prospects with varied statuses, categories, and lat/lng around Bristol before testing.

```
T4.1: Map loads with CartoDB Dark Matter tiles — dark background, no tile errors in console
T4.2: Map centred on Bristol (51.45, -2.59) at zoom ~12
T4.3: Pins appear for all prospects that have lat+lng
T4.4: Pin colours match status — blue for new, yellow for contacted, orange for follow_up, purple for in_conversation, green for partner, red for rejected, grey for not_interested
T4.5: Hovering a pin shows tooltip with company name + status
T4.6: Clicking a pin sets it as selected (future: opens drawer in Phase 5)
T4.7: Marker clustering works — zoom out, nearby pins merge into cluster with count
T4.8: Cluster styling is dark themed (not default blue Leaflet clusters)
T4.9: Sidebar filters hide pins — uncheck "New", blue pins disappear from map
T4.10: Search filters hide pins — type a name, only matching pin(s) remain
T4.11: Prospects WITHOUT lat/lng do NOT cause map errors — they simply don't appear on map
T4.12: List panel (right side, 380px) shows prospect cards
T4.13: Card shows: status dot (correct colour), company name, category, priority badge (if high), last note preview
T4.14: "Showing X of Y prospects" count is correct and updates with filters
T4.15: Clicking a card centres the map on that pin and highlights it
T4.16: Sort dropdown works — sort by name, status, priority, updated, follow-up date
T4.17: Overdue follow-up pins have visual distinction (pulsing animation or ring)
T4.18: Overdue cards in list panel show warning text (e.g. "Follow up overdue (5d)")
T4.19: Map is responsive to container — resizing window doesn't break tiles
T4.20: No Leaflet CSS issues — no grey tiles, no misaligned popups, zoom controls styled dark
```

---

## Phase 5: Detail Drawer + Notes + Follow-up

### What to build
See spec "Phase 5" section. DetailDrawer.tsx, NoteTimeline.tsx, FollowUpPicker.tsx, ReminderBadge.tsx.

### Tests — Phase 5

```
T5.1: Clicking a prospect (from map pin, list card) opens drawer sliding from right
T5.2: Drawer has dark backdrop overlay, clicking overlay closes drawer
T5.3: Drawer header shows: company name, status pill (coloured), priority selector, X close, delete icon
T5.4: Clicking status pill opens dropdown with all 7 statuses — selecting one saves immediately via API
T5.5: Status change reflects on map pin colour without full reload
T5.6: Status change reflects on list card and stat chips immediately
T5.7: Priority selector (high/med/low) saves on change
T5.8: Contact info section shows all fields — contact_name, contact_email (as mailto: link), contact_phone (as tel: link), company phone, generic email, website (external link), address, postcode
T5.9: "Copy Email" button copies email to clipboard, shows toast "Copied"
T5.10: Inline editing — click contact_name → becomes input → type new name → blur → saves via PUT → field updates
T5.11: Inline editing — works for ALL editable fields (name, address, postcode, phone, website, emails, contact fields)
T5.12: Inline editing — pressing Enter saves, pressing Escape cancels
T5.13: Quick action buttons are contextual:
       - Status "new" → shows "Mark Contacted", "Mark Rejected"
       - Status "contacted" → shows "Mark Follow Up", "Mark In Conversation", "Mark Not Interested"
       - Status "partner" → shows "Mark Rejected" (can undo)
T5.14: Clicking "Mark Contacted" changes status AND shows follow-up date picker
T5.15: Follow-up picker has quick buttons: +3d, +7d, +14d, +30d — clicking sets date
T5.16: Follow-up picker — custom date can be typed
T5.17: Follow-up date appears in drawer details section
T5.18: If follow-up is overdue — warning badge shows "Overdue by X days" in drawer
T5.19: Notes timeline — shows notes newest first with relative timestamps
T5.20: "Add Note" textarea + submit — new note appears at top of timeline immediately
T5.21: Delete note — X button on manual notes, confirm dialog, note disappears
T5.22: Auto-generated notes (status changes) appear in timeline with muted style, no delete button
T5.23: Reminder badge in topbar — shows bell icon with red count of overdue follow-ups
T5.24: Clicking reminder badge toggles "overdue only" filter
T5.25: Delete company — trash icon in drawer header, confirm dialog, company removed from everywhere
T5.26: "+ Add Prospect" button in topbar — opens drawer in create mode with empty fields
T5.27: Create mode — fill in fields, click Save, new prospect appears on map + list
T5.28: Drawer close — Escape key closes drawer
T5.29: Drawer transition — smooth slide animation (not instant appear/disappear)
```

---

## Phase 6: Email + List View + Kanban

### What to build
See spec "Phase 6" section. EmailModal.tsx, ListView.tsx, KanbanView.tsx, email API routes, email-templates.ts.

### Tests — Phase 6

```
EMAIL SENDING:
T6.1: "Send Intro Email" button in drawer opens email modal
T6.2: Modal pre-fills "To" from contact_email (falls back to generic_email)
T6.3: Template selector dropdown — 3 templates (Intro, Follow-Up, Partnership)
T6.4: Switching template updates subject + body
T6.5: All fields (to, subject, body) are editable before sending
T6.6: Send button shows loading spinner during send
T6.7: Successful send — toast "Email sent", modal closes, auto-note created in timeline
T6.8: Email appears in email history section (collapsible in drawer)
T6.9: Failed send — error toast, modal stays open
T6.10: Email log API returns correct history for company
T6.11: Sending to empty email shows validation error, not a crash

LIST VIEW:
T6.12: Clicking "List" in view toggle switches to table view
T6.13: Right-side list panel is hidden in list view (table IS the list)
T6.14: Table columns: status dot, name, category, contact, email, phone, priority, follow-up, updated
T6.15: Click column header to sort ascending — click again for descending
T6.16: Default sort: updated (newest first)
T6.17: Click any row → opens detail drawer
T6.18: Sticky header — scrolling down keeps headers visible
T6.19: Alternating row backgrounds for readability
T6.20: "Showing X of Y" count visible
T6.21: All sidebar filters apply to table — check "Solicitor" only, table shows only solicitors
T6.22: Search filters apply to table
T6.23: Overdue follow-up dates shown in red
T6.24: Priority badges visible (high = red/orange)

KANBAN VIEW:
T6.25: Clicking "Kanban" in view toggle switches to kanban board
T6.26: Right-side list panel is hidden in kanban view
T6.27: One column per status — column header shows status name + dot + count
T6.28: Column order: new → contacted → follow_up → in_conversation → partner → rejected → not_interested
T6.29: Cards show: company name, category tag, priority indicator
T6.30: Click card → opens detail drawer
T6.31: Overdue cards have warning-coloured left border
T6.32: Columns scroll vertically when many cards
T6.33: Board scrolls horizontally if many columns overflow
T6.34: Empty columns show a muted "No prospects" text
T6.35: Sidebar filters apply — unchecking "New" hides the new column's cards (or hides column entirely)
T6.36: Changing status in drawer moves card to correct column without page refresh
T6.37: No drag-and-drop — status only changes via drawer
```

---

## Phase 7: Heatmap + Polish

### What to build
See spec "Phase 7" section. HeatmapView.tsx + polish pass across entire app.

### Tests — Phase 7

```
HEATMAP:
T7.1: Clicking "Heatmap" in view toggle shows heatmap view
T7.2: Same Leaflet map + CartoDB Dark Matter tiles as Map view
T7.3: Heat layer visible — coloured blobs over areas with prospects
T7.4: Mode toggle in map corner: "Density" and "Activity"
T7.5: Density mode — all points contribute equally, shows geographic clusters
T7.6: Activity mode — new/untouched prospects are bright (red/warm), partners are cool (green), rejected contribute nothing
T7.7: Pins still visible under heat layer (reduced opacity)
T7.8: Right-side list panel visible in heatmap view (same as map view)
T7.9: Sidebar filters apply to heatmap — filtering out a category removes those points from heat
T7.10: Zooming in/out recalculates heat layer correctly

POLISH:
T7.11: Skeleton loading — on initial app load, content area shows skeleton placeholders (not blank)
T7.12: Skeleton loading — sidebar shows skeleton lines during data fetch
T7.13: Empty state — each view (map, list, kanban, heatmap) shows appropriate empty state when no data
T7.14: Empty state with active filters — shows "No prospects match your filters" with clear filters button
T7.15: Keyboard — Escape closes drawer from any view
T7.16: Keyboard — Enter submits note form, email form
T7.17: Transition — drawer slides smoothly (300ms ease-out, not instant)
T7.18: Transition — view switch has subtle fade/cross-fade (not jarring jump)
T7.19: Toast — success toasts auto-dismiss after 3 seconds
T7.20: Toast — error toasts persist until manually dismissed
T7.21: Confirm dialog — delete company shows "Are you sure? This cannot be undone."
T7.22: Confirm dialog — delete note shows confirmation
T7.23: Error handling — API failure shows user-friendly toast, not console error only
T7.24: Error handling — network offline shows appropriate message
T7.25: Import preview — before importing, show "Will import X new, Y duplicates will be skipped" with confirm/cancel
T7.26: Import result — toast shows "Imported X prospects, Y skipped"
T7.27: Viewport under 1024px — shows "Use desktop for best experience" overlay/message
T7.28: No console errors in any view during normal usage
T7.29: All interactive elements have hover states
T7.30: All buttons have active/pressed states (subtle scale or darken)
T7.31: Focus rings visible on keyboard navigation (not on mouse click)
T7.32: Map zoom controls styled to match dark theme

DEPLOYMENT:
T7.33: npm run build — exits 0, no errors
T7.34: Production D1 — schema applied, seed categories inserted
T7.35: Deployed to Cloudflare Pages — login works
T7.36: Deployed — import 5 test prospects, verify all 4 views work
T7.37: Deployed — send test email via Resend (check Resend dashboard for delivery)
T7.38: Deployed — export data, verify JSON is complete and valid
```

---

## Test Data Generator

After Phase 2 is complete, use this command to seed realistic Bristol-area test data:

```bash
COOKIE=$(curl -s -D - -X POST http://localhost:4321/api/auth/login \
  -H "Content-Type: application/json" -d '{"password":"testpass123"}' 2>&1 | grep -i set-cookie | sed 's/.*set-cookie: //i' | cut -d';' -f1)

curl -s -b "$COOKIE" -X POST http://localhost:4321/api/import \
  -H "Content-Type: application/json" \
  -d '[
    {"name":"Blake Morgan LLP","category":"Solicitor","address":"One Glass Wharf, Bristol","postcode":"BS2 0ZX","lat":51.4513,"lng":-2.5879,"phone":"0117 929 0381","website":"https://blakemorgan.co.uk","contact_name":"Richard Blake","contact_email":"r.blake@blakemorgan.co.uk","status":"partner","priority":"high","source":"deep_research","notes":"Active referral partner since Jan 2026. Handles residential conveyancing."},
    {"name":"Barcan+Kirby","category":"Solicitor","address":"Midland Bridge Road, Bath","postcode":"BA1 2HQ","lat":51.3811,"lng":-2.3614,"phone":"0117 325 2929","website":"https://barcankirby.co.uk","generic_email":"info@barcankirby.co.uk","contact_name":"Sarah Williams","contact_email":"s.williams@barcankirby.co.uk","status":"contacted","priority":"high","source":"deep_research","notes":"Large practice, 3 partners. Sent intro email Mar 22."},
    {"name":"St Monica Trust","category":"Nursing Home","address":"Cote Lane, Westbury-on-Trym","postcode":"BS9 3UN","lat":51.4892,"lng":-2.6158,"phone":"0117 949 4000","website":"https://stmonicatrust.org.uk","generic_email":"enquiries@stmonicatrust.org.uk","status":"new","priority":"medium","source":"deep_research","notes":"Large elderly care provider with multiple sites in Bristol."},
    {"name":"Connells","category":"Estate Agent","address":"Whiteladies Road, Clifton","postcode":"BS8 2PH","lat":51.4619,"lng":-2.6084,"phone":"0117 946 6222","website":"https://connells.co.uk","status":"new","priority":"low","source":"deep_research"},
    {"name":"Ocean Estate Agents","category":"Estate Agent","address":"Gloucester Road, Bristol","postcode":"BS7 8TZ","lat":51.4728,"lng":-2.5913,"phone":"0117 942 4881","website":"https://oceanestateagents.com","contact_name":"Mike Davies","contact_email":"mike@oceanestateagents.com","status":"contacted","priority":"medium","notes":"Spoke on phone, interested but busy until April."},
    {"name":"TW Surveyors","category":"Surveyor","address":"Baldwin Street, Bristol","postcode":"BS1 1RU","lat":51.4524,"lng":-2.5946,"phone":"0117 930 4422","website":"https://twsurveyors.co.uk","contact_name":"Tom Wilson","contact_email":"tom@twsurveyors.co.uk","status":"rejected","priority":"medium","notes":"Not interested in referral partnerships at this time."},
    {"name":"Burges Salmon","category":"Solicitor","address":"One Glass Wharf, Bristol","postcode":"BS2 0ZX","lat":51.4518,"lng":-2.5873,"phone":"0117 939 2000","website":"https://burges-salmon.com","contact_name":"David Allen","contact_email":"david.allen@burges-salmon.com","status":"follow_up","priority":"high","notes":"Had initial call, positive. Need to send proposal."},
    {"name":"Savills Bristol","category":"Estate Agent","address":"Queens Road, Clifton","postcode":"BS8 1QE","lat":51.4568,"lng":-2.6034,"phone":"0117 933 5800","website":"https://savills.co.uk","contact_name":"Emma Ross","contact_email":"eross@savills.com","status":"in_conversation","priority":"high","notes":"Met at networking event. Very interested in bulk removals for property portfolio."},
    {"name":"Brunelcare","category":"Nursing Home","address":"Saffron Gardens, Prospect Place","postcode":"BS5 6UL","lat":51.4582,"lng":-2.5682,"phone":"0117 914 4200","website":"https://brunelcare.org.uk","generic_email":"info@brunelcare.org.uk","status":"new","priority":"medium","source":"deep_research","notes":"Charity-run elderly care homes across Bristol and surrounding areas."},
    {"name":"CJ Hole","category":"Estate Agent","address":"Whiteladies Road, Bristol","postcode":"BS8 2PY","lat":51.4625,"lng":-2.6089,"phone":"0117 923 7770","website":"https://cjhole.co.uk","status":"new","priority":"low","source":"deep_research"},
    {"name":"Gregg Latchams","category":"Solicitor","address":"College Green, Bristol","postcode":"BS1 5TH","lat":51.4531,"lng":-2.6006,"phone":"0117 906 9400","website":"https://gregglatchams.com","generic_email":"mail@gregglatchams.com","status":"not_interested","priority":"low","notes":"Called twice, no response. Moving to not interested."},
    {"name":"Beech Homes Conveyancing","category":"Conveyancer","address":"Henleaze Road, Bristol","postcode":"BS9 4JP","lat":51.4834,"lng":-2.6045,"phone":"0117 962 1205","contact_name":"Alison Beech","contact_email":"alison@beechhomes.co.uk","status":"in_conversation","priority":"medium","notes":"Specialises in first-time buyer conveyancing. Good referral potential."},
    {"name":"Bristol Care Homes","category":"Nursing Home","address":"Filton Road, Horfield","postcode":"BS7 0PA","lat":51.4801,"lng":-2.5889,"phone":"0117 951 3200","generic_email":"admin@bristolcarehomes.co.uk","status":"new","priority":"high","source":"deep_research","notes":"5 care homes in North Bristol. High volume of resident moves."},
    {"name":"Andrews Estate Agents","category":"Estate Agent","address":"North Street, Bedminster","postcode":"BS3 1EN","lat":51.4432,"lng":-2.5952,"phone":"0117 963 5151","website":"https://andrewsonline.co.uk","contact_name":"Phil Andrews","status":"contacted","priority":"medium","notes":"Left message with office manager."},
    {"name":"Stage It Bristol","category":"Home Staging","address":"Stokes Croft, Bristol","postcode":"BS1 3QY","lat":51.4596,"lng":-2.5907,"phone":"07700 123456","website":"https://stageitbristol.co.uk","contact_name":"Clare Matthews","contact_email":"clare@stageitbristol.co.uk","status":"new","priority":"medium","source":"manual","notes":"New home staging company, could be interesting for removals cross-referrals."}
  ]'
```

This gives 15 prospects across 6 categories, all 7 statuses, mixed priorities, with and without contact details, clustered around Bristol — ideal for testing all views, filters, and features.
