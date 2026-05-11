# Quote / Proposal Tool — implementation plan

Branch: `claude/quote-proposal-tool-AXE9R`
Status: tervezés, kód még nincs

---

## 0. Helyzetfelmérés (mi van már a repó-ban)

Ez a repó **maga a Painless CRM** — nem külön app. Tehát ami a spec
"Phase A standalone build"-ként szerepelt, valójában egyszerűsödik:
nem kell külön Worker preview URL, mert az auth, a D1, a Resend
integráció már a kezünkben van.

Ami már megvan és újra fogjuk használni:

| Komponens | Hol | Mit ad |
| --- | --- | --- |
| Astro 6 + React 19 SSR | `astro.config.mjs` | UI + API routes egy projektben |
| Cloudflare Workers adapter | `@astrojs/cloudflare` | deploy target |
| D1 (`b2bpainless`) | `wrangler.toml`, `schema.sql` | quote-okhoz új táblák ide |
| KV (`SESSION`) | `wrangler.toml` | session store (Astro miatt kötelező) |
| HMAC signed cookie auth | `src/middleware.ts`, `src/lib/auth.ts` | a quote feature-t is ez gating-eli |
| Resend SDK | `src/pages/api/email/send.ts` | küldés meglevő pattern |
| Companies / contacts / notes / email_log / activity_log | `schema.sql` | FK-zhetünk hozzájuk |

Ami **nincs** és a Phase A elindításához kell:
- `painless-proposal-editor.html` prototype (a spec hivatkozza, de a repó-ba nincs commit-olva — be kell hozni)
- R2 bucket (PDF archív)
- Browser Rendering API binding (PDF generálás)
- Workers Paid plan (Browser Rendering előfeltétele)
- Resend webhook secret + a domain (`painlessremovals.com`) verified-e
- A 4 sender alias (`jay@`, `richard@`, `quotes@`, `hello@`) verified-e

Ezekre az open question szekció lent visszatér.

---

## 1. Stratégia — egy repó, Phase A in-tree, Phase B inkrementális

A spec Phase A / Phase B felosztása értelmes, de mivel ez a CRM repó:

**Phase A (most):** a feature itt épül, a meglévő HMAC auth alatt,
`/quotes` namespace alatt, **saját adatmodelljével izoláltan**
(külön táblák, nem nyúlunk a `companies`-be). A Resend és a session
infrastruktúra megosztott. A landing-flag-et az értékesítő a
meglévő login-jával éri el — nincs külön PIN.

**Phase B (második kör):** UI integráció a meglévő ProspectApp-be —
"Quotes" tab a company detail drawer-en, a quote → company FK aktiválása
a UI-ban is, esetleg a deal value együtt megjelenítése. Az adatmodell már
Phase A-ban ezt támogatni fogja, csak a UI nem köti be.

**Miért így:**
- A spec Phase A "izoláltan" kifejezése azért volt, hogy ne kelljen
  CRM-ismeret előre — de mi vagyunk a CRM repó, ez nem áll fenn.
- Külön Worker preview-t felépíteni, majd átmigrálni dupla munka. Egy
  helyen építjük, namespace-elve.
- Az integration point-okat akkor is izoláltan kell tartani (külön
  `src/quotes/` mappa, nem szétszórva), hogy Phase B refactor olcsó
  legyen.

---

## 2. Adatmodell

Új SQL migráció `scripts/quotes-schema.sql` néven (a meglévő pattern
alapján). Új tábla nem nyúl a `companies`/`contacts`/`email_log`
táblákhoz.

```sql
-- Quote rekordok
CREATE TABLE IF NOT EXISTS quotes (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL,                -- pl. 'logistics-proposal'
  company_id TEXT REFERENCES companies(id) ON DELETE SET NULL,
  contact_id TEXT REFERENCES contacts(id) ON DELETE SET NULL,
  recipient_email TEXT,                     -- snapshot send time-ban
  recipient_name TEXT,
  sender_alias TEXT,                        -- 'jay'|'richard'|'quotes'|'hello'
  subject TEXT,                             -- elküldött email subject
  message_body TEXT,                        -- elküldött email body
  field_data TEXT NOT NULL DEFAULT '{}',    -- JSON: mező-id → érték
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK(status IN (
      'draft','sent','opened','clicked','replied','won','lost','expired'
    )),
  deal_value_pence INTEGER,                 -- won esetén, GBP pence-ben
  pdf_r2_key TEXT,                          -- elküldött PDF helye
  resend_message_id TEXT,                   -- webhook map-eléshez
  tracking_token TEXT UNIQUE,               -- click redirect-hez
  tracking_enabled INTEGER NOT NULL DEFAULT 1,
  created_by TEXT,                          -- 'admin' egyelőre
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  sent_at TEXT,
  first_opened_at TEXT,
  last_activity_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_quotes_company_id ON quotes(company_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
CREATE INDEX IF NOT EXISTS idx_quotes_resend_message_id ON quotes(resend_message_id);
CREATE INDEX IF NOT EXISTS idx_quotes_tracking_token ON quotes(tracking_token);

-- Append-only audit log
CREATE TABLE IF NOT EXISTS quote_events (
  id TEXT PRIMARY KEY,
  quote_id TEXT NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,                 -- created|edited|sent|opened|clicked|replied|status_changed|bounced|complained
  payload TEXT,                             -- JSON: ip/ua/url/from_status/to_status stb.
  occurred_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_quote_events_quote_id ON quote_events(quote_id, occurred_at);
```

**Nem** csinálunk külön `quote_templates` táblát — a template-ek
fájl-szintűek (lásd 3. szekció). Ha kell metadat, az a template
mellé tett `meta.json`-ben él.

**Field-data tárolás:** JSON blob a `field_data` oszlopban. A
template definíciója adja a sémát; a quote csak (field_id → string)
mapet tárol. Ez azért OK, mert (a) a séma maga is verzió-tényező a
template-en, (b) D1-ben JSON storage olcsó, (c) nincs cross-quote
query-zés mezőszinten.

---

## 3. Template rendszer

**Cél:** új template hozzáadása fájl-szintű művelet, nem CRM-átépítés.

```
src/quote-templates/
  logistics-proposal/
    template.html       # a teljes HTML, embedded CSS, fontok, képek
    meta.json           # template metadata
    assets/             # opcionális, ha külön asset fájl kell
```

**`meta.json`** példa:

```json
{
  "id": "logistics-proposal",
  "name": "Logistics Proposal",
  "default_subject": "Logistics proposal from Painless Removals",
  "default_body": "Hi {{recipient_first_name}},\n\nPlease find attached our logistics proposal...",
  "fields": [
    {
      "id": "client_name",
      "label": "Client name",
      "group": "Header",
      "type": "text",
      "default": "ACME Logistics Ltd"
    },
    {
      "id": "intro_paragraph",
      "label": "Intro paragraph",
      "group": "Introduction",
      "type": "textarea",
      "default": "We're delighted to present this proposal..."
    }
    // ... ~80 field, 24 group
  ]
}
```

**Hogyan jön a `meta.json` a prototype-ból:**
- A prototype-ban `data-quote-field="<id>"` attribútumok vannak
  (vagy egyenértékű marker). Ezekből egy egyszeri extract-script
  (`scripts/extract-template.mjs`) kihúzza:
  - `field.id` = az attribútum értéke
  - `field.default` = a marker-en belüli szöveg
  - `field.group` = közvetlen szülő `<section data-quote-group="...">`
  - `field.type` = `textarea` ha `<p>`/`<div>`, `text` ha `<span>`/`<h*>`
- A futtatás után **ember kell hogy átnézze** — a brand-szövegeket
  verbatim kell preservelni, és a group/label-eket csiszolni kell.
- A template.html-ben a marker-eket meghagyjuk; render time-ban
  csak a marker-ek belsejét cseréljük.

**Render-pipeline:**
1. Server betölti `template.html`-t (Cloudflare Worker `import …?raw`
   trükkel vagy KV-ben tárolva — lásd 11. szekció)
2. A `field_data` JSON-ből minden marker-be beilleszti az értéket
   (HTML escape-elve)
3. A resulting HTML mind a (a) live preview iframe, (b) PDF render,
   (c) végleges archív PDF közös forrása

**Új template hozzáadása később:**
1. Új mappa `src/quote-templates/<id>/`
2. `template.html` az új marker-ekkel
3. `meta.json` mező-listával (akár az extract-scriptből)
4. Rebuild + deploy — automatikusan megjelenik a "new quote" template
   pickerben (a loader filesystem-ből listáz)

---

## 4. PDF generálás

**Engine:** Cloudflare Browser Rendering API (`@cloudflare/puppeteer`).
Egyetlen reális opció Workers-on belül.

```ts
import puppeteer from '@cloudflare/puppeteer';
// wrangler.toml: [browser] binding = "BROWSER"

const browser = await puppeteer.launch(env.BROWSER);
const page = await browser.newPage();
await page.setContent(renderedHtml, { waitUntil: 'networkidle0' });
const pdf = await page.pdf({
  format: 'A4',
  printBackground: true,
  preferCSSPageSize: true,
});
await browser.close();
```

**A "pixel-perfect, byte-egyenlő PDF" realitása:**

A spec kéri hogy "ugyanaz a HTML ugyanazt a byte-szintű PDF-et adja".
Ez **nem teljesíthető** Browser Rendering-en — a Chromium PDF
metaadatban tartalmaz timestamp-et és object id-kat, amik run-onként
változnak. Amit reálisan garantálunk:

1. **Vizuális stabilitás** — ugyanaz a HTML ugyanúgy néz ki
   (pixel-equal a tartalom, csak a metaadat tér el)
2. **Determinisztikus tartalom** — minden font, kép, asset
   embedded a HTML-be; nincs network call render time-ban
   (`waitUntil: 'networkidle0'` ezt önteszteli, de a HTML eleve
   nem hivatkozik external resource-ra)
3. **Idempotens archiválás** — az első sikeres render PDF-jét
   R2-ben őrizzük, és az **az** PDF megy minden recipient-nek.
   Tehát "minden recipient ugyanazt a PDF-et kapja" garantált
   byte-szinten, mert csak egyszer render-elünk per quote-send.

**Send-time flow:**
1. `POST /api/quotes/:id/send` érkezik
2. HTML render template + field_data-ból
3. (Opcionális) preview endpoint ugyanezt használja a modal-ban
4. PDF render → R2 put → `pdf_r2_key` rögzítve a quote-on
5. Resend-nek küldés a PDF-fel mint attachment (base64-ben a body-ban)
6. `resend_message_id` és `sent_at` mentve, `status = 'sent'`
7. `quote_events`-be `sent` event

**Guardrail-ek hibás template ellen:**
- Render után pre-flight check: `page.evaluate(() => document.body.scrollHeight)`
  össze nem lehet kisebb mint X (üres render detektálás)
- PDF byte-méret sanity check (>50KB, <5MB)
- Field-data validáció: ha a template megkövetel egy mezőt
  (`meta.json` `required: true`), és nincs kitöltve, 422-vel áll meg
  küldés előtt
- Send modal-ban a PDF preview az utolsó vizuális ellenőrzés

**Olvasó-kompatibilitás:**
- A Chromium PDF kimenete jó Adobe/Preview/PDF.js/Chrome-mal
- A **Samsung Android built-in** a legkényesebb: nem támogat egyes
  CMYK/transparency feature-öket. Konkrét tesztre Phase A QA része:
  küldjünk pár test-quote-ot Samsung eszközre, ha bugs, akkor
  `page.pdf({…, omitBackground: false, format: 'A4'})` kiegészítve
  CSS-szinten kerüljük az `opacity` / `mix-blend-mode` használatát
  a template-ben

---

## 5. Routes és endpointok

Mind az új API route `src/pages/api/quotes/` alá, a UI page-ek
`src/pages/quotes/` alá. A meglévő middleware HMAC auth ezeket
automatikusan védi (kivéve a webhook + tracking redirect, ld. lent).

### API

| Method | Path | Mit csinál |
| --- | --- | --- |
| `GET` | `/api/quote-templates` | list available templates |
| `GET` | `/api/quotes` | list, query param: `?status=&limit=&offset=` |
| `POST` | `/api/quotes` | új draft, body: `{ template_id, company_id?, contact_id? }` |
| `GET` | `/api/quotes/:id` | egy quote teljes adata + events |
| `PATCH` | `/api/quotes/:id` | autosave: `{ field_data, recipient_email?, ... }` |
| `POST` | `/api/quotes/:id/reset` | field_data-t a template default-ra állítja |
| `GET` | `/api/quotes/:id/preview-pdf` | PDF render (cache-elhető) |
| `POST` | `/api/quotes/:id/send` | render + Resend send + state machine |
| `POST` | `/api/quotes/:id/status` | manuális status change (replied/won/lost/expired) |
| `GET` | `/api/quotes/:id/events` | timeline JSON |

### Public (auth nélkül, signed token-nel)

| Method | Path | Mit csinál |
| --- | --- | --- |
| `POST` | `/api/webhooks/resend` | Resend webhookok — open, click, bounce, complaint |
| `GET` | `/r/:token` | tracking redirect a PDF linkjeihez |

A `middleware.ts`-t bővítjük: `/api/webhooks/resend` és `/r/` allow-listed
(úgy mint a `/login`).

### Pages

| Path | Mit csinál |
| --- | --- |
| `/quotes` | list view, status filterekkel |
| `/quotes/new` | template picker |
| `/quotes/:id/edit` | split-pane editor (form + iframe preview) |
| `/quotes/:id` | read-only detail + timeline + status actions |

---

## 6. Editor UI

Két oszlop:

**Bal — form panel (React)**
- Group accordionok (24 db, ld. `meta.json`)
- Mező típus szerinti input (`text` → `<input>`, `textarea` → `<textarea>`)
- Reset gomb per-mező (visszaállít template default-ra)
- Save indicator a header-ben (pending / saved Xs ago)
- Auto-save: debounce 800ms, `PATCH /api/quotes/:id` küldés
- Recipient email + contact picker (company-hez linkelt contact-okból
  kiválasztható, vagy manuális)
- "Send" gomb a header-ben

**Jobb — preview**
- `<iframe>` ami a `/api/quotes/:id/preview` route-ra mutat
  (HTML preview, nem PDF — gyorsabb)
- Field change → iframe content reload (debounced)
- Optional: `postMessage`-en át részleges DOM update (nice-to-have, később)

**Resume másik gépről:** mivel autosave szerverre megy és nem
böngésző local-ba, ez automatikusan működik. Csak nyissa meg
ugyanazt a `/quotes/:id/edit` URL-t.

---

## 7. Send modal

A send gomb megnyit egy modal-t:

```
┌────────────────────────────────────────────┐
│ Send quote                                 │
├────────────────────────────────────────────┤
│ To:        [recipient@example.com    ]     │
│ From:      [Jay <jay@...>          ▾]      │
│              (Jay / Richard / quotes@      │
│               / hello@)                    │
│ Subject:   [Logistics proposal from...]    │
│ Message:   [Hi {{first_name}}, ...     ]   │
│            [                            ]   │
│ [x] CC me on this send                     │
│ [x] Track opens and clicks                 │
│                                            │
│ ─── PDF preview ─────────────────────────  │
│ │                                       │  │
│ │   [Embedded PDF preview iframe]       │  │
│ │                                       │  │
│ ─────────────────────────────────────────  │
│                                            │
│              [ Cancel ]    [ Send → ]      │
└────────────────────────────────────────────┘
```

- Subject / message default-jai a template `meta.json`-jából, a
  field-data értékek behelyettesítve (`{{recipient_first_name}}` stb.)
- Sender alias-ok hard-coded listából (`SENDERS` const), de a
  domain Resend-ben verified kell legyen
- CC me → a logged-in user email-jét adja hozzá (Phase A: env-ben
  beállítva, mivel egyelőre 1 user van)
- Tracking opt-out → ha unchecked, a PDF link-ek nem mennek át
  trackeren és a Resend `tracking: { opens: false, clicks: false }`
- PDF preview iframe a render-elt PDF-et mutatja R2 nélkül
  (in-memory, send-előtt) — utolsó védvonal

---

## 8. Tracking & státusz state machine

```
        ┌────────┐  send   ┌──────┐  webhook  ┌────────┐  webhook  ┌─────────┐
        │ draft  │ ──────▶ │ sent │ ────────▶ │ opened │ ────────▶ │ clicked │
        └────────┘         └──────┘           └────────┘           └─────────┘
                              │                  │                     │
                              │ (manuális, bárhonnan):                  │
                              ▼                  ▼                     ▼
                          ┌──────────────────────────────────────────────┐
                          │  replied / won / lost / expired              │
                          └──────────────────────────────────────────────┘
```

**Auto** (Resend webhookok):
- `email.opened` → ha `status` ∈ {sent}, → opened
- `email.clicked` → ha `status` ∈ {sent, opened}, → clicked
- `email.bounced` → `quote_events` `bounced` (status nem változik
  automatikusan, de jelezzük UI-ban)
- `email.complained` → `quote_events` `complained`
- Minden esemény mindenképp `quote_events` rekord, akkor is ha a
  status nem mozdul

**Manuális** (értékesítő UI-ból):
- `replied` — egyetlen kattintás
- `won` → prompt deal value (£), elmentve `deal_value_pence`-be
- `lost` → opcionális reason text → `quote_events.payload`
- `expired` → akár cron-ból is jöhet (későbbi nice-to-have);
  Phase A: manuális

**Webhook → quote map:**
- Send-kor a `resend_message_id`-t mentjük
- Webhook payload `email_id` mezője ezt visszahozza
- Ha nem találunk match-et: log, drop

**Click tracking PDF linkeken:**
- Render time-ban minden `<a href>`-t átírunk:
  `https://<host>/r/<token>?u=<base64-encoded-original>`
- A `/r/:token` route logol `clicked` event-et + 302 redirect

**GDPR / IP:**
- `quote_events.payload`-ban tárolunk IP + UA-t a Resend payload alapján
- Spec flag-eli — ezt egy `tracking_enabled` quote-szintű kapcsolóval
  is le lehet kapcsolni send-időben
- Recipient-számára nincs egyedi külön ToS — a sales-context elég

---

## 9. Quote list view (Phase A)

`/quotes` page:
- Táblázat: recipient, template, status badge, last_activity_at,
  sent_at, deal value (ha won)
- Filter: status multi-select
- Search: recipient_email / company name LIKE
- Click → `/quotes/:id` (read-only ha sent, edit ha draft)

Phase B: ez a view minimalizálódik vagy eltűnik, ahogy a CRM
company/contact detail view-jában megjelennek a quote-ok.

---

## 10. Quote timeline view

`/quotes/:id` page alján:

```
●  Created — 2026-05-11 10:23 by Jay
●  Edited (×7) — last 2026-05-11 11:14
●  Sent to client@example.com — 2026-05-11 11:20
○  Opened — 2026-05-11 14:32 (London, Mozilla/5.0…)
○  Opened — 2026-05-11 14:33
○  Clicked link → painlessremovals.com/services — 2026-05-11 14:35
●  Status: won (£12,400) — 2026-05-12 09:00 by Jay
```

- Egy SQL query a `quote_events` táblából, occurred_at szerint
- Az `edited` event-eket aggregáljuk (n× last X) hogy ne robbantsa a UI-t

---

## 11. Fájl szervezés (új mappák)

```
src/
  quotes/                          # új namespace
    types.ts                       # Quote, QuoteEvent, Template típusok
    db.ts                          # D1 queries (CRUD + events)
    renderer.ts                    # HTML render: template + field_data → HTML
    pdf.ts                         # Browser Rendering wrapper
    send.ts                        # Resend send + attachment
    tracking.ts                    # rewriteLinks(), webhook handler
    status.ts                      # state machine, allowed transitions
    templates.ts                   # loader: getTemplate(id), listTemplates()
  quote-templates/
    logistics-proposal/
      template.html
      meta.json
  components/
    QuoteApp/                      # az editor UI
      QuoteList.tsx
      QuoteEditor.tsx
      QuoteFieldForm.tsx
      QuotePreview.tsx
      SendModal.tsx
      Timeline.tsx
      StatusBadge.tsx
  pages/
    quotes/
      index.astro                  # list
      new.astro                    # template picker
      [id]/
        edit.astro                 # editor
        index.astro                # read-only + timeline
    api/
      quotes/
        index.ts                   # GET list, POST create
        [id].ts                    # GET, PATCH
        [id]/
          reset.ts
          send.ts
          status.ts
          events.ts
          preview-pdf.ts
      quote-templates/
        index.ts                   # GET list templates
      webhooks/
        resend.ts                  # webhook receiver
    r/
      [token].astro                # click tracker redirect
docs/
  quote-tool-plan.md               # ez a dokumentum
  adding-a-template.md             # új template recipe
scripts/
  quotes-schema.sql                # új migráció
  extract-template.mjs             # prototype HTML → meta.json one-off
```

**Template HTML betöltés Worker-ben:**
- Vite `?raw` import: `import templateHtml from '../quote-templates/logistics-proposal/template.html?raw'`
- Build-be bundle-ölődik, runtime cost ~0
- Új template = új import (vagy dinamikus map a template-loader-ben)
- A `meta.json`-t standard JSON import-tal hozzuk be

---

## 12. wrangler.toml változások

```toml
# Új: R2 bucket a PDF archívhoz
[[r2_buckets]]
binding = "QUOTE_PDFS"
bucket_name = "painless-quote-pdfs"

# Új: Browser Rendering binding (Workers Paid plan kell)
[browser]
binding = "BROWSER"
```

Új titkok (`wrangler secret put`):
- `RESEND_WEBHOOK_SECRET` — Resend webhook signature verify-hez
- (Új sender alias-ok nem kell hogy külön titok legyenek — Resend-ben
  verified domain-en belül bármi mehet)

Az `env.d.ts` bővül `QUOTE_PDFS: R2Bucket`, `BROWSER: Fetcher`,
`RESEND_WEBHOOK_SECRET: string` mezőkkel.

---

## 13. Auth / security

**Phase A:** a meglévő `verifySession` HMAC middleware védi a
`/quotes/**` és `/api/quotes/**` path-okat. Nincs külön PIN.
A spec-ben szereplő "PIN ha még nincs CRM auth" felvetés nem áll
fenn — a CRM auth itt van.

**Public route-ok (auth nélkül):**
- `/api/webhooks/resend` — Resend signature verify (`Resend-Signature` header
  HMAC-SHA256 a `RESEND_WEBHOOK_SECRET`-tel)
- `/r/:token` — a token önmaga signed (HMAC, `SESSION_SECRET` re-use vagy
  külön `TRACKING_SECRET`)

**Search engine isolation:**
- `<meta name="robots" content="noindex,nofollow">` minden `/quotes/**`
  page-en és `/r/**` route-on
- `robots.txt` (új `public/robots.txt`) explicit disallow ezekre
- Spec szerint a quote URL-jei nem indexelhetők — ezt egyszerű ezzel
  garantálni; a route-ok auth alatt vannak amúgy is

---

## 14. Open questions a spec-ből + javaslat

| # | Kérdés | Javaslat |
| --- | --- | --- |
| 1 | Resend domain verified a painlessremovals.com-ra? | Le kell ellenőrizni a Resend dashboardon implementálás előtt. Ha nem, DNS előbb |
| 2 | Workers Paid plan ($5/hó) OK? | Browser Rendering nélkül nincs PDF — szükséges |
| 3 | Új repo vagy CRM repo? | **Ez a CRM repo** — itt épül, nincs új repo |
| 4 | Subdomain `quote.painlessremovals.com`? | Mivel itt épül, ugyanazon a Worker-en él. Külön subdomain később opcionális; egyelőre `<crm-host>/quotes` |
| 5 | Initial PIN? | Nincs PIN — meglévő CRM auth |
| 6 | R2 retention? | Forever — pár cent/hó, audit-érték magas |
| 7 | IP+UA capture GDPR? | Standard, megtartjuk, `tracking_enabled` flag-gel send-szinten letiltható |

---

## 15. Mit kell hogy odaadj mielőtt kód elkezdődik

1. **`painless-proposal-editor.html`** — a prototype file. A spec
   hivatkozza, de a repó-ban nincs. Ezt commit-olni kell ide
   (akár `docs/prototypes/painless-proposal-editor.html` alá), hogy
   az extract-script futtatható legyen és a default szövegek
   verbatim átkerüljenek
2. **A 4 sender alias konfirmálva** Resend-ben (`jay@`, `richard@`,
   `quotes@`, `hello@` painlessremovals.com)
3. **Workers Paid plan upgrade** (vagy konfirmálva hogy már Paid)
4. **R2 bucket létrehozva** és bucket-name beírva wrangler.toml-ba
5. **Resend webhook endpoint URL** dashboardon beállítva (a deploy
   után tudjuk a végleges URL-t — első deploy után állítjuk be)

---

## 16. Milestones / tasks (sorrendben)

Minden milestone-on PR-méretű, deploy-able állapot.

### M1 — fundament (1 PR)
- Új SQL séma `scripts/quotes-schema.sql` + migráció futtatása
- `src/quotes/types.ts`, `db.ts` (CRUD + events table API)
- `wrangler.toml`: R2 bucket binding + Browser Rendering binding
- `env.d.ts` bővítés
- Stub `/quotes` page (csak hello world auth mögött)

### M2 — template rendszer (1 PR)
- Prototype HTML beemelése `docs/prototypes/`
- `scripts/extract-template.mjs` (egyszer fut)
- `src/quote-templates/logistics-proposal/{template.html,meta.json}`
- `src/quotes/templates.ts` — loader
- `src/quotes/renderer.ts` — field substitution
- `GET /api/quote-templates` endpoint
- `docs/adding-a-template.md` recipe

### M3 — draft + editor UI (1 PR)
- `POST /api/quotes`, `GET /api/quotes/:id`, `PATCH /api/quotes/:id`,
  `POST /api/quotes/:id/reset`
- `src/components/QuoteApp/QuoteEditor.tsx` (form + iframe preview)
- `src/pages/quotes/new.astro` (template picker)
- `src/pages/quotes/[id]/edit.astro`
- Live preview iframe HTML endpoint
- Autosave debounce flow
- `quote_events`: `created`, `edited`

### M4 — PDF generálás (1 PR)
- `src/quotes/pdf.ts` — Browser Rendering wrapper
- `GET /api/quotes/:id/preview-pdf` (in-memory render)
- Guardrails: empty render detect, size sanity, required-field check
- Manual QA: Adobe Reader, Apple Preview, Chrome, Samsung Android

### M5 — send flow (1 PR)
- `src/components/QuoteApp/SendModal.tsx` (PDF preview iframe-mel)
- `POST /api/quotes/:id/send` — render → R2 put → Resend send
- Sender alias picker, CC me, tracking opt-out
- `quote_events`: `sent`
- Email log integráció: `email_log`-ba is bekerül egy row (a meglévő
  pattern szerint), `note`-t **nem** csinálunk auto (quote saját timeline-ja
  redundáns lenne)

### M6 — tracking + webhooks (1 PR)
- `POST /api/webhooks/resend` — signature verify + event ingest
- `GET /r/:token` — click redirect
- Link rewrite a renderer-ben
- Middleware allow-list update
- Status state machine: `sent → opened → clicked`
- `quote_events`: `opened`, `clicked`, `bounced`, `complained`

### M7 — manual outcomes + list + timeline (1 PR)
- `POST /api/quotes/:id/status` (replied/won/lost/expired)
- Won prompt: deal value modal
- `src/pages/quotes/index.astro` (list + filter)
- `src/pages/quotes/[id]/index.astro` (read-only + timeline + status actions)
- `src/components/QuoteApp/Timeline.tsx`

### M8 — polish + QA (1 PR)
- robots.txt + noindex meta tag
- Email subject/body templating (`{{recipient_first_name}}` etc.)
- Empty state UI, error toasts
- Samsung PDF QA round 2 ha kellett
- Cron job javaslata `expired`-re (manuális marad Phase A-ban)

### Phase B (későbbi körök, külön branch)
- Company detail drawer "Quotes" tab
- Contact-picker integráció (`contact_id` FK használata send-time-ban)
- Deal pipeline view a `won` quote-okból
- Quote list view minimalizálva (vagy eltüntetve)
- CRM design system átvétel a Quote editor-re

---

## 17. Kockázatok

| Kockázat | Hatás | Mitigáció |
| --- | --- | --- |
| Browser Rendering cold start (~1-3s) | Send modal várakozás | Loading state a send button-on; preview is async |
| Resend webhook out-of-order | `clicked` event előbb mint `opened` | A státusz state machine engedi a "leveléshez" (opened → clicked); events tábla maga az igazság, status csak derived |
| Samsung Android PDF reader | Hibás megjelenítés | M4 végén explicit QA; CSS-ben kerülni: `opacity`, `mix-blend-mode`, custom font-fallback |
| Verbatim wording sérülés a template extractálásnál | Brand-szöveg romlás | Az extract script után **emberi review** a `meta.json` default mezőkön; git diff a prototype HTML és a `template.html` között null-szinten map-elhető |
| "Byte-identikus PDF" elvárás | Spec nem teljesíthető literal-szinten | Komm: archív PDF egyszer render-elődik, az megy mindenkinek → byte-egyenlő recipient-ek között. Re-render between sessions: nem garantált, de nem is kell |
| Worker request timeout (30s burkolt CPU, 1min wall) PDF render-en | Send fail | Render-t async-szerűen kezeljük: ha >20s, queue-ra rakjuk és status-t `sending`-re tesszük (Phase A-ban valószínűleg nem szükséges, de M4 QA-ban mérendő) |
| Field schema változik mikor már léteznek quote-ok | Old quote field-ek elvesznek | `field_data` JSON megőrzi az összes mezőt, akkor is ha a template újabb verziójában már nincs; render time-ban ignoráljuk a ismeretlen mezőket |

---

## 18. Mit **nem** csinálunk Phase A-ban

- Nincs UI template-szerkesztő (a spec szerint sem kell)
- Nincs multi-template per quote (1 quote = 1 template)
- Nincs quote duplikálás / "save as template" funkció
- Nincs revízió-történet a field_data-n (a `quote_events.edited` count-ot
  tárolja, de nem a diff-et)
- Nincs cron-alapú `expired` auto-transition (manuális)
- Nincs i18n — minden EN
- Nincs reminder a `sent → no open after N days` küszöbre
- Nincs A/B test, link click heatmap stb.

Ezek mind Phase B vagy későbbi backlog tételek.

---

## 19. Következő lépés

Ha ez a terv jó:

1. **Te:** commit-old a `painless-proposal-editor.html` prototype-ot
   ide (vagy küldd át), és válaszolj a 15. szekció checklist-jére
2. **Én:** elkezdem M1-et — sémát + bindings + stub page-eket egy
   külön commit-ban a `claude/quote-proposal-tool-AXE9R` branch-en

Ha valami megközelítésen változtatni akarsz (más adat-séma, más
mappastruktúra, más Phase A scope), most a legolcsóbb módosítani.
