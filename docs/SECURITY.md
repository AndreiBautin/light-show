# Security

## Threat model

Light Show is a static site: HTML, one JS bundle, one stylesheet, a service
worker, icons. There is **no server, no account, no database, no cookie and
no third-party request**. Audio is analysed in the browser and never leaves
it. So most of the usual list is structurally absent rather than handled:

| Absent                              | Why it does not apply                                  |
| ----------------------------------- | ------------------------------------------------------ |
| Authentication, authorisation, IDOR | No accounts and nothing per-user on a server           |
| SQL/command injection, SSRF         | No backend to inject into or make requests from        |
| CSRF, session theft                 | No session and no state-changing endpoint              |
| Data breach                         | Nothing is stored anywhere but the visitor's own cache |

What is real:

1. **Script injection into the page**, which would have access to the
   microphone or shared-tab stream once granted.
2. **Untrusted input**: an audio file the visitor picks, and the URL query.
3. **The supply chain**: the build toolchain and the CI actions that
   publish the site.
4. **Photosensitivity**: a visualiser that strobes can trigger seizures.
   It is a safety risk rather than a security one, and treated with the
   same rigour.

## Controls

**Content-Security-Policy** (production `index.html`, from
`vite.config.ts`): `default-src 'self'`, `script-src 'self'` with no inline
script, `object-src 'none'`, `base-uri 'self'`, `form-action 'none'`;
`media-src` also allows `blob:` for a picked file. The DOM is only written
with `textContent` and `classList`, never `innerHTML`. Verified against the
built site: no violations, and file playback still works. GitHub Pages
cannot set response headers, so `frame-ancestors` (meta-ineligible) and
HSTS are the platform's to provide; that gap is accepted.

**Input at trust boundaries**:

- _Picked file_ (`ui/file-check.ts`): must be audio by MIME type (or by
  extension when the type is missing) and between 1 byte and 300 MB before
  it is decoded. A failed decode releases its object URL and audio
  context. The `accept` attribute is only a hint and is not relied on.
- _URL_: `?scene=` is matched against the known scene ids, so an unknown
  value means "no choice"; `?debug` is a boolean. Neither is ever written
  into the page as markup.
- _Build-time env_: `VITE_COMMIT` is shown only if it is a hex SHA
  (`platform/config.ts`, tested).

**Permissions**: the microphone and tab audio are requested only when the
visitor presses that button, and tracks are stopped when they switch
source. Nothing is recorded.

**Service worker** (`public/sw.js`): same-origin GETs only; caches only
complete `200` `basic` responses (never errors, redirects or opaque
bodies); prunes superseded build assets. Registered only in production.

**Photosensitivity**: full-screen flashes are limited to 3 per second in
any one-second window (WCAG 2.3.1) by `analysis/flash.ts`; the limit can be
configured lower, never higher, and the OS reduce-motion setting turns
flashes off entirely. Both are tested end to end in `pipeline.test.ts`.

**Logging**: one logger (`platform/logger.ts`), event names and scalars
only; lint forbids `console` elsewhere. File names are never logged, only
MIME type and size.

## Supply chain and CI

- **No runtime dependencies.** Everything shipped is this repo's code.
- `npm ci` with a lockfile; `npm audit --audit-level=high` in CI.
- **Secret scan**: gitleaks over the full history on every push.
  The history was also checked by hand before the repository went public.
- **Actions pinned to commit SHAs**, CI with read-only `contents`
  permission; the deploy job alone has `pages: write`.
- **Dependabot** for npm (minor/patch grouped, majors separate) and Actions.

## Remaining risks

- No response headers on GitHub Pages: no HSTS preload, no
  `frame-ancestors`, so the site can be framed by another page. Impact is
  low: there is nothing to click-jack but scene buttons.
- `npm audit` covers known advisories only; the toolchain (Vite, Vitest,
  ESLint, TypeScript) runs with full access on the developer's machine and
  in CI.
- Tab audio relies on the browser's own share picker for consent; the app
  cannot see or limit what the visitor chooses to share.
