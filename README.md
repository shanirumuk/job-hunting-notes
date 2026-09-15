# Job notebook

A simple, Notion-style job-application notebook for private use.

## What it does

- Tracks roles, application links, status, dates, CV/materials used, requirements, and notes.
- Starts with three reviewed roles: Deliverect, Allianz Technology, and PointClickCare.
- Supports search, status filtering, local backup, and restore.
- Is installable as a small PWA.

## Privacy and data

Application entries are stored in the browser's local storage on the device using the app. They are not sent to a backend. Use **Backup** after important changes and keep the downloaded JSON file somewhere private.

The deployed web app is publicly reachable, but visitors only see the application shell and initial role suggestions; they do not see another device's saved entries.

## Local development

```bash
python3 -m http.server 4187 --directory .
```

Then open `http://localhost:4187`.

## Deployment

The app is currently deployed at https://job-hunting-notes.vercel.app/?release=2
