# Fast Convex + ElevenLabs setup

The runner remains the workflow source of truth. Convex mirrors completed runs
and owns the generated voice file used by published game routes.

```bash
npm install
npx convex dev
npx convex env set ELEVENLABS_API_KEY <key>
npx convex env set ELEVENLABS_VOICE_ID <voice-id>
npx convex env set STUDIO_INTEGRATION_TOKEN <long-random-value>
```

Copy the deployment URL printed by Convex into `.env.local` as both
`CONVEX_URL` and `VITE_CONVEX_URL`, and put the same integration token there;
see `.env.example`. The token protects voice generation and evidence writes;
published-run queries remain read-only and public.

Then run a real studio production:

```bash
npm run studio -- "your tweet text"
```

When `CONVEX_URL` is absent, the studio remains fully offline. When it is set,
the CLI reuses voice evidence already stored for the same run ID or invokes the
`studio:generateVoice` action, stores the ElevenLabs MP3 in Convex File Storage,
and upserts the complete P3 result into `studioRuns`. Integration failure is
reported but never changes the local QA or publication result.
