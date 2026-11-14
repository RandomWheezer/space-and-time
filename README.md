# 🔭 Space & Time

**One amazing picture of our universe, every day.**

Space & Time is a small website that shows NASA's
[Astronomy Picture of the Day](https://apod.nasa.gov/apod/) (APOD). It's made
for middle-school astronomy beginners, and it's simple enough that you can read
all of its code.

## What you can do
- **See today's picture** with its title, credit, and explanation.
- **Travel in time.** Use ← Previous day, Next day →, or pick any date back to
  **June 16, 1995** (the very first APOD) and press **Go**.
- **🎲 Surprise me** jumps to a random day from the last 30 years.
- **Learn new words.** Gold underlined words, like *nebula*, show a simple
  meaning when you tap them.
- **Short or full text.** You see the first two sentences first, then tap
  **Read the full explanation** for the rest.
- **☆ Save favorites** and find them again in **My favorites**.
- **Click for enlarged text** (top right) makes everything bigger.

## How to run it on your computer

You need **Python** (version 3 or newer). It's used only as a tiny web server,
so you don't write any Python yourself.

1. Open a terminal in the project folder. On Windows, open the folder in File
   Explorer, then type `powershell` in the address bar and press Enter.
2. Start the server:
   ```
   python -m http.server 8000
   ```
3. Open **http://localhost:8000** in a normal web browser (Edge, Chrome, or Firefox).
4. When you're done, go back to the terminal and press **Ctrl + C** to stop the server.

> **Why do I need a server?** Browsers block some features when you
> double-click an `.html` file. The server makes it act like a real website.

## Your NASA API key (optional)

The app gets its pictures from NASA's APOD feed, which doesn't need a key. A key
is only used by the backup source (see "Where the pictures come from" below).

1. Get a free key at **https://api.nasa.gov** (just your name and email).
2. Copy `config.example.js` and name the copy `config.js`.
3. Put your key between the quotes:
   ```js
   window.APOD_CONFIG = { apiKey: "your-key-here" };
   ```

Keep your key private: don't post `config.js` online. (`.gitignore` already
keeps it out of Git.) Anyone who opens the website could still see the key in
their browser, which is fine for a class project but not for a real product.

## Add your own glossary words ✏️

Open **`glossary.js`** and add a line inside the list:

```js
{ words: ["quasar", "quasars"], meaning: "A super-bright center of a faraway galaxy, powered by a giant black hole." },
```

- `words`: every way the word might be written. A plain "s" plural (*planet* →
  *planets*) is found automatically, so only list other forms.
- `meaning`: one or two short sentences a classmate would understand.
- Save the file and refresh the page. If the word appears in an explanation,
  it's now underlined!

## How the code works

| File | What it does |
|---|---|
| `index.html` | The page's structure: header, date buttons, picture area, favorites, footer |
| `styles.css` | The dark "night sky" look, plus the phone layout |
| `app.js` | Gets the picture, remembers it, and shows it. Handles the buttons, glossary, and favorites |
| `glossary.js` | The word list for the glossary |
| `config.js` | Your NASA API key |

The basic idea in `app.js`:

1. **Ask:** `fetchApod(date)` first checks the browser's memory (`localStorage`).
   If that day isn't saved yet, it downloads it from NASA.
2. **Read:** `parseFeedPage()` picks the title, picture or video, credit, and
   explanation out of NASA's page.
3. **Show:** `renderApod()` builds the page pieces. NASA's text is always added
   as plain text, never as HTML, which keeps the page safe.

## Where the pictures come from (a real-world lesson!)

We planned to use NASA's official **APOD API** (`api.nasa.gov/planetary/apod`).
In November 2026 we found that after a NASA system change, the API was sending
a **NASA logo instead of the real picture for every day**.

So the app now reads **NASA's APOD feed**, the same source the API reads from:
`https://science.nasa.gov/wp-json/wp/v2/apod-basic/YYMMDD/html`.
The official API is still in the code as a **backup**.

Real apps do this all the time: data sources change or break, so good programs
check what they get back and have a plan B.

## Troubleshooting

| Problem | Try this |
|---|---|
| `python` is not recognized | Install Python from https://www.python.org (tick **"Add python.exe to PATH"**), or try `py -m http.server 8000` |
| "Address already in use" | Another server is running. Use a different number: `python -m http.server 8001`, then open http://localhost:8001 |
| YouTube video doesn't play | Use a normal browser, not VS Code's built-in preview. Or click **Watch it on YouTube →** under the video |
| "No picture for this day" | NASA hasn't posted it yet (it's on US time), or that day is missing. Try another day |
| My favorites disappeared | Favorites are saved only in the browser you used. A different browser, computer, or private window starts empty |

## Credits

- Pictures and explanations: NASA's
  [Astronomy Picture of the Day](https://apod.nasa.gov/apod/), by Robert Nemiroff
  and Jerry Bonnell.
- **Many APOD pictures are copyrighted by the photographers named in their
  credit.** Don't reuse a picture somewhere else without checking its credit
  first. Pictures with no copyright listed are usually from NASA.
- Space & Time is a student project and is **not** an official NASA website.
