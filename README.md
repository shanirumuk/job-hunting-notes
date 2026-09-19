# Job notebook

A mobile-first job discovery and application notebook with bottom navigation, a viewport-sized swipe deck, persistent decision buttons and full-width detail sheets on phones. Browse a ranked deck, swipe left to pass, save for later, or swipe right to open the source listing directly. The CV choice and optional draft are saved in the background. Full role text appears under “Why this fits”; the header info icon contains uncertain requirements.

The labelled **Refresh** button in the header checks for a new app shell and service worker, then reloads with a fresh URL. It preserves saved applications, profile and CV PDFs. Offline failures leave the current app open. The circular discovery arrow separately refreshes job listings.

## Responsive workspace

Job body text uses 16px, with larger navigation and supporting labels; content can scroll instead of being scaled down. Portrait uses bottom navigation and a full-height card that adapts to browser bars. On short landscape screens, navigation moves to a left rail, role details and fit reasons share a two-column card, and decision buttons sit on the right. Wider desktop screens show search preferences and application progress alongside the deck. Rotating preserves the current role and open draft.

Swipes use a card-relative distance threshold, frame-synchronised feedback and a short exit animation. Fast repeated actions are guarded; decisions are saved before animation. Reduced-motion preferences are respected. Matching results are cached until profile or listing data changes.

Browser coverage includes touch input, portrait/landscape viewports from 384×720 through 412×892 and 740×320 through 915×412, rotation with an edited draft, smaller phones, and offline use. These are emulated Galaxy S23+ size ranges, not tests on physical Samsung hardware.

## Run locally

Requires Node.js 22 or newer. Run `npm ci` to install dependencies. Discovery works without keys; private browser preparation needs server-side Browserbase credentials.

```bash
npm start
```

Open **http://localhost:4187**. Use this server instead of a static Python server: discovery uses `/api/jobs`.

```bash
npm test
# Browser regression tests (one-time setup first):
npm ci
npx playwright install chromium
npm run test:browser
```

The app is compatible with Vercel’s Node serverless functions. `api/jobs.js` provides listings; `api/prepare.js` streams private browser preparation and review, and `api/browser.js` forwards explicit typing and session-end actions. The rest is static. Deploy the repository root with no build command. The existing production URL is https://job-hunting-notes.vercel.app/; local changes do not update that deployment automatically.

## Discovery and matching

- Starts with three pages of the [Arbeitnow public API](https://www.arbeitnow.com/blog/job-board-api) and the [Remotive public feed](https://github.com/remotive-com/remote-jobs-api). Later Arbeitnow pages load automatically when four or fewer matching roles remain. The current card stays in place while new roles arrive. Remotive attribution and its original listing link are retained; remote geographic restrictions are preserved rather than treated as worldwide eligibility.
- Arbeitnow batches have a one-hour server/CDN cache. Remotive data is reused for six hours within a warm server instance; its public feed is delayed by 24 hours. Source failures are retryable, not treated as exhaustion. There is no comprehensive global-search guarantee.
- Each automatic refill scans up to three batches (nine pages) to avoid unbounded requests when nothing matches. If more pages remain, the empty deck says **Keep searching**; only an explicit source end produces **Check for new jobs**. Scanning progress and review history survive reloads. Reviewed job identities prevent cross-source repeats; full descriptions are retained for matching roles and the 50 most recently encountered reviewed cards. Revisit resets passed decisions and reloads the feed. New postings are checked hourly while the Discover view is visible, when returning to an older feed, or using Refresh.
- Matching runs locally. Prioritises operational problem-solving, systems improvement, analysis, stakeholder collaboration and delivery with light coding. Core titles include implementation, onboarding, professional services, BA, systems consulting, product operations, technical delivery and systems-focused customer success.
- Excludes recognisable US-only locations, architect/developer titles, quota-led sales and senior leadership. Germany ranks above other European locations. International preferences can be enabled in Profile.
- Adjacent-role exploration is on by default. Systems specialists, digital adoption, technical account management, product ownership and unfamiliar titles can qualify when the description demonstrates systems work plus relevant collaboration, analysis or delivery. Promising adjacent matches appear between groups of core matches, with a “Worth exploring” label. Turn this off in Profile if desired.
- Keyword scores explain role relevance; they do not verify qualifications, language requirements, working-time mix, visa eligibility or whether an opening is still accepting applications. Unconfirmed work rights are available through the listing header’s info icon. Open the source listing to check the details.
- Pass/save/prepare decisions survive reloads. Undo reverses the last swipe, and passed roles can be revisited. Existing applications are deduplicated against discovery.

## Application preparation

Without a private browser connection, a right swipe opens the source URL in a new tab (same-tab fallback if popups are blocked), without opening a notebook form. Arbeitnow links may lead to a job-board listing, requiring a further Apply click. It also creates a **Preparing** record with a CV recommendation, an editable introduction based on verified profile facts, practical answers and a checklist. The optional draft remains accessible in Applications. This does not autofill the external page or attach a CV. These are deterministic drafts, not AI-generated tailored CVs. Existing PDFs retain their layout and content. Original job descriptions are treated as text.

Standard-field autofill is available through the optional desktop Chrome/Edge extension:

1. Open `chrome://extensions` (or `edge://extensions`) and enable Developer mode.
2. Choose **Load unpacked** and select this repository’s `autofill-extension` folder.
3. In an application draft, select **Copy autofill pack** and open the employer’s actual application form.
4. Open the extension, paste the pack and select **Fill standard fields**.
5. Review all fields, answer custom questions, attach the suggested CV and submit yourself.

The helper uses `activeTab` and `scripting`, with no persistent host permissions, remote requests, or stored pack. It fills empty, recognisable name, email, phone, LinkedIn and cover-letter text fields. It leaves existing values, file uploads, salary, work-right/sponsorship questions, checkboxes, selects and custom fields untouched. It never clicks Submit. Embedded/cross-origin forms may need opening in their own tab. Mobile users can download the prepared draft and CV and complete the form manually.

After submission, confirm **I’ve submitted this application** to record the date. A swipe, draft, or opened link never marks an application as submitted.

## Profile and CV library

**My profile** stores contact details, start date, languages, work-authorisation reference, motivation and verified achievements. New drafts use this profile; existing drafts keep their saved wording.

Upload Consulting, Business Analyst and Full Stack Developer PDF files (up to 15 MB each) to the local CV library. All three files can be downloaded from Profile. The recommended file is available from the application draft, and the CV selector lets you change it without rewriting the PDF or losing draft edits. Developer-heavy jobs remain excluded from discovery; a manually added developer role can select the developer CV. File contents are stored in IndexedDB on this device. Starting browser preparation sends the selected PDF and contact details to the private endpoint and cloud browser; employer forms may autosave uploads before submission.

**Import profile** accepts a Job notebook profile JSON or a setup bundle containing `profile` and optional `cvs.consulting`, `cvs.analyst` and `cvs.developer` objects with `name` and base64 PDF content. Resume-editor JSON exports have a different schema and must first be mapped to the profile format. Private setup bundles belong in `private/`, which is excluded from Git, Vercel deployment and the local web server. Never commit a personal setup bundle or CV to this public repository.

## Existing data, backup and privacy

The original `job-notebook-v1` localStorage key and confirmed-status migration are preserved. The existing three seed applications remain. Search, status/date editing, notes and backup/restore are still available.

- Application records, profile, feed cache and swipe decisions are stored in this browser.
- JSON backups include the profile and swipe history. Restore accepts the original v1 backups and validates data before replacing it; restoring replaces the current notebook.
- **CV PDFs are not in JSON backups. Keep the original PDF files or your private setup bundle.**
- The publicly deployed app exposes its code and initial seed roles. Each browser has its own data. The job endpoint fetches public listings and never receives your profile, CVs or application history.
- The PWA caches its application shell for offline use; feed requests remain online-only. Clearing browser storage removes locally saved data. No background search scheduling, account sync or automatic application submission is included.

## Private application browser on phone Chrome

Import the private setup bundle in My profile once. Its `automationToken` connects this device; the same bundle imports saved contact details and all three original PDFs without changing their layout. The token stays in IndexedDB and is excluded from notebook backups. Keep this bundle private. Disconnect removes the device connection.

Set `BROWSERBASE_API_KEY` and a random, at least 32-character `JOB_NOTEBOOK_ACCESS_TOKEN` on the server. The setup bundle must contain the matching access token. Never expose the Browserbase key in frontend code or commit either credential. No project ID or separate model key is needed.

A connected right swipe starts a temporary Browserbase browser, opens the listing, follows a supported application link, checks the employer/role identity, fills recognised empty contact fields and attaches the recommended original PDF (maximum 2.5 MB). Review appears inside the app after automation stops. Tap fields in the live application; on phone Chrome, expand **Type into a form field** to send text to the focused field. Complete custom questions and submit yourself, then use **I submitted it** to update the notebook. The automation never submits, checks consent boxes, answers eligibility questions, or overwrites existing answers.

Use **Try a practice application** to verify your connection first. It uploads no application to an employer. Initial URL support is limited to Lever, Workable, SmartRecruiters, Personio and Teamtailor domains, with Arbeitnow as a listing source. This is a conservative first version, not a guarantee that every form on those platforms works. Embedded forms, blocked pages, logins and unsupported sites may need manual completion through Open original.

The review session lasts about three minutes; keep the app open. End session explicitly releases the browser; closing the app requests release, and the cloud session has a five-minute maximum. No paid proxies or Verified features are requested. Real application session recording/logging is disabled. Link discovery can use Stagehand and the included Model Gateway allowance; quotas and anti-bot restrictions can still prevent preparation. The endpoint holds a streamed response during review, so deployment must support a 300-second function duration.

Validation: `npm test` and `npm run test:browser`. With credentials supplied through the process environment, `node scripts/browserbase-smoke.mjs` tests the controlled form in a cloud session, `node scripts/production-smoke.mjs` checks the deployed streaming endpoint, and `node scripts/phone-smoke.mjs` checks the production review on an emulated phone (requires Playwright Chromium). These tests consume Browserbase session allowance and use synthetic applicant data.

## Readable decision summaries and private CV recovery

Listings open with an English synopsis, essential eligibility details, and concrete pay/benefits (at most 105 words combined). The qualification checklist and original listing are collapsed by default. German is compared with the profile CEFR level; a German-language advert alone is not proof of a German requirement. Explicit levels are scoped to German rather than borrowed from an adjacent English requirement. Strong-language wording is a potential gap for B1 without inventing an exact CEFR level. Preferred skills remain labelled as preferences. Summaries are rewritten with the existing Browserbase/Stagehand Model Gateway through the authenticated `/api/summary` endpoint. Only public listing text is sent, not the applicant profile or CV. Output length and verbatim supporting quotes are validated, with one rewrite attempt; these checks do not guarantee perfect semantic interpretation. Published summaries and browser-local cached summaries are reused only when the title, location and full source text match. New summaries require the private connection and available Browserbase allowance; failures show a retry action rather than the whole listing. Up to 80 summaries are retained locally for offline use. The endpoint deduplicates cached requests within each warm server instance, but it is not a durable shared database. Detailed qualification badges still use local evidence rules.

The details sheet and summary use larger relative text sizes with scrolling rather than shrinking the content. Validation includes phone portrait/landscape, 200% root text size for reading sections, repeated actions, and returning from sheets. Guidance: [Android touch targets](https://developer.android.com/guide/topics/ui/accessibility/views/apps-views) and [W3C text resizing](https://www.w3.org/WAI/WCAG21/Understanding/resize-text.html). This is emulation, not a physical-device accessibility certification.

`api/setup.js` serves a gzip/base64 setup bundle from the sensitive production environment variable `JOB_NOTEBOOK_CV_SETUP`, protected by the existing device bearer token. Neither the bundle nor its PDFs are committed or publicly hosted. A private `#connect=` link saves the device connection, immediately removes the fragment from browser history, and loads the saved details and three PDFs. Already connected devices automatically restore missing CVs while preserving existing PDFs and edited profile fields; **Load my saved CVs** explicitly restores the server library. CVs remain available locally afterward. Anyone holding the connection link can access the private bundle, so keep it private; rotate the server access token to revoke all existing connections.

## Employer-specific summaries (release 18)

Cards now display the employer’s actual responsibility, requirement, preferred-skill, benefit and contract sections, with limited removal of verbal padding. They no longer replace those facts with broad skill categories. Original text remains available for checking. The percentage badge and generic “Why this fits” claims are removed: internal keyword weights only order suggestions and are not an eligibility probability. Internship and commercial-focus facts lower ordering priority. Student/school agreement requirements are surfaced before applying.

The info sheet contains only relevant missing or conflicting details, not a duplicate qualification list. German is assessed only when the actual requirements mention it. Benefits such as company training cannot turn into applicant qualifications. A requirement containing several languages or skills is not marked satisfied just because one item matches. Unsupported or ambiguous comparisons remain question marks next to the real requirement; no stock “relevant work” paragraphs are shown. This remains extractive parsing, not a guarantee that every possible section format will be interpreted correctly.

Content regression tests use the reported Back Market seller internship: Salesforce seller activation, Excel pivot tables, preferred French, French-school agreement, January start, six-month duration, monthly pay, and the exact remote-work allowance. Live verification also checks the original feed text, not only the shortened test fixture.

### Private device transfer and sync (release 21)

Open **Backup → Transfer & sync** on the connected source device. Create a pairing code, paste it on the receiving device, review the actual application/PDF counts, and confirm. The source notebook is kept intact. The receiver verifies every PDF's SHA-256 digest and reads the saved notebook back before acknowledging success. A durable IndexedDB journal recovers interrupted imports; the previous local copy can be restored from the transfer screen.

After confirmation, edits sync while the app is open and online (after edits, on return, and every minute). If both devices changed, sync pauses for a choice of which complete notebook to keep on both; the discarded copy is retained locally for recovery. This is whole-notebook conflict resolution, not automatic field merging. Unsaved form input is not included.

`api/device` uses a **private** Vercel Blob store. Browser-generated AES-256-GCM keys never reach the server; data is compressed and encrypted in the browser, including original PDF bytes, profile, applications/drafts, discovery/swipe history and application-preparation connection. The server receives a separate vault access capability. Blob ETags enforce conditional writes. Pairing codes are 256-bit secrets, expire after 15 minutes, and bind to one receiving device; confirmation removes the encrypted pairing payload. Expired unused pairing payloads remain encrypted in private storage until accessed (which clears them) or administratively removed. The persistent encrypted vault remains when a device disconnects, for the other paired device. No private payload is written into the repository or a public Blob URL.

Transfer currently supports up to approximately 2.5 MB compressed (32 MB uncompressed); an oversized notebook fails before changing local data. Clearing browser storage removes that device's local keys and records: pair it again from a remaining connected device. Legacy JSON export excludes PDFs; use transfer for the complete notebook. Recovery/comparison downloads contain personal data and must be kept private.

Required deployment configuration: a connected private Vercel Blob store (`BLOB_READ_WRITE_TOKEN` or the SDK's store/OIDC credentials), plus the existing `JOB_NOTEBOOK_ACCESS_TOKEN` for creating a vault/pairing. Never prefix secrets with client/public environment names. No account plan upgrade is required by this implementation.
