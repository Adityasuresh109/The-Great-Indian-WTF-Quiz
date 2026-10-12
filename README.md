# The Great Indian WTF Quiz 🎤

**18 locked questions · 3 rounds · 25-player party game · host-controlled reveals**

One laptop controls the show, one TV/projector shows the presentation, and everyone answers on their phones. There is no required account for players.

## Game format

- **Questions 1–6 — 3 True, 1 Bullshit:** one tap shows the question, then separate host taps reveal A, B, C, D; host opens voting and reveals the fake story.
- **Questions 7–12 — What the Actual Fuck?!:** everyone submits a free-text guess for an impossible-sounding real-news twist. The host can award full/partial credit and override close answers.
- **Questions 13–18 — Who the Hell Am I?:** five individually released celebrity clues with one locked-in guess per player; earlier correct guesses earn more points.
- **ONLY AFTER QUESTIONS 6, 12 and 18:** a host tap publishes everyone's **points this segment, cumulative score and ranking** to the TV and all phones. Scores stay private until the round break.

## Views

- `/` — choose to host or join.
- `/?host=ABC123` — private host control panel; **only the browser that created the room** can restore and control it.
- `/?screen=ABC123` — projection / TV view. Open this from the host dashboard.
- `/?join=ABC123` — player join link. Open it on any smartphone.

## Technical architecture

This first playable version is a static HTML/CSS/JavaScript app using **PeerJS** WebRTC connections. The host browser is the game-state authority. PeerJS uses a public signaling service, so this edition does **not** need Firebase or an API key. A six-character room code and player nicknames are all guests need.

**Important limits:** The host laptop must stay awake with the browser open. Corporate/hotel networks can block peer-to-peer connections. The public PeerServer service has no guaranteed reliability or availability. This is suitable for a friendly private quiz, **not a secure, high-stakes contest**: answer keys can be inspected on a public static site and a technically savvy player could spoof a client session. A production backend is the right upgrade if those limitations matter.

## Development

- `index.html`, `style.css`, `app.js` — presentation / player screens.
- `quiz.js` — approved public questions (no answers).
- `host-key.js` — quiz answers and scoring; dynamically imported only in the host UI. **Not secret on a public static site**.
- `backend.js` — host-authoritative room, PeerJS connections, scoring, host recovery.
- `tests/` — built-in Node test suite.
- `.github/workflows/ci.yml` — continuous validation for pull requests and commits.
- `.github/workflows/deploy-pages.yml` — automatic GitHub Pages deployment after the repo is granted Pages access.

### Run locally

Any HTTP static server works. For example, from this directory run `python3 -m http.server 8000` then visit `http://localhost:8000` on the host laptop. Running directly as `file:///` is **not** supported because browser ES modules require an HTTP origin.

### Run tests

Requires Node 20+: `npm test` (no dependency installation needed).

## Deploy via GitHub Pages

The repository includes a Pages deployment workflow for `main`. The repository's **Settings → Pages** must allow GitHub Actions as its build and deployment source. If Pages is not activated automatically, an administrator must enable it once. Once deployed, the app will be available at a URL like `https://adityasuresh109.github.io/The-Great-Indian-WTF-Quiz/` (this is an expected URL pattern, **not a verified live site**).

Before game night, test with multiple real phones on different connections and ideally all 25 players. Avoid switching off the host computer or closing its tab during a session.
