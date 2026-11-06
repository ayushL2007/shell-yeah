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

This app uses Vercel's zero-configuration Flask support: Vercel detects the `app` instance in `app.py` and installs Flask from `requirements.txt`. The included `vercel.json` enables Fluid Compute and leaves framework detection, Python builds, and routing to Vercel. In the Vercel project settings, use **Flask** if offered, or leave the framework preset on automatic detection; do not force **Other**. Static assets are in `public/` so Vercel can serve them from its CDN; Flask is configured to serve the same files during local development.

1. Import this repository in the [Vercel dashboard](https://vercel.com/new), or install the Vercel CLI and run `vercel` from the project root.
2. Keep the project root as the **Root Directory**. Set the framework to **Flask** if available, or leave it on automatic detection; leave build settings at their defaults.
3. Deploy. Vercel will create a preview deployment; run `vercel --prod` (or promote it in the dashboard) to publish production.

No separate API wrapper or custom build command is needed.

## Scores and Upstash Redis

Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` on the Flask server. In PowerShell, set them before starting Flask (replace the placeholders with the REST URL and token from your Upstash database):

```powershell
$env:UPSTASH_REDIS_REST_URL = "https://your-database.upstash.io"
$env:UPSTASH_REDIS_REST_TOKEN = "your-upstash-rest-token"
python app.py
```

In Vercel, add both as project environment variables and redeploy. The terminal's `login +15551234567 "Ada Lovelace"` command uses the phone number as the player's stable ID and stores the name and score in Upstash Redis. The leaderboard ranks scores by that ID but displays names and points only; it does not expose phone numbers. Phone numbers are not verified, so this is a game profile—not secure authentication. Collect phone numbers only with the player's consent. Login, score saving, and the leaderboard show an error when Redis is not configured or unavailable.

The simulated terminal awards each objective once per phone number: 10 points for `touch newfile.txt`, `mkdir destination`, and copying or moving `test.txt` into `destination`; 20 points for changing into `destination` and finding `hello` in `test.txt` with `grep -i`; and 20 points for saving an exact `#hello` line in `editme` with the practice editor.

## Practice terminal

The terminal is a browser-only simulator. It never runs shell commands on the host computer. Use the **Full screen** control to expand the terminal; press `Esc` to return. Type `help` to see supported commands, including `login`, `pwd`, `cd`, `mkdir -p`, `touch`, `cat`, `cp`, `mv`, `grep`, `vim`, `ls -la`, `ll`, `history`, `clear`, and `echo`. Shell operators include `|` for piping output, `&&` to run the next command after success, `||` to run it after failure, and `&` to run a simulated background job. The terminal also supports command history (`↑`/`↓`), Tab completion, and `Ctrl+L` to clear the screen. The vim practice editor supports Insert/Normal modes and `:w`, `:q`, and `:wq`.
