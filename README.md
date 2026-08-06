# Product Photo Organizer

Android app: pick photos from your gallery, AI (Gemini) classifies each as
Handbags / Clothing / Jewelry + brand, and uploads them into matching nested
folders in a shared Google Drive (e.g. `Handbags/Gucci`, `Clothing/Shirts/Zara`).

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Copy `.env.example` to `.env` and fill in:
   - `GEMINI_API_KEY` — from https://aistudio.google.com/apikey
   - `GOOGLE_OAUTH_CLIENT_ID` — an OAuth 2.0 Android client ID from
     Google Cloud Console (APIs & Services > Credentials), with the Drive API
     enabled on the project.
   - `GOOGLE_DRIVE_ROOT_FOLDER_ID` — the Drive folder ID (from its URL) where
     all sorted albums should be created. Share this folder with your
     employees' Google accounts (Editor access) so uploads land in one place.

   Expo reads env vars prefixed `EXPO_PUBLIC_`, so also export:
   ```
   EXPO_PUBLIC_GEMINI_API_KEY=...
   EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID=...
   EXPO_PUBLIC_GOOGLE_DRIVE_ROOT_FOLDER_ID=...
   ```

3. Run locally:
   ```
   npm run android
   ```

## Building for Google Play (Internal Testing)

This app uses [EAS Build](https://docs.expo.dev/build/introduction/) to
produce a signed `.aab` for Play.

1. Install EAS CLI: `npm install -g eas-cli`
2. Log in: `eas login`
3. Configure the project: `eas build:configure`
4. Build: `eas build --platform android --profile production`
5. Once built, download the `.aab` and upload it in the
   [Google Play Console](https://play.google.com/console) under your app's
   **Internal testing** track.
6. Add your employees' Google account emails as testers, share the opt-in
   link Play generates — no store review needed for this track.

### One-time costs
- Google Play Developer account: **$25 one-time** (required to publish any
  build, even to Internal Testing).

## Notes / limitations
- Photos are picked manually each time (no background/auto-scan) — matches
  the "just click a button" workflow.
- Brand detection only works when a logo/label is visibly legible in the
  photo; otherwise items go in an "Unbranded" folder.
- Uploaded copies go to Drive; nothing is deleted from the phone's gallery.
