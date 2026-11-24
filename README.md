# MyHome — Anchana Prabakaran's portfolio

Live site: **https://anchana-techie.github.io/MyHomePortfolio/**

Two pieces work together:

| Piece | Where it runs | What it is |
|---|---|---|
| The website | GitHub Pages | `index.html` + `CSS_Files/` + `JSON_Files/` + images. Every section is drawn from a JSON file, so content changes never touch the HTML. |
| The chat assistant | Render (`https://myhome-zb8s.onrender.com`) | `main.py` — a FastAPI RAG backend: fastembed + FAISS for search, Groq for answers. |
| Content editor | Your browser | `admin/index.html` — edits the JSON files and uploads images straight into your local folder. |

```
Visitor's browser ──(GitHub Pages)──▶ index.html ──reads──▶ JSON_Files/*.json
        │
        └── chat widget ──POST /chat/stream──▶ Render: main.py
                                                 ├─ search data/portfolio.index (built from portfolio_content.json)
                                                 ├─ ask Groq with the matching chunks
                                                 └─ log the exchange ──▶ Google Sheet (apps_script/ChatLogger.gs)
```

## Pages and shareable links

Each page has its own address, so you can send someone straight to it:

| Page | Link |
|---|---|
| Home | `#home` |
| Experience (timeline) | `#experience` |
| Projects (work) | `#projects` |
| Personal Projects | `#personal-projects` |
| Skills | `#skills` |
| Education | `#education` |
| Achievements | `#achievements` |
| Beyond Work | `#beyond-work` |
| CSR | `#csr` |
| What's New | `#whats-new` |
| Resume (opens the viewer) | `#resume` |

For example: `https://anchana-techie.github.io/MyHomePortfolio/#projects`

## Live numbers — no more stale "2+ years"

Text in the JSON files (and in `portfolio_content.json`) can contain:

- `{years}` → whole years since October 2023, e.g. **3+**
- `{tenure}` → e.g. **3 yrs 2 mos**
- in `experience.json`, a timeline `duration` of `{auto}` is worked out from its `period`, e.g. `"Apr 2026 – Present"` → **8 mos**

The career start date lives in two places: `CAREER_START` near the top of the main script in `index.html`, and `CAREER_START` in `main.py`.

## Editing content (no code needed)

Open **`admin/index.html`** in Chrome or Edge (double-click it, or visit `…/MyHomePortfolio/admin/` on the live site) and click **Open my portfolio folder** — pick this folder. The browser remembers it next time.

- Every section has a page: Home, What's New, Achievements, Personal Projects, Experience, Work projects, Skills, Skills solar system, Education, Beyond Work, CSR and the chatbot's knowledge.
- Lists (projects, photos, steps, team members…) can be added to, reordered, duplicated and deleted.
- **Upload** next to any image copies the picture into the right folder (large photos are shrunk to 1600px) and fills in the path. Achievement photos go into `Achievements/<achievement-id>/`.
- **Quick add** buttons start a new achievement, personal project or What's New post.
- Saving a new achievement or personal project offers to post it to **What's New** too.
- **Raw JSON** shows the file as text for anything the form doesn't cover.
- Nothing leaves your computer: Save writes the JSON files in your folder. Commit and push to publish.

### Adding a future achievement
Quick add → **+ Achievement**, fill in placement, medal (`gold` winner · `silver` 1st runner-up · `bronze` 2nd runner-up · `star` other), title, dates, story, team and photos → **Save** → accept the What's New prompt → commit and push. Also add a short paragraph about it under **Chatbot knowledge** so the assistant can talk about it.

## The chat assistant

### What it knows
Everything it says comes from **`portfolio_content.json`** (a list of `{title, text}` chunks). When you change that file:

- **Easiest:** delete `data/portfolio.index` and `data/portfolio_meta.json` (or just don't commit them) and push. On startup `main.py` sees they're missing and rebuilds them.
- **Or locally:** `python ingest.py`, then commit the two files in `data/`.

### How an answer is made
1. Guard rails: messages are capped at 500 characters, only the last 4 question/answer pairs are kept, and each visitor IP is limited to 10 messages a minute and 60 an hour.
2. Contact questions (email / LinkedIn) are answered directly in Python, so the link is always exact.
3. The question is embedded locally (`BAAI/bge-small-en-v1.5`) and matched against the FAISS index; broad questions get 8 chunks, narrow ones 4.
4. Groq writes the answer (`openai/gpt-oss-120b` by default). `POST /chat/stream` streams it word by word; `POST /chat` returns it whole.

### Endpoints
| Endpoint | Use |
|---|---|
| `GET /` or `GET /health` | Health check. The website pings this on load to wake Render early. |
| `POST /chat/stream` | `{message, history}` → Server-Sent Events: `delta` pieces, then `done` with the final HTML. |
| `POST /chat` | Same input → `{reply, text}` in one go. |
| `GET /admin/chat-logs?key=ADMIN_KEY` | Download the CSV log (only covers the time since Render last restarted). |

### Environment variables on Render
| Name | Needed? | What it does |
|---|---|---|
| `GROQ_API_KEY` | yes | Groq key. `GROQ_API_KEY_2` / `_3` are tried if it fails. |
| `ADMIN_KEY` | optional | Protects `/admin/chat-logs`. |
| `LOG_SHEET_WEBHOOK_URL`, `LOG_SHEET_SECRET` | optional | Save every chat to a Google Sheet — see below. |
| `CHAT_MODEL` | optional | Use a different Groq model. |

Render start command: `uvicorn main:app --host 0.0.0.0 --port $PORT` (build: `pip install -r requirements.txt`).

### Keeping chat logs in a Google Sheet
Render's free tier wipes its disk on every restart, so the CSV log doesn't last. `apps_script/ChatLogger.gs` is a tiny Apps Script web app that appends each exchange to a sheet:

1. Create a Google Sheet → **Extensions → Apps Script** → paste `apps_script/ChatLogger.gs`.
2. **Project Settings → Script properties** → add `LOG_SECRET` = any long random text, and `SHEET_ID` = the sheet's ID (the part of its address between `/d/` and `/edit`).
3. **Deploy → New deployment → Web app**, execute as *Me*, access *Anyone* → copy the URL.
4. In Render → **Environment**, add `LOG_SHEET_WEBHOOK_URL` (the URL) and `LOG_SHEET_SECRET` (the same text). Render redeploys and rows start arriving in the `ChatLogs` tab.

### Running it locally
```bash
pip install -r requirements.txt
echo "GROQ_API_KEY=your_key" > .env
uvicorn main:app --reload
```
Open `index.html` with VS Code Live Server (port 5500) — on `localhost` the chat widget talks to `http://127.0.0.1:8000` automatically.

## Folder map

```
index.html                 the whole site (pages are shown/hidden in place)
CSS_Files/                 one stylesheet per section
JSON_Files/                content for every section
Images/ Carousel1/ CSR/ BeyondWork/ Documents/   pictures and the resume
main.py                    chat backend (Render)
ingest.py                  builds data/portfolio.index from portfolio_content.json
portfolio_content.json     what the chat assistant knows
apps_script/ChatLogger.gs  optional Google Sheet chat log
admin/                     content editor (open admin/index.html in Chrome or Edge)
Achievements/              photos for each achievement
requirements.txt           backend packages (Render)
```
