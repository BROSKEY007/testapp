# Deploying with only a laptop and internet

You do not need your own server. Three options, from most reliable for a demo to least. Use Option 1 as your safety net no matter what else you pick.

## Option 1: Static export (no server at all, cannot go down)

The scoring is deterministic, so every ranking can be computed ahead of time and served as plain files.

```bash
npm install
npm run train
npm run export
```

This writes `dist-static/` with a ready-made demo page (`index.html`), the browser-side model (`analog-model.js`), `model.json`, `predictions.json`, `challenge-sites.json`, `sites.json` and `data-report.json`.

Preview locally with `npx serve dist-static`, then open the address it prints. Opening `index.html` by double-click will not work because browsers block file loading from `file://`.

Host that folder for free:
- **GitHub Pages:** push `dist-static/` to a repo, Settings, Pages, deploy from branch.
- **Vercel or Netlify:** drag the folder into the dashboard, or connect the repo.

Your teammate's frontend fetches `https://<host>/predictions.json` instead of calling `/api/analog/predictions`. The result shape is identical. Scoring a new location also works with no server: load `model.json` and `analog-model.js`, then call `AnalogModel.predict(model, {...})` in the browser. Re-run `npm run train` and `npm run export` whenever the data changes.

## Option 2: Free hosted API on Render (live endpoints, needs only a GitHub account)

1. Push the `analog-engine` folder (or the backend containing it) to GitHub.
2. render.com, sign in with GitHub, New, Blueprint (it reads `render.yaml`) or New, Web Service.
3. Build `npm install`, start `npm start`.
4. Open `https://<name>.onrender.com/api/analog/health` and check `model_loaded` is true. Commit `model/analog-model.json` so the server has it.

Free instances sleep when idle and the first request can take 30 to 60 seconds. Warm it up a few minutes before you present. Railway and Fly.io work the same way but their free allowances change, so check current terms.

## Option 3: Run on your laptop and expose it with a tunnel (demo only)

```bash
npm start                                          # runs on port 3001
cloudflared tunnel --url http://localhost:3001     # prints a public https URL
```

Cloudflare quick tunnels need no account, but the URL changes every run and dies when the laptop sleeps or the terminal closes. Good for a live test with your teammate, risky as the only demo path. Install `cloudflared` from Cloudflare's downloads page. ngrok is an alternative.

## Recommended plan

1. Build against Option 3 while developing together.
2. Deploy Option 2 for the shared live API.
3. Generate Option 1 the day before submission and make the frontend fall back to it if the API does not answer in 3 seconds.

## Data and licensing

If the dataset is large, licensed or restricted, do not commit it to a public repo. Use a private repo, or export only the derived JSON.
