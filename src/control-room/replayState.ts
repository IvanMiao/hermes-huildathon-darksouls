import type { StudioEvent } from "../../runner/contracts";
import type {
  QAProofCheck,
  StudioArtifactFixture,
  StudioRunFixture,
} from "../studio/fixtures";

export type ReplayReleaseState = "running" | "release_blocked" | "repairing" | "published";

export interface ControlRoomReplayState {
  sequence: number;
  releaseState: ReplayReleaseState;
  visibleEvents: readonly StudioEvent[];
  visibleArtifacts: readonly StudioArtifactFixture[];
  qaVersion: number | null;
  qaChecks: readonly QAProofCheck[];
  wallTimeMs: number;
  fallbackStatus: string;
}

function hasEvent(events: readonly StudioEvent[], type: StudioEvent["type"]): boolean {
  return events.some((event) => event.type === type);
}

function deriveReleaseState(events: readonly StudioEvent[]): ReplayReleaseState {
  if (hasEvent(events, "release_published")) {
    return "published";
  }
  if (hasEvent(events, "retry_routed")) {
    return "repairing";
  }
  if (hasEvent(events, "qa_blocked") || hasEvent(events, "release_blocked")) {
    return "release_blocked";
  }
  return "running";
}

export function deriveReplayState(
  fixture: StudioRunFixture,
  requestedSequence: number,
): ControlRoomReplayState {
  const sequence = Math.min(
    Math.max(Math.trunc(requestedSequence), 1),
    fixture.events.length,
  );
  const visibleEvents = fixture.events.filter((event) => event.sequence <= sequence);
  const writtenArtifacts = new Set(
    visibleEvents.flatMap((event) => event.artifact
      ? [`${event.artifact.kind}:v${event.artifact.version}`]
      : []),
  );
  const visibleArtifacts = fixture.artifacts.filter((artifact) => (
    writtenArtifacts.has(`${artifact.kind}:v${artifact.version}`)
  ));
  const qaReport = fixture.qaReports
    .filter((report) => report.eventSequence <= sequence)
    .at(-1);
  const startedAt = Date.parse(fixture.events[0]?.occurredAt ?? "");
  const currentAt = Date.parse(visibleEvents.at(-1)?.occurredAt ?? "");
  const fallback = visibleArtifacts.find((artifact) => (
    artifact.source.mode === "cached_fallback"
    || artifact.source.mode === "default_fallback"
  ));

  return {
    sequence,
    releaseState: deriveReleaseState(visibleEvents),
    visibleEvents,
    visibleArtifacts,
    qaVersion: qaReport?.version ?? null,
    qaChecks: qaReport?.checks ?? [],
    wallTimeMs: Number.isFinite(startedAt) && Number.isFinite(currentAt)
      ? Math.max(0, currentAt - startedAt)
      : 0,
    fallbackStatus: fallback
      ? `${fallback.kind} v${fallback.version}: ${fallback.source.mode}`
      : "None used",
  };
}
