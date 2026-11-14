# Space & Time — Implementation Plan

A simple web app that shows NASA's Astronomy Picture of the Day (APOD) to
middle-school astronomy beginners.

**Stack:** plain HTML + CSS + vanilla JavaScript. No build step, no framework.
Served locally with Python's built-in web server.

## Milestones (one at a time; test after each)

1. **Today's picture (MVP)** ✅ tested
   - Fetch the latest APOD and show its title, date, image or video, explanation, and credit.
   - Show loading and friendly error states.
   - Cache each day's response in the browser (DEMO_KEY allows only ~10 requests per hour).
   - Handle the API's quirks: days not posted yet, placeholder results, messy explanation text.
2. **Time travel:** a date picker with a Go button, plus Previous/Next/Latest (limits 1995-06-16 → latest). ✅ tested
3. **Beginner helpers:** a short version first (2 sentences) with "Read the full explanation", a tap-a-word glossary (`glossary.js`), and a remembered "Click for enlarged text" toggle. ✅ tested
4. **Explore more:** a "Surprise me" random day (picked in the app, because the API's `count` is broken) and a favorites list saved in the browser. Also fixed: `.mp4` videos, YouTube backup link, the picture no longer opens a new tab, and start-up no longer covers a day you picked. ✅ tested
5. **Polish:** phone grid layout, 44px tap targets, focus outlines, short screen-reader announcements, reduced-motion support, tab icon, not-affiliated-with-NASA note, and a classroom `README.md`. ← current

## API facts (checked live on 2026-11-13)

- Endpoint: `GET https://api.nasa.gov/planetary/apod?api_key=KEY`
- Parameters: `date`, `start_date`/`end_date`, `count` (≤ 25; cannot combine with dates). The earliest date is 1995-06-16.
- Fields seen: `date, title, explanation, url, hdurl, media_type, copyright, service_version`.
- `media_type` can be `image`, `video`, or something else, so we handle all three.
- CORS is allowed, so the browser can call the API directly.
- `X-RateLimit-Limit: 10` for DEMO_KEY. Get a free personal key at https://api.nasa.gov.
- The backend moved to NASA's WordPress feed (Sept 2026). The GitHub repo will be archived on 2026-12-01.
- **Problem found:** the API now returns a NASA-logo placeholder for every date, even with a personal key.
  **Workaround:** read the feed the API uses (`science.nasa.gov/wp-json/wp/v2/apod-basic/YYMMDD/html`) and keep the API as a backup.
