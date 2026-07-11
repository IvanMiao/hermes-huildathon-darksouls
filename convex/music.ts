import { action } from "./_generated/server";
import { v } from "convex/values";

const FABLE_MUSIC_DURATION_MS = 64_000;

const FABLE_MUSIC_PROMPT = `
Create an original instrumental score for a dark mythic boss encounter.

The music should evoke decayed sacred grandeur, ancient ritual, tragic
inevitability, and restrained terror. Use low strings, contrabass, bassoons,
French horns, deep ceremonial drums, distant bells, and a sparse wordless mixed
choir.

Tempo: 84 BPM, 6/8 meter.
Core motif: a descending minor third followed by a tritone. Keep the motif
recognizable as the orchestration intensifies.

[Invocation — 6 seconds]
Nearly silent. Low drone, distant bell, isolated choir breath.

[First Rite — 24 seconds]
Restrained and mournful. Sparse percussion, low strings, unresolved harmony.
The player should feel watched rather than immediately attacked.

[Revelation — 4 seconds]
Abrupt silence followed by a brass and choir impact. No fade.

[Second Rite — 24 seconds]
The same motif becomes monumental and hostile. Denser strings, heavier
ceremonial drums, dissonant brass, urgent ostinato, tragic rather than heroic.

[Aftermath — 6 seconds]
The rhythm collapses. One unresolved low chord and a final distant bell.

No lyrics or intelligible words. No heroic major-key resolution. No modern
electronic synths. No trailer braams. No recognizable melody from an existing
work or franchise. Avoid long reverb tails at section boundaries.
`.trim();

function requireMusicCredentials(integrationToken: string) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const expectedToken = process.env.STUDIO_INTEGRATION_TOKEN;
  if (!expectedToken || integrationToken !== expectedToken) {
    throw new Error("Unauthorized studio integration request.");
  }
  if (!apiKey) {
    throw new Error("ElevenLabs credentials are not configured in Convex.");
  }
  return apiKey;
}

async function readElevenLabsError(response: Response) {
  return (await response.text()).slice(0, 300);
}

export const generateFableBossMusic = action({
  args: { integrationToken: v.string() },
  handler: async (ctx, { integrationToken }) => {
    const apiKey = requireMusicCredentials(integrationToken);
    const headers = {
      "content-type": "application/json",
      "xi-api-key": apiKey,
    };

    const planResponse = await fetch("https://api.elevenlabs.io/v1/music/plan", {
      method: "POST",
      headers,
      body: JSON.stringify({
        prompt: FABLE_MUSIC_PROMPT,
        music_length_ms: FABLE_MUSIC_DURATION_MS,
        model_id: "music_v2",
      }),
    });
    if (!planResponse.ok) {
      const details = await readElevenLabsError(planResponse);
      throw new Error(`ElevenLabs music plan returned ${planResponse.status}: ${details}`);
    }

    const compositionPlan: unknown = await planResponse.json();
    if (
      !compositionPlan
      || typeof compositionPlan !== "object"
      || !("chunks" in compositionPlan)
      || !Array.isArray(compositionPlan.chunks)
      || compositionPlan.chunks.length === 0
    ) {
      throw new Error("ElevenLabs returned an invalid Music v2 composition plan.");
    }

    const musicResponse = await fetch(
      "https://api.elevenlabs.io/v1/music?output_format=mp3_48000_192",
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          composition_plan: compositionPlan,
          model_id: "music_v2",
          sign_with_c2pa: true,
        }),
      },
    );
    if (!musicResponse.ok) {
      const details = await readElevenLabsError(musicResponse);
      throw new Error(`ElevenLabs music generation returned ${musicResponse.status}: ${details}`);
    }

    const storageId = await ctx.storage.store(await musicResponse.blob());
    const url = await ctx.storage.getUrl(storageId);
    if (!url) {
      throw new Error("Convex stored the music but did not return a public URL.");
    }

    return {
      storageId,
      url,
      durationMs: FABLE_MUSIC_DURATION_MS,
      model: "music_v2" as const,
      source: "elevenlabs_generated" as const,
      compositionPlan,
    };
  },
});
