# Fast Convex + ElevenLabs setup

The runner remains the workflow source of truth. Convex mirrors completed runs
and owns the generated phase voice and boss music used by published game routes.

```bash
npm install
npx convex dev
npx convex env set ELEVENLABS_API_KEY <key>
npx convex env set ELEVENLABS_VOICE_ID <voice-id>
npx convex env set STUDIO_INTEGRATION_TOKEN <long-random-value>
```

Copy the deployment URL printed by Convex into `.env.local` as both
`CONVEX_URL` and `VITE_CONVEX_URL`, and put the same integration token there;
see `.env.example`. The token protects audio generation and evidence writes;
published-run queries remain read-only and public.

Then run a real studio production:

```bash
npm run studio -- "your tweet text"
```

When `CONVEX_URL` is absent, the studio remains fully offline. When it is set,
the CLI reuses audio evidence already stored for the same run ID or invokes
`studio:generateVoice` and `music:generateBossMusic` in parallel. Both MP3s are
stored in Convex File Storage; their metadata is appended as `VoiceArtifact`
and `MusicArtifact`, and the published recipe receives their HTTPS URLs before
the complete result is upserted into `studioRuns`. Integration failure is
reported separately from deterministic local QA and keeps the browser release
CTA locked.
