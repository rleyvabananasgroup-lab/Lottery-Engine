# Lottery Intelligence Engine

Powerball and Mega Millions research app: five-ticket portfolios, ticket scanning,
automatic result checking, performance tracking and backtesting.

- `index.html` is the whole app. It also runs inside Claude, where the same file is published as an artifact.
- `data/feed.json` holds drawings newer than the app's built-in history. It is updated
  automatically by `.github/workflows/update-results.yml` (four times a day) using
  `scripts/update-results.mjs`, from New York's official open-data feeds
  (Powerball d6yy-54nr, Mega Millions 5xaw-6ayf), with a public mirror as backup.
- `manifest.webmanifest`, `sw.js` and `icons/` make it installable on phones and computers.

Tickets, history and settings are stored on each device, not in this repository.
The app never predicts drawings: every drawing is random and independent.
