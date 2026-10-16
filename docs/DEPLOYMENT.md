# Deployment

**Live:** <https://andreibautin.github.io/light-show/>

## Where and why

**GitHub Pages**, deployed by `.github/workflows/pages.yml` on every push to
`main`. The site is static, the repository is already on GitHub, and Pages
deploys with the workflow's own token: no new account, no secret, no card.

Rejected: **Cloudflare Pages / Netlify** (equally free, but a second account
and a deploy token to manage, for no gain on a static site); **Vercel**
(the same, plus commercial-use terms to check); anything with a server
(there is nothing for one to do).

## How a deploy runs

1. Push to `main` (directly or by merging a PR).
2. `pages.yml` checks out, `npm ci`, runs **`npm run verify`**. A red verify
   stops here; nothing is published.
3. `npm run build` with three build-time variables:
   - `BASE_PATH=/light-show/`, since a project page is served under the repo name;
   - `SITE_URL`, the absolute URL for the share card;
   - `VITE_COMMIT`, stamped into the page as `build-commit` and shown in
     the panel as "build abc1234".
4. Upload `dist/` and deploy to Pages.
5. **Smoke test**: fetch the live URL until it serves this commit, then
   check the title, the CSP, the manifest and the service worker. A green
   deploy step only means an upload succeeded; this means the site answered.

`ci.yml` runs verify, the audit and the secret scan on every push and PR.
Branch protection on `main` requires those checks to pass before a PR can
merge; direct pushes by the maintainer stay possible (the local pre-push
hook runs verify first).

## Configuration

No secrets exist. Variables, all optional, are documented in
`.env.example`:

| Variable                      | Where | Effect                                                   |
| ----------------------------- | ----- | -------------------------------------------------------- |
| `VITE_LOG_LEVEL`              | page  | `debug`/`info`/`warn`/`error`; typos fall back to `info` |
| `VITE_MAX_FLASHES_PER_SECOND` | page  | 1–3, clamped; never above 3                              |
| `VITE_COMMIT`                 | page  | shown only if it is a hex SHA                            |
| `BASE_PATH`                   | build | where the site is served; the only place the path lives  |
| `SITE_URL`                    | build | enables the share-card tags                              |

`VITE_` values are compiled into the public bundle; none of them is, or
may ever be, a credential.

## Updating

Merge to `main`. Visitors get the new version on their next load: the
page is fetched network-first and the worker updates itself with no
prompt. An installed app does the same.

## Troubleshooting

| Symptom                                                  | Cause                                               | Fix                                                                           |
| -------------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------- |
| Assets 404 on the live site, fine locally                | Built without `BASE_PATH`                           | It is set in `pages.yml`; check a local `vite build` was not deployed by hand |
| Local build shows `/Program Files/Git/light-show/` paths | Git Bash rewrites `/light-show/`                    | `MSYS_NO_PATHCONV=1 BASE_PATH=/light-show/ npx vite build`                    |
| Dev app looks stale after `npm run preview`              | Preview's production worker left on the shared port | Reload once: dev builds unregister it                                         |
| Smoke test fails but deploy passed                       | Pages still serving the previous build              | It retries for ~2.5 min; re-run the job if Pages is slow                      |
| No install icon                                          | Not HTTPS, or manifest/worker missing               | Check DevTools → Application on the live site                                 |

## Free-tier limits

From GitHub's Pages limits page (checked 2026-10-16): sites up to 1 GB,
a soft 100 GB/month bandwidth limit, deployments time out after 10
minutes; the 10-builds-an-hour limit does not apply to Actions-based
deploys like this one. The site is ~0.55 MB including icons and ~70 KB
on a first visit, so the bandwidth allowance covers well over a million
visits a month.
