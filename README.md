# Shell Yeah

A beginner-friendly command-line field guide built with Flask. It includes lessons for pages 6–12, a command cheatsheet, and an interactive terminal for practicing in a simulated workspace.

## Run locally

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python app.py
```

Open the local address printed by Flask (usually `http://127.0.0.1:5000`).

## Deploy to Vercel

This app uses Vercel's zero-configuration Flask support: Vercel detects the `app` instance in `app.py` and installs Flask from `requirements.txt`. Static assets are in `public/` so Vercel can serve them from its CDN; Flask is configured to serve the same files during local development.

1. Import this repository in the [Vercel dashboard](https://vercel.com/new), or install the Vercel CLI and run `vercel` from the project root.
2. Keep the project root as the **Root Directory** and leave the framework preset and build settings on **Other / default**.
3. Deploy. Vercel will create a preview deployment; run `vercel --prod` (or promote it in the dashboard) to publish production.

No separate API wrapper or custom build command is needed.

## Practice terminal

The terminal is a browser-only simulator. It never runs shell commands on the host computer. Use the **Full screen** control to expand the terminal; press `Esc` to return. Type `help` to see supported commands, including `pwd`, `cd`, `mkdir -p`, `touch`, `cat`, `cp`, `mv`, `grep`, `vim`, `ls -la`, `ll`, `history`, `clear`, and `echo`. Shell operators include `|` for piping output, `&&` to run the next command after success, `||` to run it after failure, and `&` to run a simulated background job. The terminal also supports command history (`↑`/`↓`), Tab completion, and `Ctrl+L` to clear the screen. The vim practice editor supports Insert/Normal modes and `:w`, `:q`, and `:wq`.
