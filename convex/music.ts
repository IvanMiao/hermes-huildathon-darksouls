import { action } from "./_generated/server";
import { v } from "convex/values";

export const BOSS_MUSIC_DURATION_MS = 30_000;

const musicDirectionValidator = v.object({
  bossName: v.string(),
  bossTitle: v.string(),
  motif: v.string(),
  cameraMood: v.union(
    v.literal("watchful"),
    v.literal("oppressive"),
    v.literal("ceremonial"),
  ),
  archetype: v.union(
    v.literal("duel"),
    v.literal("procession"),
    v.literal("revelation"),
  ),
  arenaTheme: v.union(
    v.literal("gothic-library"),
    v.literal("ruined-cathedral"),
    v.literal("void-sanctum"),
  ),
});

export interface BossMusicDirection {
  bossName: string;
  bossTitle: string;
  motif: string;
  cameraMood: "watchful" | "oppressive" | "ceremonial";
  archetype: "duel" | "procession" | "revelation";
  arenaTheme: "gothic-library" | "ruined-cathedral" | "void-sanctum";
}

interface CompositionChunk {
  text: string;
  duration_ms: number;
  positive_styles: string[];
  negative_styles: string[];
  context_adherence: "high";
}

export interface BossMusicCompositionPlan {
  chunks: CompositionChunk[];
}

const CAMERA_STYLES: Record<BossMusicDirection["cameraMood"], string> = {
  watchful: "restrained tension with patient negative space",
  oppressive: "claustrophobic orchestral weight and mounting dread",
  ceremonial: "solemn ritual pacing with monumental sacred resonance",
};

const ARCHETYPE_STYLES: Record<BossMusicDirection["archetype"], string> = {
  duel: "focused one-on-one dramatic tension",
  procession: "relentless processional pulse and advancing low percussion",
  revelation: "harmonic inversion and uncanny suspended resolution",
};

const ARCHETYPE_MOTIFS: Record<BossMusicDirection["archetype"], string> = {
  duel: "an original descending minor-third motif answered by a tritone",
  procession: "an original three-note processional motif with a displaced final beat",
  revelation: "an original suspended four-note motif that returns in harmonic inversion",
};

const ARENA_STYLES: Record<BossMusicDirection["arenaTheme"], string> = {
  "gothic-library": "dusty chamber acoustics, muted bells, and old wooden resonance",
  "ruined-cathedral": "decayed cathedral grandeur with distant iron bells",
  "void-sanctum": "vast dark space, sub-bass drone, and spectral choral texture",
};

const NEGATIVE_STYLES = [
  "lyrics or intelligible words",
  "heroic major-key resolution",
  "modern electronic synths",
  "trailer braams",
  "recognizable existing melodies",
  "franchise themes or quoted soundtrack material",
];

function chunk(
  text: string,
  durationMs: number,
  styles: string[],
): CompositionChunk {
  return {
    text,
    duration_ms: durationMs,
    positive_styles: styles,
    negative_styles: NEGATIVE_STYLES,
    context_adherence: "high",
  };
}

/** Produces an original, section-addressable score plan for the fixed battle runtime. */
export function createBossMusicCompositionPlan(
  direction: BossMusicDirection,
): BossMusicCompositionPlan {
  const sharedStyles = [
    "original dark mythic fantasy boss score",
    "cinematic orchestral instrumental",
    "low strings, contrabass, bassoons, French horns, and deep ceremonial drums",
    "sparse wordless mixed choir used only as texture",
    "tragic inevitability rather than heroic triumph",
    "84 BPM in 6/8 meter",
    CAMERA_STYLES[direction.cameraMood],
    ARCHETYPE_STYLES[direction.archetype],
    ARENA_STYLES[direction.arenaTheme],
  ];
  const motifDirection = ARCHETYPE_MOTIFS[direction.archetype];
  const subject = `the ritual adversary in this ${direction.archetype} encounter`;

  return {
    chunks: [
      chunk(
        `[Invocation]\n{Instrumental introduction for ${subject}; ${motifDirection}}`,
        3_000,
        [...sharedStyles, "near silence, low drone, one distant bell, isolated choir breath"],
      ),
      chunk(
        `[First Rite]\n{Restrained confrontation with ${subject}; develop ${motifDirection}}`,
        11_000,
        [...sharedStyles, "mournful low strings, sparse percussion, unresolved harmony"],
      ),
      chunk(
        "[Revelation]\n{Abrupt silence followed by one brass and choir impact; no fade}",
        3_000,
        [...sharedStyles, "phase transition impact, sudden harmonic rupture"],
      ),
      chunk(
        `[Second Rite]\n{Transform ${motifDirection} into a monumental hostile form}`,
        10_000,
        [...sharedStyles, "urgent string ostinato, dissonant brass, heavier ritual drums"],
      ),
      chunk(
        "[Aftermath]\n{Rhythm collapses into one unresolved low chord and a final distant bell}",
        3_000,
        [...sharedStyles, "ruined aftermath, unresolved final cadence"],
      ),
    ],
  };
}

function requireMusicCredentials(integrationToken: string): string {
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

async function readElevenLabsError(response: Response): Promise<string> {
  return (await response.text()).slice(0, 300);
}

type MusicFetcher = (url: string, init: RequestInit) => Promise<Response>;

interface MusicRetryOptions {
  fetcher?: MusicFetcher;
  wait?: (milliseconds: number) => Promise<void>;
  maxAttempts?: number;
}

const waitForRetry = (milliseconds: number): Promise<void> => (
  new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds))
);

/** Retries only transient ElevenLabs server failures; contract errors fail immediately. */
export async function composeBossMusicWithRetry(
  apiKey: string,
  compositionPlan: BossMusicCompositionPlan,
  options: MusicRetryOptions = {},
): Promise<Response> {
  const fetcher = options.fetcher ?? fetch;
  const wait = options.wait ?? waitForRetry;
  const maxAttempts = options.maxAttempts ?? 3;
  const body = JSON.stringify({
    composition_plan: compositionPlan,
    model_id: "music_v2",
    sign_with_c2pa: true,
  });

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetcher(
      "https://api.elevenlabs.io/v1/music?output_format=mp3_48000_192",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "xi-api-key": apiKey,
        },
        body,
      },
    );
    if (response.ok) return response;

    const details = await readElevenLabsError(response);
    const transientServerFailure = response.status >= 500 && response.status <= 599;
    if (!transientServerFailure || attempt === maxAttempts) {
      throw new Error(`ElevenLabs music generation returned ${response.status}: ${details}`);
    }
    await wait(500 * (2 ** (attempt - 1)));
  }

  throw new Error("ElevenLabs music generation exhausted its retry budget.");
}

export const generateBossMusic = action({
  args: {
    integrationToken: v.string(),
    direction: musicDirectionValidator,
  },
  handler: async (ctx, { integrationToken, direction }) => {
    const apiKey = requireMusicCredentials(integrationToken);
    const compositionPlan = createBossMusicCompositionPlan(direction);
    const musicResponse = await composeBossMusicWithRetry(apiKey, compositionPlan);

    const storageId = await ctx.storage.store(await musicResponse.blob());
    const url = await ctx.storage.getUrl(storageId);
    if (!url) {
      throw new Error("Convex stored the music but did not return a public URL.");
    }
    const songId = musicResponse.headers.get("song-id");
    const requestId = musicResponse.headers.get("request-id");
    const traceId = musicResponse.headers.get("x-trace-id");

    return {
      storageId,
      url,
      durationMs: BOSS_MUSIC_DURATION_MS,
      model: "music_v2" as const,
      source: "elevenlabs_generated" as const,
      compositionPlan,
      direction,
      ...(songId ? { songId } : {}),
      ...(requestId ? { requestId } : {}),
      ...(traceId ? { traceId } : {}),
    };
  },
});
