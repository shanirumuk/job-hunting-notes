# Job notebook

A mobile-first job discovery and application notebook with bottom navigation, a viewport-sized swipe deck, persistent decision buttons and full-width detail sheets on phones. Browse a ranked deck, swipe left to pass, save for later, or swipe right to prepare an application. Review the draft, use the optional browser autofill helper, and submit on the employer’s website.

## Responsive workspace

Portrait uses bottom navigation and a full-height card that adapts to browser bars. On short landscape screens, navigation moves to a left rail, role details and fit reasons share a two-column card, and decision buttons sit on the right. Wider desktop screens show search preferences and application progress alongside the deck. Rotating preserves the current role and open draft.

Swipes use a card-relative distance threshold, frame-synchronised feedback and a short exit animation. Fast repeated actions are guarded; decisions are saved before animation. Reduced-motion preferences are respected. Matching results are cached until profile or listing data changes.

Browser coverage includes touch input, portrait/landscape viewports from 384×720 through 412×892 and 740×320 through 915×412, rotation with an edited draft, smaller phones, and offline use. These are emulated Galaxy S23+ size ranges, not tests on physical Samsung hardware.

## Run locally

Requires Node.js 22 or newer. No runtime dependencies or API keys.

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

The app is compatible with Vercel’s Node serverless functions. `api/jobs.js` is the only backend endpoint; the rest is static. Deploy the repository root with no build command. The existing production URL is https://job-hunting-notes.vercel.app/; local changes do not update that deployment automatically.

## Discovery and matching

- Fetches the first three pages of the [Arbeitnow public API](https://www.arbeitnow.com/blog/job-board-api), with a six-hour server/CDN cache, request timeouts, partial-source handling and deduplication. The feed is a limited selection of recent roles, mainly in Europe; it is not a comprehensive global job search.
- Matching runs locally. Prioritises operational problem-solving, systems improvement, analysis, stakeholder collaboration and delivery with light coding. Core titles include implementation, onboarding, professional services, BA, systems consulting, product operations, technical delivery and systems-focused customer success.
- Excludes recognisable US-only locations, architect/developer titles, quota-led sales and senior leadership. Germany ranks above other European locations. International preferences can be enabled in Profile.
- Adjacent-role exploration is on by default. Systems specialists, digital adoption, technical account management, product ownership and unfamiliar titles can qualify when the description demonstrates systems work plus relevant collaboration, analysis or delivery. Promising adjacent matches appear between groups of core matches, with a “Worth exploring” label. Turn this off in Profile if desired.
- Keyword scores explain role relevance; they do not verify qualifications, language requirements, working-time mix, visa eligibility or whether an opening is still accepting applications. Unconfirmed work rights are always visible. Open the source listing to check the details.
- Pass/save/prepare decisions survive reloads. Undo reverses the last swipe, and passed roles can be revisited. Existing applications are deduplicated against discovery.

## Application preparation

A right swipe creates a **Preparing** record with a CV recommendation, an editable introduction based on verified profile facts, practical answers and a checklist. These are deterministic drafts, not AI-generated tailored CVs. Existing PDFs retain their layout and content. Original job descriptions are treated as text.

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

Upload Consulting, Business Analyst and Full Stack Developer PDF files (up to 15 MB each) to the local CV library. All three files can be downloaded from Profile. The recommended file is available from the application draft, and the CV selector lets you change it without rewriting the PDF or losing draft edits. Developer-heavy jobs remain excluded from discovery; a manually added developer role can select the developer CV. File contents are stored in IndexedDB on this device; the app does not send them to a backend.

**Import profile** accepts a Job notebook profile JSON or a setup bundle containing `profile` and optional `cvs.consulting`, `cvs.analyst` and `cvs.developer` objects with `name` and base64 PDF content. Resume-editor JSON exports have a different schema and must first be mapped to the profile format. Private setup bundles belong in `private/`, which is excluded from Git, Vercel deployment and the local web server. Never commit a personal setup bundle or CV to this public repository.

## Existing data, backup and privacy

The original `job-notebook-v1` localStorage key and confirmed-status migration are preserved. The existing three seed applications remain. Search, status/date editing, notes and backup/restore are still available.

- Application records, profile, feed cache and swipe decisions are stored in this browser.
- JSON backups include the profile and swipe history. Restore accepts the original v1 backups and validates data before replacing it; restoring replaces the current notebook.
- **CV PDFs are not in JSON backups. Keep the original PDF files or your private setup bundle.**
- The publicly deployed app exposes its code and initial seed roles. Each browser has its own data. The job endpoint fetches public listings and never receives your profile, CVs or application history.
- The PWA caches its application shell for offline use; feed requests remain online-only. Clearing browser storage removes locally saved data. No background search scheduling, account sync or automatic application submission is included.
