# Lottery Intelligence Engine — mobile test version

This folder packages the web app (the files at the top of this project) as Android and iPhone
apps using Capacitor. It lives only on the `mobile` branch; the website is built from `main`
and is not affected by anything here.

- `scripts/build-www.mjs` copies the web app into `www/` and makes three phone-only adjustments
  to that copy (no website offline worker, no "install" panel, read the live results file).
- `android/` and `ios/` are the native projects. GitHub builds a test Android app automatically
  (see `.github/workflows/android-test.yml`) and publishes it under Releases as a pre-release.
- iPhone builds need an Apple Developer account and a Mac or a cloud Mac.
