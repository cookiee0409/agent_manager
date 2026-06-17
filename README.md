# Agent Manager

2D office-style agent manager UI with Vercel serverless API routes for Google AI and Anthropic execution.

## Local Run

```powershell
$env:GOOGLE_API_KEY="your_google_ai_key"
$env:ANTHROPIC_API_KEY="your_anthropic_key"
npm run dev
```

Open:

```text
http://127.0.0.1:4173/index.html
```

## Vercel Environment Variables

Set these in Vercel Project Settings:

- `GOOGLE_API_KEY` or `GEMINI_API_KEY`
- `ANTHROPIC_API_KEY`

Optional model overrides:

- `GOOGLE_MODEL` or `GEMINI_MODEL`
- `ANTHROPIC_MODEL`

Use the Vercel framework preset `Other`. The repository's `vercel.json` explicitly builds the static frontend and the `api/*.js` serverless functions. `server.js` is only for local development.

## Security Note

API keys are read on the server side only. Do not put production keys into browser code or commit keys to GitHub.
