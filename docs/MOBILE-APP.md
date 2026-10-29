# Mobile apps (Android now, iPhone next)

The Android app is a thin native shell (Capacitor) around the hosted web app. It loads your production site, so **website changes reach the app immediately with no store update**; you only publish a new app version when the shell itself changes (icon, permissions, native code). The website also works as an installable PWA.

## What is in the repo

| Path | What it is |
|---|---|
| `capacitor.config.ts` | App id, name, which site to load (`CAPACITOR_SERVER_URL`), splash and system-bar settings |
| `android/` | The native Android project (Gradle). Commit it. Build outputs and keystores are git-ignored |
| `android/.../MainActivity.java` | Adds file downloads (for example "Download my data") through Android's download manager |
| `android/app/src/main/AndroidManifest.xml` | Camera permission, permission to see UPI apps, backups and cleartext traffic off |
| `assets/` + `scripts/generate-icons.mjs` | One drawing of the logo → web icons, PWA icons, Android launcher icons and splash |
| `capacitor-web/` | Generated. Holds only the "can't reach the site" page the app shows when offline |
| `public/sw.js`, `public/offline.html` | The website's service worker and offline page (used by the PWA, not by the app shell) |

How things behave inside the app:
- **UPI:** `upi://pay` links open the user's UPI app (Capacitor hands any non-site link to Android).
- **Files and documents:** links to stored documents redirect to a signed file URL on another host, which Android opens outside the app (browser / PDF viewer). Downloads from the site itself go to the Downloads folder.
- **Photos:** the file picker offers the camera for complaint photos and payment screenshots.
- **Back button:** goes back through pages, then leaves the app.
- **Offline:** shows a friendly page with "Try again".
- The website sees `SocietyMS-Android` in the user agent and hides the "Install app" banner.

## Before you publish (decide once)

- **Application id** (`appId` in `capacitor.config.ts`, and `applicationId` in `android/app/build.gradle`, currently `com.societyms.app`). It can **never change** after the first Play upload. Use a reverse domain you own, for example `in.yourcompany.societyms`. Changing it later means a new app and a new listing.
- The site address the app loads (your production URL, with https).

## Build on your own computer (recommended)

You need Node 22, JDK 17 or newer, and Android Studio (it installs the Android SDK).

```bash
npm install
export CAPACITOR_SERVER_URL=https://your-app.vercel.app   # your production site
npm run android:assets     # only when the logo changes: regenerates all icons and the splash
npm run android:sync       # copies config into android/
cd android && ./gradlew assembleDebug        # debug APK: android/app/build/outputs/apk/debug/
```

Open the `android/` folder in Android Studio to run it on an emulator or a phone (USB debugging on).

**Testing against your computer instead of production:** start the web app (`npm run dev`), then
`CAPACITOR_SERVER_URL=http://10.0.2.2:3000 npm run android:sync` (10.0.2.2 is the emulator's name for your computer). Plain http works only in debug builds.

### Release build for the Play Store

1. Create a signing key **once** and back it up in a password manager and one other safe place. If you lose it you cannot update the app.
   ```bash
   keytool -genkey -v -keystore societyms-release.jks -alias societyms -keyalg RSA -keysize 2048 -validity 10000
   ```
2. Create `android/keystore.properties` (git-ignored, never share it):
   ```
   storeFile=../societyms-release.jks
   storePassword=…
   keyAlias=societyms
   keyPassword=…
   ```
3. Build the bundle, raising the version number for every upload:
   ```bash
   CAPACITOR_SERVER_URL=https://your-app.vercel.app npm run android:sync
   cd android && ./gradlew bundleRelease -PversionCode=1 -PversionName=1.0.0
   ```
   Output: `android/app/build/outputs/bundle/release/app-release.aab`. Without `keystore.properties` it is unsigned and Google will reject it.
4. In Play App Signing (recommended), Google holds the final signing key and your key is only the upload key.

## Play Console checklist

1. Create a Google Play developer account (US$25, one time) and verify your identity. For a **personal** account, Google requires a closed test with at least 12 testers for 14 days before you can go to production; organisation accounts are exempt.
2. Create the app, then fill in:
   - **Privacy policy URL:** `https://your-app.vercel.app/privacy`
   - **Data safety form.** Collected: name, email address, phone number, user-generated content (posts, complaints, photos), financial info shown in the app (payment records you enter; **no** card or bank logins are collected), app activity. Data is encrypted in transit; users can request deletion (point to *Privacy & my data* in the app). Not sold, not shared for advertising.
   - **Account deletion:** the app lets users request erasure in *Privacy & my data*. Give that path in the form's account-deletion section. Google also wants a web URL for it: the privacy notice page explains the process, or add a public page later.
   - **Content rating** questionnaire (no violence, no user-to-user chat outside the society board; the community board is moderated by the committee).
   - **Target audience:** adults only.
   - **App access:** the app needs a login. Give reviewers a demo society and a demo account (a resident and a treasurer) in the "App access" instructions.
3. **Store listing:** short and full description, 512×512 icon (`public/icons/icon-512x512.png`), a 1024×500 feature graphic, and at least 2 phone screenshots (take them from the emulator).
4. Upload the `.aab` to **Internal testing** first, install on a few real phones, then promote to closed testing and production.

## Test on real phones before every release

- Sign in, sign out, and a wrong password.
- Pay with UPI from the dues screen: the UPI app opens with the right payee and amount, and coming back returns to Society MS.
- Attach a photo (camera and gallery) to a complaint and to a payment report.
- Open a stored document (PDF) and download "my data" from *Privacy & my data*.
- Turn on airplane mode: the app shows the offline page, then recovers on "Try again".
- Rotate the phone and switch to another app and back (the session should survive).
- A phone with a notch and a phone with gesture navigation: nothing is hidden under the status or navigation bar.

## Building inside the Claude cloud session

Not possible by default: the session's network policy blocks Google's Android downloads (`dl.google.com`, `maven.google.com`, `redirector.gvt1.com`), so Gradle cannot fetch the Android build tools. If you want builds here, add those hosts under *Allowed domains* in the environment settings, and ask for the Android SDK to be installed (`cmdline-tools`, `platforms;android-36`, `build-tools;36.0.0`). Signing keys should still be created on your own computer.

## iPhone (next step)

Capacitor can produce the iOS app from the same code (`npm i -D @capacitor/ios`, `npx cap add ios`). It needs a Mac with Xcode (or a cloud macOS build such as Codemagic or GitHub Actions) and an Apple Developer account (US$99 a year). Plan for: `LSApplicationQueriesSchemes` entries for UPI apps (`upi`, `gpay`, `phonepe`, `paytmmp`, `bhim`) in `Info.plist`, camera and photo-library usage descriptions, Apple's review requirement that the app does more than a website (push notifications and the camera help), and the same privacy and account-deletion answers as above.

## Push notifications (not built yet)

Today messages go out by email and SMS. Push needs: a Firebase project and `google-services.json` in `android/app/` (the Gradle file already applies the plugin when that file exists), the `@capacitor/push-notifications` plugin, a table of device tokens per user, and a sender next to `src/lib/notify/`. Start with new notices, complaint updates and dues reminders.
