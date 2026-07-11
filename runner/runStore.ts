import { appendFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { GameRecipeV0 } from "../src/game-recipe/types";
import {
  type ArtifactDataByKind,
  type ArtifactEnvelope,
  type ArtifactKind,
  type ArtifactSource,
  type AnyArtifactEnvelope,
  type PublishedRelease,
  type StudioActor,
  type StudioEvent,
} from "./contracts";
import { assertArtifactData, type ValidatedArtifactKind } from "./schemas";

const SAFE_RUN_ID = /^[a-z0-9][a-z0-9-]{0,79}$/;

interface EventInput {
  actor: StudioActor;
  type: StudioEvent["type"];
  status: StudioEvent["status"];
  summary: string;
  artifact?: StudioEvent["artifact"];
  owner?: StudioEvent["owner"];
}

interface WriteArtifactInput<K extends ArtifactKind> {
  kind: K;
  actor: StudioActor;
  source: ArtifactSource;
  data: ArtifactDataByKind[K];
}

export interface RunStoreObserver {
  onEvent?: (event: StudioEvent) => void;
  onArtifact?: (artifact: AnyArtifactEnvelope) => void;
}

function parseJson<T>(contents: string): T {
  return JSON.parse(contents) as T;
}

/** Persists one immutable run: JSONL events plus never-overwritten artifact versions. */
export class RunStore {
  readonly runDirectory: string;
  private readonly artifactsDirectory: string;
  private readonly eventsPath: string;
  private readonly versions = new Map<ArtifactKind, number>();
  private nextSequence = 1;
  private eventQueue: Promise<void> = Promise.resolve();

  private constructor(
    readonly runId: string,
    rootDirectory: string,
    private readonly observer: RunStoreObserver = {},
  ) {
    this.runDirectory = resolve(rootDirectory, runId);
    this.artifactsDirectory = join(this.runDirectory, "artifacts");
    this.eventsPath = join(this.runDirectory, "events.jsonl");
  }

  static async create(
    rootDirectory: string,
    runId: string,
    observer: RunStoreObserver = {},
  ): Promise<RunStore> {
    if (!SAFE_RUN_ID.test(runId)) {
      throw new Error(`Unsafe run id '${runId}'.`);
    }

    const store = new RunStore(runId, rootDirectory, observer);
    await mkdir(store.artifactsDirectory, { recursive: true });
    return store;
  }

  async appendEvent(input: EventInput): Promise<StudioEvent> {
    const event: StudioEvent = {
      sequence: this.nextSequence,
      runId: this.runId,
      occurredAt: new Date().toISOString(),
      ...input,
    };
    this.nextSequence += 1;

    const pendingWrite = this.eventQueue.then(async () => {
      await appendFile(this.eventsPath, `${JSON.stringify(event)}\n`, "utf8");
    });
    this.eventQueue = pendingWrite.catch(() => undefined);
    await pendingWrite;
    this.observer.onEvent?.(structuredClone(event));
    return event;
  }

  async writeArtifact<K extends ArtifactKind>(
    input: WriteArtifactInput<K>,
  ): Promise<ArtifactEnvelope<K>> {
    if (
      input.kind !== "DraftGameRecipe"
    ) {
      assertArtifactData(
        input.kind as ValidatedArtifactKind,
        input.data,
      );
    }

    const version = (this.versions.get(input.kind) ?? 0) + 1;
    this.versions.set(input.kind, version);
    const artifact: ArtifactEnvelope<K> = {
      id: `${this.runId}:${input.kind}:v${version}`,
      runId: this.runId,
      kind: input.kind,
      version,
      createdAt: new Date().toISOString(),
      actor: input.actor,
      source: input.source,
      data: input.data,
    };

    const kindDirectory = join(this.artifactsDirectory, input.kind);
    await mkdir(kindDirectory, { recursive: true });
    await writeFile(
      join(kindDirectory, `v${version}.json`),
      `${JSON.stringify(artifact, null, 2)}\n`,
      { encoding: "utf8", flag: "wx" },
    );
    await this.appendEvent({
      actor: input.actor,
      type: "artifact_written",
      status: "passed",
      summary: `${input.kind} v${version} recorded (${input.source.mode}).`,
      artifact: { kind: input.kind, version },
    });
    this.observer.onArtifact?.(structuredClone(artifact) as AnyArtifactEnvelope);
    return artifact;
  }

  async publish(
    recipe: GameRecipeV0,
    qaArtifact: ArtifactEnvelope<"QAReport">,
  ): Promise<PublishedRelease> {
    if (!qaArtifact.data.passed) {
      throw new Error("Release blocked: QAReport has not passed.");
    }

    const release: PublishedRelease = {
      runId: this.runId,
      status: "published",
      publishedAt: new Date().toISOString(),
      recipe,
      qaReportVersion: qaArtifact.version,
    };
    await writeFile(
      join(this.runDirectory, "release.json"),
      `${JSON.stringify(release, null, 2)}\n`,
      { encoding: "utf8", flag: "wx" },
    );
    await this.appendEvent({
      actor: "Publisher",
      type: "release_published",
      status: "passed",
      summary: `Published release from QAReport v${qaArtifact.version}.`,
      artifact: { kind: "QAReport", version: qaArtifact.version },
    });
    return release;
  }

  async readEvents(): Promise<StudioEvent[]> {
    await this.eventQueue;
    try {
      const contents = await readFile(this.eventsPath, "utf8");
      return contents
        .split("\n")
        .filter(Boolean)
        .map((line) => parseJson<StudioEvent>(line));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }

  async readArtifacts(): Promise<AnyArtifactEnvelope[]> {
    const kinds = await readdir(this.artifactsDirectory, { withFileTypes: true });
    const artifacts = await Promise.all(
      kinds
        .filter((entry) => entry.isDirectory())
        .map(async ({ name }) => {
          const kindDirectory = join(this.artifactsDirectory, name);
          const names = await readdir(kindDirectory);
          return Promise.all(
            names
              .filter((filename) => filename.endsWith(".json"))
              .map(async (filename) => parseJson<AnyArtifactEnvelope>(
                await readFile(join(kindDirectory, filename), "utf8"),
              )),
          );
        }),
    );

    return artifacts
      .flat()
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }
}
