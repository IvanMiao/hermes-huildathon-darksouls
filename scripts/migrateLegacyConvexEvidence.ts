import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

const LEGACY_DEFAULT_ASSETS = [
  {
    runId: "demo-fable",
    filename: "voice.mp3",
    sourceUrl: "https://cheery-goat-595.eu-west-1.convex.cloud/api/storage/edc0ccec-1071-4c72-985c-e6126e883490",
  },
  {
    runId: "demo-fable",
    filename: "music.mp3",
    sourceUrl: "https://cheery-goat-595.eu-west-1.convex.cloud/api/storage/946f7c4d-23c2-4152-a594-d2858f7a3aa2",
  },
] as const;

if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

const evidenceUrl = process.env.CLOUDFLARE_EVIDENCE_URL?.replace(/\/$/, "");
const integrationToken = process.env.STUDIO_INTEGRATION_TOKEN;
if (!evidenceUrl || !integrationToken) {
  throw new Error(
    "CLOUDFLARE_EVIDENCE_URL and STUDIO_INTEGRATION_TOKEN are required.",
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function endpoint(path: string): string {
  return new URL(path, `${evidenceUrl}/`).toString();
}

async function responseJson(response: Response): Promise<unknown> {
  try {
    return await response.json() as unknown;
  } catch {
    return null;
  }
}

async function requireOk(response: Response, label: string): Promise<unknown> {
  const body = await responseJson(response);
  if (response.ok) return body;
  const detail = isRecord(body) && typeof body.error === "string"
    ? body.error
    : `HTTP ${response.status}`;
  throw new Error(`${label}: ${detail}`);
}

async function uploadLegacyArtifact(
  runId: string,
  filename: "voice.mp3" | "music.mp3",
  sourceUrl: string,
): Promise<{ storageId: string; url: string }> {
  const source = await fetch(sourceUrl);
  if (!source.ok) {
    throw new Error(`Could not download ${sourceUrl}: HTTP ${source.status}`);
  }
  const uploaded = await requireOk(await fetch(endpoint(
    `/api/evidence/artifacts/${encodeURIComponent(runId)}/${filename}`,
  ), {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${integrationToken}`,
      "Content-Type": source.headers.get("content-type") ?? "audio/mpeg",
    },
    body: await source.arrayBuffer(),
  }), `Could not upload ${runId}/${filename}`);
  if (
    !isRecord(uploaded)
    || typeof uploaded.storageId !== "string"
    || typeof uploaded.url !== "string"
  ) {
    throw new Error(`Cloudflare returned invalid metadata for ${runId}/${filename}.`);
  }
  return { storageId: uploaded.storageId, url: uploaded.url };
}

function rewriteArtifact(
  value: unknown,
  voice: { storageId: string; url: string } | undefined,
  music: { storageId: string; url: string } | undefined,
): unknown {
  if (!isRecord(value) || !isRecord(value.data)) return value;
  if (value.kind === "VoiceArtifact" && voice) {
    return { ...value, data: { ...value.data, ...voice } };
  }
  if (value.kind === "MusicArtifact" && music) {
    return { ...value, data: { ...value.data, ...music } };
  }
  return value;
}

async function migrateRun(value: unknown): Promise<void> {
  if (!isRecord(value) || typeof value.runId !== "string") {
    throw new Error("Legacy export contains a document without a runId.");
  }
  const runId = value.runId;
  const legacyVoice = isRecord(value.voice) && typeof value.voice.url === "string"
    ? value.voice
    : undefined;
  const legacyMusic = isRecord(value.music) && typeof value.music.url === "string"
    ? value.music
    : undefined;
  const legacyVoiceUrl = legacyVoice?.url;
  const legacyMusicUrl = legacyMusic?.url;
  const voiceLocation = typeof legacyVoiceUrl === "string"
    ? await uploadLegacyArtifact(runId, "voice.mp3", legacyVoiceUrl)
    : undefined;
  const musicLocation = typeof legacyMusicUrl === "string"
    ? await uploadLegacyArtifact(runId, "music.mp3", legacyMusicUrl)
    : undefined;
  const voice = legacyVoice && voiceLocation
    ? {
        ...legacyVoice,
        model: typeof legacyVoice.model === "string"
          ? legacyVoice.model
          : "eleven_multilingual_v2",
        ...voiceLocation,
      }
    : undefined;
  const music = legacyMusic && musicLocation
    ? { ...legacyMusic, ...musicLocation }
    : undefined;
  const recipe = structuredClone(value.recipe);
  if (isRecord(recipe)) {
    if (voice && isRecord(recipe.boss) && isRecord(recipe.boss.voice)) {
      recipe.boss.voice.url = voice.url;
    }
    if (music && isRecord(recipe.presentation) && isRecord(recipe.presentation.music)) {
      recipe.presentation.music.url = music.url;
    }
  }
  const artifacts = Array.isArray(value.artifacts)
    ? value.artifacts.map((artifact) => rewriteArtifact(artifact, voiceLocation, musicLocation))
    : [];
  const inputText = typeof value.inputText === "string"
    ? value.inputText
    : isRecord(recipe) && isRecord(recipe.source) && typeof recipe.source.text === "string"
      ? recipe.source.text
      : null;
  if (
    (value.status !== "published" && value.status !== "release_blocked")
    || !inputText
    || !isRecord(recipe)
    || !Array.isArray(value.events)
    || !isRecord(value.qaReport)
  ) {
    throw new Error(`Legacy run ${runId} does not match the expected evidence contract.`);
  }

  await requireOk(await fetch(endpoint(
    `/api/evidence/runs/${encodeURIComponent(runId)}`,
  ), {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${integrationToken}`,
      "Content-Type": "application/json",
      "X-Soulloom-Legacy-Migration": "1",
    },
    body: JSON.stringify({
      runId,
      status: value.status,
      inputText,
      recipe,
      events: value.events,
      artifacts,
      qaReport: value.qaReport,
      voice,
      music,
    }),
  }), `Could not migrate run ${runId}`);
}

async function readLegacyDocuments(path: string): Promise<unknown[]> {
  const contents = await readFile(path, "utf8");
  return contents
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as unknown);
}

for (const asset of LEGACY_DEFAULT_ASSETS) {
  await uploadLegacyArtifact(asset.runId, asset.filename, asset.sourceUrl);
  console.log(`Migrated default asset ${asset.filename}.`);
}

const exportPath = process.argv[2];
if (exportPath) {
  const documents = await readLegacyDocuments(exportPath);
  for (const document of documents) {
    await migrateRun(document);
  }
  console.log(`Migrated ${documents.length} historical run(s).`);
} else {
  console.log("No Convex JSONL export supplied; only default audio assets were migrated.");
}
