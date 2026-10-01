# Module Audio Studio

Turns a rough module outline into rendered two-host training audio. An LXD seeds a module, approves each stage, notes lines that don't work, and renders the result through ElevenLabs. No prompt writing, and no backend server.

## How it's built

- **App:** Vite, React, React Router (hash routes) and Tailwind, deployed to GitHub Pages. Runs entirely in the browser.
- **Storage:** settings and the kit in `localStorage`; modules and rendered audio in IndexedDB (audio is far too large for `localStorage`). Nothing leaves the browser except the API calls.
- **Worker:** a Cloudflare Worker that holds the Anthropic and ElevenLabs keys and proxies two routes: `/anthropic/*` and `/elevenlabs/*`. If you already run a proxy worker for Anthropic, you can add the ElevenLabs route to it instead.

## Setup

### 1. Deploy the worker

```
cd worker
npm install
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put ELEVENLABS_API_KEY
npx wrangler secret put APP_TOKEN        # optional shared token the app sends as x-app-token
```

Edit `ALLOWED_ORIGINS` in `wrangler.toml` to your GitHub Pages origin and `http://localhost:5173`, then `npx wrangler deploy`.

### 2. Run the app

```
cd app
npm install
npm run dev
```

Open Settings, paste the worker URL (and app token if you set one), click **Load my voices and models**, pick the ElevenLabs model, and map each speaker (DANA, RAY, JACOB) to a voice.

### 3. Deploy the app

Push to `main`. The workflow in `.github/workflows/pages.yml` builds `app/` and publishes it. In the repo settings, set Pages to deploy from GitHub Actions.

## Using it

1. **Seed.** Paste an outline or seed file and upload source files. Tick the SME box only when the claims ledger is signed; until then every audio file is named `DRAFT-...`.
2. **Stages 2 to 8.** Run each stage, read the output, then approve it or write notes and revise. On script stages, click any line to leave a note and an optional better version. **Save as rule** adds the note to the kit so every future module benefits.
3. **Editor pass** runs in a fresh conversation, so the reviewer hasn't seen itself write the script. Paste the fixes you agree with and apply them.
4. **Performance pass** returns render data (parts, segments, holds, flags, listens).
5. **Render.** Render one part, check the voices, then render the rest. Build any listen from its parts. Each render records where every segment starts, including the seam where an add-on is spliced in (the start of the part's ending segment). **Render all parts** finishes by downloading a prototype package (`manifest.json` plus the audio); **Export for prototype** does the same at any time. You can also upload `.txt` parts with `NAME: text` lines (and `⟨ HOLD 3s ⟩` cues) to render scripts made elsewhere.

## The kit

The kit (production guide, voice example, pattern library, lint checklist and the stage prompts) is editable on the Kit page. It is the tool's settings: improving a rule never needs a code change. Export it and share the file so other LXDs work from the same rules; import to pick up someone else's.

## Known limits in 0.1

- Regenerating happens per part, not per line. Fine delivery fixes still happen in ElevenLabs Studio.
- Stings and beds are silence placeholders (`Gap between parts` in Settings). No sound effects are generated yet.
- The kit and modules live in one browser. Sharing is by export and import. A shared kit could move to Cloudflare KV behind the same worker.
- Long stages can hit the output token limit. The app says so when it happens; raise it in Settings and run the stage again.
- Audio downloads are WAV. Convert to MP3 later if file size matters.
