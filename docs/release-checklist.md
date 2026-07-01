# Navam — Play Store Release Runbook

Step-by-step to get Navam onto Google Play. Build config is already in
`eas.json` (production → AAB) and `app.json` (package `com.sanjay.navam`).

## 0. One-time accounts / setup
- [ ] Google Play Developer account ($25 one-time).
- [ ] Host the privacy policy (`docs/privacy-policy.md`) at a public URL
      (e.g. GitHub Pages) and note the URL.
- [ ] Pick a **support email** and fill in the `[SUPPORT_EMAIL]` placeholders in
      `privacy-policy.md` and `play-store-listing.md`.
- [ ] (Optional) grab a domain for the policy / brand.

## 1. Version
- [ ] Set the user-facing `version` in `app.json` (currently `1.0.0`).
      `versionCode` is auto-managed by EAS (`appVersionSource: remote`,
      production `autoIncrement: true`).

## 2. Assets (in `store-assets/`)
- [x] App icon 512×512 — `store-assets/icon-512.png`
- [x] Feature graphic 1024×500 — `store-assets/feature-graphic-1024x500.png`
- [ ] 2–8 phone screenshots — capture on device (Today, Log feed, Trends,
      Growth chart, History).

## 3. Production build (AAB)
```
eas build --profile production --platform android
```
This produces an `.aab`. EAS manages the Android app-signing keystore (Play App
Signing) — keep the EAS account/keystore safe; it is the app's identity forever.

## 4. Play Console — create the app
- [ ] Create app "Navam", category **Parenting**, free.
- [ ] **Store listing:** paste from `play-store-listing.md`; upload icon +
      feature graphic + screenshots.
- [ ] **Privacy policy URL:** paste the hosted URL.
- [ ] **Data safety:** answer *No data collected / No data shared* (see listing doc).
- [ ] **Content rating:** complete IARC questionnaire → Everyone.
- [ ] **App access:** all functionality available without login (note this).
- [ ] **Ads:** No.

## 5. Closed testing (required before production for new personal accounts)
- [ ] Upload the AAB to a **Closed testing** track.
- [ ] Recruit **12 testers**, keep them opted-in for **14 continuous days**.
- [ ] Then apply for production access.

Submit to a track directly with:
```
eas submit --profile production --platform android
```
(Needs a Play service-account JSON at `./play-service-account.json` — see
`eas.json`. Or upload the `.aab` manually the first time.)

## 6. Production
- [ ] After the 14-day closed test, promote to **Production** and roll out.

---

### Notes
- **Data on updates:** installing an update (same package, EAS-signed) keeps user
  data. The one-time exception was the `com.sanjay.lull → com.sanjay.navam`
  rename (a new app identity) — testers re-onboard once.
- **SQLite file** is `navam.db`; migrations run automatically on update.
