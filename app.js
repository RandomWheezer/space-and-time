// Space & Time: show NASA's Astronomy Picture of the Day.
// Milestone 1: the latest picture. Milestone 2: travel to any day.
//
// WHERE THE DATA COMES FROM
// Since NASA's Sept 2026 backend change, the official APOD API
// (api.nasa.gov/planetary/apod) sends a NASA-logo placeholder for every day.
// The real content is in NASA's own APOD feed (the one the API now reads from),
// so we read that first and keep the official API as a backup.

const FEED_URL = "https://science.nasa.gov/wp-json/wp/v2/apod-basic/"; // + "261110/html"
const API_URL = "https://api.nasa.gov/planetary/apod";
const API_KEY = (window.APOD_CONFIG && window.APOD_CONFIG.apiKey) || "DEMO_KEY";
const FIRST_DATE = "1995-06-16"; // the very first APOD
const CACHE_PREFIX = "apod3-";   // bumped whenever saved data changes shape (3 = videos fixed)

const box = document.getElementById("apod");
const picker = document.getElementById("date-picker");
const goBtn = document.getElementById("go-btn");
const prevBtn = document.getElementById("prev-btn");
const nextBtn = document.getElementById("next-btn");
const latestBtn = document.getElementById("latest-btn");

// What the app remembers while it runs
let currentDate = null; // the day being shown
let latestDate = null;  // the newest day NASA has published
let requestCount = 0;   // numbers each trip, so only the newest one gets shown

// ---------- Date helpers ----------

// Format a Date as "YYYY-MM-DD" using the computer's local time.
function toISODate(d) {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// Move a "YYYY-MM-DD" date by n days (use a negative n to go back).
function addDays(isoDate, n) {
  const d = new Date(isoDate + "T12:00:00"); // noon avoids daylight-saving surprises
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

// APOD's short date code: "2026-11-10" -> "261110"
function shortCode(isoDate) {
  const [y, m, d] = isoDate.split("-");
  return y.slice(2) + m + d;
}

// Link to the same day on the official APOD website, e.g. ap261112.html
function apodSiteLink(isoDate) {
  return `https://apod.nasa.gov/apod/ap${shortCode(isoDate)}.html`;
}

// Only allow normal web links (never "javascript:" or other tricks).
function safeUrl(link) {
  try {
    const url = new URL(link, "https://science.nasa.gov/");
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
  } catch (e) {
    return "";
  }
}

// ---------- Source 1: NASA's APOD feed (main source) ----------

async function fetchFromFeed(isoDate) {
  const response = await fetch(FEED_URL + shortCode(isoDate) + "/html");
  if (!response.ok) {
    const err = new Error(`NASA's server answered with an error (${response.status}).`);
    err.status = response.status; // 404 = no picture for that day (yet)
    throw err;
  }
  return parseFeedPage(await response.text(), isoDate);
}

// The feed sends a small web page. We pick out the pieces we need and
// turn them into the same shape the official API uses.
function parseFeedPage(html, isoDate) {
  // DOMParser reads the HTML without running scripts or loading images.
  const doc = new DOMParser().parseFromString(html, "text/html");
  const textOf = (node) => (node ? node.textContent.replace(/\s+/g, " ").trim() : "");

  // <title> looks like "APOD: 2026 November 10 - Saturn Behind the Moon"
  const title = textOf(doc.querySelector("title")).replace(/^APOD:.*?\s[-–]\s/, "");
  if (!title) throw new Error("Couldn't read NASA's page.");

  // The full explanation is in the page's description tag.
  const meta = doc.querySelector('meta[name="description"]');
  const bodyText = textOf(doc.body);
  const explanation = (meta ? meta.getAttribute("content") : bodyText.split(/Explanation:/i).pop())
    .replace(/^\s*Explanation:\s*/i, "");

  // "Image Credit & Copyright: Roberto Ortu Explanation: ..."
  const credit = bodyText.match(/Credit[^:]*:\s*(.*?)\s*Explanation:/i);

  const canonical = doc.querySelector('link[rel="canonical"]');
  const data = {
    date: isoDate,
    title,
    explanation,
    copyright: credit ? credit[1].replace(/^\w*\s*Credit[^:]*:\s*/i, "") : "", // some pages repeat "Credit:"
    page: canonical ? safeUrl(canonical.getAttribute("href")) : "",
  };

  // The day's media is the first picture, video, or video player on the page.
  // Videos come two ways: a YouTube/Vimeo player (<iframe>) or a video file (<video>).
  const media = doc.querySelector("img, video, iframe");
  const tag = media ? media.tagName.toLowerCase() : "";
  if (tag === "img") {
    const link = media.closest("a");
    data.media_type = "image";
    data.url = safeUrl(media.getAttribute("src"));
    data.hdurl = link ? safeUrl(link.getAttribute("href")) : data.url;
    data.alt = media.getAttribute("alt") || "";
  } else if (tag === "video") {
    const source = media.querySelector("source");
    data.media_type = "video";
    data.url = safeUrl(media.getAttribute("src") || (source && source.getAttribute("src")) || "");
  } else if (tag === "iframe") {
    data.media_type = "video";
    data.url = safeUrl(media.getAttribute("src")); // "//youtube.com/..." becomes "https://youtube.com/..."
  } else {
    data.media_type = "other";
    data.url = data.page;
  }
  return data;
}

// ---------- Source 2: the official APOD API (backup) ----------

async function fetchFromApi(isoDate) {
  const url = `${API_URL}?api_key=${encodeURIComponent(API_KEY)}&date=${isoDate}`;
  const response = await fetch(url);

  if (response.status === 429) {
    throw new Error("We've asked NASA for too many pictures this hour. Please try again later.");
  }
  if (!response.ok) {
    const err = new Error(`NASA's server answered with an error (${response.status}).`);
    err.status = response.status;
    throw err;
  }
  return response.json();
}

// ---------- Getting a day's picture (with a cache) ----------

async function fetchApod(isoDate) {
  const cacheKey = CACHE_PREFIX + isoDate;
  try {
    const saved = localStorage.getItem(cacheKey);
    if (saved) return JSON.parse(saved); // already downloaded earlier
  } catch (e) { /* storage blocked: just fetch */ }

  let data;
  try {
    data = await fetchFromFeed(isoDate);
  } catch (err) {
    // 404/400 means that day has no picture, so the backup won't have one either.
    if (err.status === 404 || err.status === 400) throw err;
    data = await fetchFromApi(isoDate);
  }

  // Save real pictures only, so a placeholder gets another try next time.
  if (!isPlaceholder(data)) {
    try { localStorage.setItem(cacheKey, JSON.stringify(data)); } catch (e) { /* ignore */ }
  }
  return data;
}

// Today's picture may not be posted yet (NASA is in US time),
// so if today fails we try yesterday once.
async function fetchLatestApod() {
  const today = toISODate(new Date());
  try {
    return await fetchApod(today);
  } catch (err) {
    if (err.status >= 400 && err.status !== 429) {
      return await fetchApod(addDays(today, -1));
    }
    throw err;
  }
}

// ---------- Cleaning up the data ----------

function cleanExplanation(text) {
  return (text || "")
    .split(/Tomorrow's picture:/i)[0] // remove the "coming tomorrow" teaser
    .replace(/\s+/g, " ")             // collapse tabs and extra spaces
    .trim();
}

// The official API currently sends a NASA logo instead of the real picture.
function isPlaceholder(data) {
  return /nasa-logo/i.test(data.url || "") || data.title === "NASA Science";
}

// ---------- Showing it on the page ----------

// Build an element safely (text is never treated as HTML).
function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  node.append(...children);
  return node;
}

function renderMedia(data) {
  const fullPage = data.page || apodSiteLink(data.date);

  if (isPlaceholder(data)) {
    return el("p", { className: "notice" },
      "NASA's data feed didn't include this day's picture. ",
      el("a", { href: fullPage, target: "_blank", rel: "noopener" },
        "See it on the official APOD website →"));
  }
  if (data.media_type === "image" && data.url) {
    // Use NASA's description of the picture as alt text, unless it's the generic one.
    const alt = data.alt && !/^See Explanation/i.test(data.alt) ? data.alt : data.title;
    return el("img", { src: data.url, alt }); // not a link, so clicking it stays on our page
  }
  if (data.media_type === "video" && data.url) {
    // A video file (.mp4 etc.) plays in the browser's own player.
    if (/\.(mp4|webm|ogg|mov)(\?|$)/i.test(data.url)) {
      return el("video", {
        src: data.url,
        controls: true,
        preload: "metadata",
        title: data.title || "Astronomy video of the day",
      });
    }
    // Otherwise it's a YouTube/Vimeo player page.
    const frame = el("iframe", {
      src: data.url,
      title: data.title || "Astronomy video of the day",
      allowFullscreen: true,
    });
    frame.setAttribute("allow", "fullscreen; picture-in-picture; encrypted-media");
    frame.referrerPolicy = "strict-origin-when-cross-origin"; // YouTube needs this to play

    // A backup link, in case the player is blocked (some browsers and school networks do this).
    const youtubeId = data.url.match(/youtube(?:-nocookie)?\.com\/embed\/([\w-]{11})/);
    const watchUrl = youtubeId ? "https://www.youtube.com/watch?v=" + youtubeId[1] : data.url;
    const backup = el("p", { className: "credit" },
      "Video not playing? ",
      el("a", { href: watchUrl, target: "_blank", rel: "noopener" },
        youtubeId ? "Watch it on YouTube →" : "Open the video →"));
    return el("div", {}, frame, backup);
  }
  // Something else (an interactive page, for example): just link to it.
  return el("p", { className: "notice" },
    "Today's item is something special that can't be shown here. ",
    el("a", { href: data.url || fullPage, target: "_blank", rel: "noopener" }, "Open it →"));
}

function renderApod(data) {
  const prettyDate = new Date(data.date + "T12:00:00").toLocaleDateString(undefined, {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  const placeholder = isPlaceholder(data);

  box.replaceChildren(
    el("h2", { textContent: placeholder ? "Astronomy Picture of the Day" : data.title }),
    el("p", { className: "date", textContent: prettyDate }),
    placeholder ? "" : el("div", { className: "fav-row" }, favoriteButton(data)),
    el("div", { className: "media" }, renderMedia(data)),
    // A placeholder's text belongs to a different day, so we don't show it.
    placeholder ? "" : renderExplanation(cleanExplanation(data.explanation)),
    data.copyright && !placeholder
      ? el("p", { className: "credit", textContent: "Credit: " + data.copyright.trim() })
      : ""
  );
  announce(`Showing: ${placeholder ? "Astronomy Picture of the Day" : data.title}, ${prettyDate}`);
}

// Tell screen-reader users what just happened, in one short sentence.
function announce(text) {
  const announcer = document.getElementById("announcer");
  if (announcer) announcer.textContent = text;
}

// ---------- Milestone 3: beginner helpers ----------

let showFullText = false; // short version first; remembered while you change days

// Short version = the first 2 sentences (only if there are more than 3).
function shortVersion(text) {
  // Split after . ! or ? when the next sentence starts with a capital letter.
  const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z"'(])/);
  if (sentences.length <= 3) return { text, wasCut: false };
  return { text: sentences.slice(0, 2).join(" "), wasCut: true };
}

// Turn the glossary into a fast lookup table and one search pattern.
const glossaryLookup = new Map(); // "nebulae" -> its glossary entry
for (const entry of window.GLOSSARY || []) {
  for (const word of entry.words) glossaryLookup.set(word.toLowerCase(), entry);
}
const escapeForRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const glossaryWords = [...glossaryLookup.keys()]
  .sort((a, b) => b.length - a.length) // longest first, so "spiral galaxy" beats "galaxy"
  .map(escapeForRegex);
// \b = whole words only. s? = also find simple plurals ("planets").
const glossaryPattern = glossaryWords.length
  ? new RegExp(`\\b(${glossaryWords.join("|")})s?\\b`, "gi")
  : null;

// Build the explanation paragraph, turning glossary words into clickable buttons.
// Each word is highlighted only the first time, so the text stays easy to read.
function paragraphWithGlossary(text, onWordClick) {
  const p = el("p");
  if (!glossaryPattern) { p.textContent = text; return p; }

  const alreadyUsed = new Set();
  let position = 0;
  for (const match of text.matchAll(glossaryPattern)) {
    const entry = glossaryLookup.get(match[1].toLowerCase());
    if (!entry || alreadyUsed.has(entry)) continue;
    alreadyUsed.add(entry);
    p.append(text.slice(position, match.index)); // the normal text before the word
    p.append(el("button", {
      type: "button",
      className: "term",
      textContent: match[0],
      onclick: () => onWordClick(entry, match[0]),
    }));
    position = match.index + match[0].length;
  }
  p.append(text.slice(position)); // the rest of the text
  return p;
}

// Show a word's meaning in the box under the paragraph.
function showMeaning(helpBox, entry, wordAsWritten) {
  const word = wordAsWritten.charAt(0).toUpperCase() + wordAsWritten.slice(1);
  helpBox.replaceChildren(
    el("strong", { textContent: word + ": " }),
    entry.meaning,
    el("button", {
      type: "button",
      className: "close",
      textContent: "×",
      title: "Close",
      onclick: () => { helpBox.hidden = true; },
    })
  );
  helpBox.setAttribute("aria-label", "Meaning of " + word);
  helpBox.hidden = false;
}

// The explanation area: tip, paragraph, meaning box, and "read more" button.
function renderExplanation(fullText) {
  const area = el("div", { className: "explanation" });

  function draw() {
    const short = shortVersion(fullText);
    const text = showFullText ? fullText : short.text;
    const helpBox = el("div", { className: "word-help", hidden: true });
    helpBox.setAttribute("role", "status"); // screen readers announce the meaning

    const paragraph = paragraphWithGlossary(text, (entry, word) => showMeaning(helpBox, entry, word));
    const parts = [];
    if (paragraph.querySelector(".term")) {
      parts.push(el("p", { className: "hint", textContent: "Tip: tap a highlighted word to see what it means." }));
    }
    parts.push(paragraph, helpBox);
    if (short.wasCut) {
      parts.push(el("button", {
        type: "button",
        className: "pill",
        textContent: showFullText ? "Show the short version" : "Read the full explanation",
        onclick: () => { showFullText = !showFullText; draw(); },
      }));
    }
    area.replaceChildren(...parts);
  }

  draw();
  return area;
}

// "Bigger text" button. Your choice is remembered next time.
const textSizeBtn = document.getElementById("text-size-btn");

function setBigText(isBig) {
  document.documentElement.classList.toggle("big-text", isBig);
  textSizeBtn.setAttribute("aria-pressed", String(isBig));
  textSizeBtn.textContent = isBig ? "Click for normal-size text" : "Click for enlarged text";
  try { localStorage.setItem("big-text", isBig ? "yes" : "no"); } catch (e) { /* ignore */ }
}

textSizeBtn.addEventListener("click", () => {
  setBigText(!document.documentElement.classList.contains("big-text"));
});

let startBig = false;
try { startBig = localStorage.getItem("big-text") === "yes"; } catch (e) { /* ignore */ }
setBigText(startBig);

function renderError(message, hint) {
  box.replaceChildren(
    el("p", { className: "notice", textContent: "Oops! " + message }),
    el("p", { className: "status", textContent: hint })
  );
  announce("Oops! " + message);
}

// ---------- Time-travel controls ----------

// Turn the buttons on/off so you can't go before 1995-06-16 or after the latest day.
let loadingNow = false;
function updateControls(isLoading) {
  loadingNow = isLoading;
  // Don't change the date box while you're typing in it.
  if (document.activeElement !== picker) picker.value = currentDate || "";
  picker.max = latestDate || toISODate(new Date());
  goBtn.disabled = isLoading;
  surpriseBtn.disabled = isLoading;
  prevBtn.disabled = isLoading || !currentDate || currentDate <= FIRST_DATE;
  nextBtn.disabled = isLoading || !currentDate || !latestDate || currentDate >= latestDate;
  latestBtn.disabled = isLoading || currentDate === latestDate;
}

// Load and show the picture for one day.
// Answers "ok", "failed", or "stale" (you asked for another day meanwhile).
async function showDate(isoDate) {
  currentDate = isoDate;
  const myRequest = ++requestCount;
  updateControls(true);
  box.replaceChildren(el("p", { className: "status", textContent: "Traveling to " + isoDate + "…" }));

  let data, error;
  try {
    data = await fetchApod(isoDate);
  } catch (err) {
    error = err;
  }

  // If you already asked for a different day meanwhile, ignore this old answer.
  if (myRequest !== requestCount) return "stale";

  if (data) {
    renderApod(data);
  } else {
    const message = error.status
      ? `NASA doesn't have a picture for ${isoDate}, or it isn't available right now.`
      : error.message;
    renderError(message, "Try a different day with the buttons or the calendar.");
  }
  updateControls(false);
  return data ? "ok" : "failed";
}

// The "Go" button: nothing loads until you've finished typing and press it.
function goToPickedDate() {
  // reportValidity() checks the date is filled in and between min and max,
  // and if not, the browser shows a little message next to the box.
  if (!picker.reportValidity()) return;
  if (picker.value !== currentDate) showDate(picker.value);
}

goBtn.addEventListener("click", goToPickedDate);
picker.addEventListener("keydown", (event) => {
  if (event.key === "Enter") goToPickedDate(); // pressing Enter works like Go
});
prevBtn.addEventListener("click", () => showDate(addDays(currentDate, -1)));
nextBtn.addEventListener("click", () => showDate(addDays(currentDate, 1)));
latestBtn.addEventListener("click", () => showDate(latestDate));

// ---------- Milestone 4: Surprise me ----------

const surpriseBtn = document.getElementById("surprise-btn");

// Pick any day from the first APOD (1995) up to the latest one.
function randomDate() {
  const last = latestDate || toISODate(new Date());
  const oneDay = 24 * 60 * 60 * 1000;
  const totalDays = Math.round(
    (new Date(last + "T12:00:00") - new Date(FIRST_DATE + "T12:00:00")) / oneDay
  );
  return addDays(FIRST_DATE, Math.floor(Math.random() * (totalDays + 1)));
}

// A few old days have no picture, so if we land on one we try again (up to 3 times).
async function surpriseMe() {
  for (let tries = 0; tries < 3; tries++) {
    const result = await showDate(randomDate());
    if (result !== "failed") return;
  }
}

surpriseBtn.addEventListener("click", surpriseMe);

// ---------- Milestone 4: Favorites (saved in this browser) ----------

const favoritesBox = document.getElementById("favorites");

function loadFavorites() {
  try {
    return JSON.parse(localStorage.getItem("favorites")) || [];
  } catch (e) {
    return [];
  }
}

function saveFavorites(list) {
  try { localStorage.setItem("favorites", JSON.stringify(list)); } catch (e) { /* ignore */ }
}

function isFavorite(isoDate) {
  return loadFavorites().some((fav) => fav.date === isoDate);
}

// Add the day if it isn't saved yet, or remove it if it is.
function toggleFavorite(item) {
  let list = loadFavorites();
  if (list.some((fav) => fav.date === item.date)) {
    list = list.filter((fav) => fav.date !== item.date);
  } else {
    list.unshift(item); // newest first
  }
  saveFavorites(list);
  renderFavorites();
  // Keep the ☆/★ button on the picture in sync (for example after removing from the list).
  const starBtn = box.querySelector(".fav-btn");
  if (starBtn) starBtn.refresh();
}

// The ☆ button shown under each picture's date.
function favoriteButton(data) {
  const btn = el("button", { type: "button", className: "pill fav-btn" });
  btn.refresh = () => {
    const saved = isFavorite(data.date);
    btn.textContent = saved ? "★ Saved to favorites" : "☆ Save to favorites";
    btn.setAttribute("aria-pressed", String(saved));
  };
  btn.addEventListener("click", () => {
    toggleFavorite({
      date: data.date,
      title: data.title,
      thumb: data.media_type === "image" ? data.url : "", // small picture for the list
    });
  });
  btn.refresh();
  return btn;
}

// The "My favorites" list under the picture.
function renderFavorites() {
  const list = loadFavorites();
  const heading = el("h2", { textContent: `My favorites (${list.length})` });

  if (list.length === 0) {
    favoritesBox.replaceChildren(heading, el("p", {
      className: "status",
      textContent: "No favorites yet. Click ☆ Save to favorites on a picture you love.",
    }));
    return;
  }

  const ul = el("ul", { className: "fav-list" });
  for (const fav of list) {
    const openBtn = el("button", {
      type: "button",
      className: "fav-open",
      onclick: () => {
        showDate(fav.date); // usually instant, because the day is in the cache
        const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top: 0, behavior: calm ? "auto" : "smooth" });
      },
    },
      fav.thumb
        ? el("img", { src: fav.thumb, alt: "", loading: "lazy" })
        : el("span", { className: "fav-thumb", textContent: "✨" }),
      el("span", {}, el("strong", { textContent: fav.title }), el("br"), el("small", { textContent: fav.date }))
    );

    const removeBtn = el("button", {
      type: "button",
      className: "fav-remove",
      textContent: "×",
      title: "Remove from favorites",
      onclick: () => toggleFavorite(fav),
    });
    removeBtn.setAttribute("aria-label", `Remove ${fav.title} from favorites`);

    ul.append(el("li", {}, openBtn, removeBtn));
  }
  favoritesBox.replaceChildren(heading, ul);
}

// ---------- Start: find and show the newest picture ----------

renderFavorites();
updateControls(true);
const startRequest = ++requestCount;
fetchLatestApod()
  .then((data) => {
    latestDate = data.date; // always remember the newest day...
    // ...but if you already picked another day (a favorite, Surprise me), don't cover it up.
    if (startRequest !== requestCount) {
      updateControls(loadingNow); // just refresh Next/Latest now that we know the newest day
      return;
    }
    currentDate = data.date;
    renderApod(data);
  })
  .catch((err) => {
    if (startRequest !== requestCount) return;
    renderError(err.message, "Check your internet connection, then refresh the page.");
  })
  .finally(() => {
    if (startRequest === requestCount) updateControls(false);
  });
