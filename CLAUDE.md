# CLAUDE.md — Space & Time

A classroom project: a simple APOD (NASA Astronomy Picture of the Day) viewer for
middle-school astronomy beginners. See PLAN.md for the milestones.

## Rules
- Keep it simple: plain HTML/CSS/vanilla JS, no frameworks, no build tools, no npm.
- Build **one milestone at a time**. After each one, explain the code and ask the user to test it before continuing.
- Write for beginners: friendly wording in the UI, short comments in the code.
- Keep the project outside OneDrive (it currently lives in `C:\Users\leo20\Space and TIme (real trust)`).
- Don't commit or share `config.js` (it holds the API key).

## Run
```
python -m http.server 8000
```
Then open http://localhost:8000.

## Files
- `README.md`: classroom guide for students and the teacher (keep it in sync when features change)
- `index.html`: page structure
- `styles.css`: look and feel (dark "space" theme)
- `app.js`: fetches APOD (feed first, API as backup), caches it, renders it, and handles the date controls
- `glossary.js`: `window.GLOSSARY` word list with kid-friendly meanings (easy for students to extend)
- `config.js`: `window.APOD_CONFIG = { apiKey: "..." }` (copy from `config.example.js`)

## Data sources (verified live 2026-11-13)
- **Main: NASA's APOD feed** `https://science.nasa.gov/wp-json/wp/v2/apod-basic/YYMMDD/html`. No key, CORS allowed, returns an HTML page that `parseFeedPage()` reads (title from `<title>`, explanation from `meta[name=description]`, first `<img>`/`<iframe>`, credit text). 404 = not posted yet, 400 = invalid date.
- **Backup: official API** `api.nasa.gov/planetary/apod`. Since the Sept 2026 backend change it returns a placeholder for every date (title "NASA Science", `nasa-logo` image, explanation copied from another day). `isPlaceholder()` detects this. Placeholders are never cached. Unposted dates return HTTP 500.
- DEMO_KEY is limited to about 10 requests per hour. The user's personal key is in `config.js`.
- `explanation` may end with "Tomorrow's picture: …" and tab characters. Strip them.
- Feed media comes as `<img>`, `<video><source src=…mp4>`, or a YouTube `<iframe src="//www.youtube.com/embed/…">`. Some days have no media at all (e.g. 2026-10-02). Test days: 10-16 (mp4), 10-18 (YouTube), 10-02 (none).
- YouTube embeds do NOT play in VS Code's built-in preview browser (a webview restriction), but work in real browsers (verified by the user in several). Test videos in a real browser. The app shows a "Watch it on YouTube" backup link under every YouTube player.
- The cache key prefix is `apod3-`. Bump it if the stored data shape changes.
- Re-check the official API after 2026-12-01 (the repo gets archived then). If it's fixed, consider making it the main source again.
