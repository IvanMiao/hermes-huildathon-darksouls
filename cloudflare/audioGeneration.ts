import type { MusicArtifactData, VoiceArtifactData } from "../runner/contracts";

export const BOSS_MUSIC_DURATION_MS = 30_000;

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

export interface GeneratedAudio<T> {
  bytes: ArrayBuffer;
  contentType: string;
  evidence: Omit<T, "storageId" | "url">;
}

type AudioFetcher = (url: string, init: RequestInit) => Promise<Response>;

interface MusicRetryOptions {
  fetcher?: AudioFetcher;
  wait?: (milliseconds: number) => Promise<void>;
  maxAttempts?: number;
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

const ELEVENLABS_VOICE_SETTINGS = {
  stability: 0.42,
  similarity_boost: 0.75,
  style: 0,
  use_speaker_boost: true,
  speed: 0.88,
} as const;

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

async function readElevenLabsError(response: Response): Promise<string> {
  return (await response.text()).slice(0, 300);
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

export async function generateVoiceAudio(
  apiKey: string,
  voiceId: string,
  text: string,
  fetcher: AudioFetcher = fetch,
): Promise<GeneratedAudio<VoiceArtifactData>> {
  const response = await fetcher(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: ELEVENLABS_VOICE_SETTINGS,
      }),
    },
  );
  if (!response.ok) {
    throw new Error(`ElevenLabs returned ${response.status}: ${await readElevenLabsError(response)}`);
  }

  const requestId = response.headers.get("request-id");
  const traceId = response.headers.get("x-trace-id");
  const characterCostHeader = response.headers.get("character-cost");
  const characterCost = characterCostHeader === null
    ? undefined
    : Number(characterCostHeader);
  return {
    bytes: await response.arrayBuffer(),
    contentType: response.headers.get("content-type") ?? "audio/mpeg",
    evidence: {
      text,
      model: "eleven_multilingual_v2",
      source: "elevenlabs_generated",
      ...(requestId ? { requestId } : {}),
      ...(traceId ? { traceId } : {}),
      ...(characterCost !== undefined && Number.isFinite(characterCost)
        ? { characterCost }
        : {}),
    },
  };
}

export async function generateMusicAudio(
  apiKey: string,
  direction: BossMusicDirection,
  options: MusicRetryOptions = {},
): Promise<GeneratedAudio<MusicArtifactData>> {
  const compositionPlan = createBossMusicCompositionPlan(direction);
  const response = await composeBossMusicWithRetry(apiKey, compositionPlan, options);
  const songId = response.headers.get("song-id");
  const requestId = response.headers.get("request-id");
  const traceId = response.headers.get("x-trace-id");
  return {
    bytes: await response.arrayBuffer(),
    contentType: response.headers.get("content-type") ?? "audio/mpeg",
    evidence: {
      durationMs: BOSS_MUSIC_DURATION_MS,
      model: "music_v2",
      source: "elevenlabs_generated",
      compositionPlan,
      direction,
      ...(songId ? { songId } : {}),
      ...(requestId ? { requestId } : {}),
      ...(traceId ? { traceId } : {}),
    },
  };
}
