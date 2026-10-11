# Contributing

Thanks for pitching in. This app runs the monthly fitness challenges for a few F3 regions, so changes ship to real PAX quickly. Keep PRs small and focused.

## Bugs and ideas

[Open an issue](https://github.com/KtodaZ/f3challenges/issues). For a bug, say what you did, what you expected, and what happened, plus your phone and whether you use the installed app or the browser.

## Running it locally

You need Node 20+, pnpm 10, and your own Firebase project (Firestore, Cloud Messaging, Storage). Java 21+ is only needed for the emulator tests.

```bash
pnpm install
cp .env.local.example .env.local   # fill in your Firebase project's values
pnpm dev                            # http://localhost:3000
```

The Firebase Admin values come from a service account key. `OPENAI_API_KEY`, `ADMIN_BOOTSTRAP_EMAILS` and `NEXT_PUBLIC_DEBUG_URL` are optional.

## Before you open a PR

```bash
pnpm test           # unit tests
pnpm lint
npx tsc --noEmit
pnpm test:emulator  # Firestore rules + admin API (needs Java)
```

CI runs all of these. The commit hooks run lint, so don't bypass them with `--no-verify`.

## How the code is laid out

[`CLAUDE.md`](CLAUDE.md) is the real guide: architecture, conventions, and the gotchas that have bitten before. Read it before changing anything substantial. The rules contributors most often trip on:

- **Challenges are data.** A new challenge is one object appended to `CHALLENGES` in `shared/src/challenges.ts`, and a new region is one object in `shared/src/regions.ts`.
- **Changelog.** If PAX would notice your change, add a plain-English bullet to `src/lib/changelog.ts`.
- **Firestore writes** go through the helpers in `src/lib/firestore.ts` and wrap data in `stripUndefined()`.
- **Server code** uses `adminDb` / `adminMessaging` from `src/lib/firebase-admin.ts`, never `firebase-admin` directly.

Multi-region design notes are in [`docs/MULTI_REGION.md`](docs/MULTI_REGION.md), and known rough edges are in [`docs/TECH_DEBT.md`](docs/TECH_DEBT.md).

## Running it for your own region

Fork it and deploy to your own Vercel and Firebase project. Alternatively, open an issue to ask about adding your region to [f3challenges.com](https://f3challenges.com).

## License

By contributing, you agree your work is released under the [MIT License](LICENSE).
