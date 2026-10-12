# Start here — Live game and GitHub deployment

No ZIP handling or manual code editing is required after the code is committed to GitHub.

## Publishing

The `Deploy game to GitHub Pages` workflow builds and publishes the site automatically after updates to `main`. If the workflow reports that Pages is not enabled, visit repository **Settings → Pages → Build and deployment → GitHub Actions** once. The expected URL is `https://adityasuresh109.github.io/The-Great-Indian-WTF-Quiz/` but it is not live until a workflow reports success.

## Hosting a game

Open the published website on a laptop. Choose **Host game**. Open its **TV screen** link on the projector and share the **Player link** with your friends. Keep the host laptop on, awake, and online throughout the entire event.

Your six-character game code belongs to that live host browser session. Players choose nicknames without accounts. The host is the only person who can advance questions, reveal options, close answers, and reveal scoreboards.

Q1–6: Question, option A, B, C, D on separate taps; vote; reveal.

Q7–12: Open text answers; reveal the plot twist; review host grading.

Q13–18: Reveal five celebrity clues separately. Players can lock only one guess.

Everyone's scores are published on host command **only after Q6, Q12 and Q18**.

## Before the trip

Test the deployed link with the host laptop, TV view, two phones on Wi-Fi and another on cellular data. This free browser-to-browser edition uses PeerJS WebRTC with an external public signaling server; hotel/corporate networks sometimes block connections. Conduct a full 25-player rehearsal if possible. Do not offer cash prizes or rely on this implementation for tamper-proof grading.
