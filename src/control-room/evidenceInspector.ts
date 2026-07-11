import type {
  ArtifactKind,
  ArtifactSource,
  QAOwner,
  StudioActor,
  StudioEvent,
} from "../../runner/contracts";

interface EvidenceQACheck {
  id: string;
  passed: boolean;
  artifact: string;
  owner: QAOwner;
  message: string;
}

export interface EvidenceArtifact {
  kind: ArtifactKind;
  version: number;
  actor: StudioActor;
  source: ArtifactSource;
  data: unknown;
}

export interface EvidenceInspectorModel {
  eyebrow: string;
  title: string;
  description: string;
  metrics: ReadonlyArray<readonly [string, string]>;
  qaChecks: EvidenceQACheck[];
  artifactData?: unknown;
  comparison?: {
    label: string;
    before: unknown;
    after: unknown;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function inferredCheckArtifact(id: string): string {
  if (id === "legal_recipe") return "DraftGameRecipe";
  if (id === "voice_trigger_reachable") return "VoiceArtifact";
  return "EncounterSpec";
}

function qaChecksFrom(data: unknown): EvidenceQACheck[] {
  if (!isRecord(data) || !Array.isArray(data.checks)) return [];
  return data.checks.flatMap((check) => {
    if (
      !isRecord(check)
      || typeof check.id !== "string"
      || typeof check.passed !== "boolean"
      || typeof check.owner !== "string"
      || typeof check.message !== "string"
    ) {
      return [];
    }
    return [{
      id: check.id,
      passed: check.passed,
      artifact: typeof check.artifact === "string"
        ? check.artifact
        : inferredCheckArtifact(check.id),
      owner: check.owner as QAOwner,
      message: check.message,
    }];
  });
}

function exactArtifact(
  event: StudioEvent,
  artifacts: readonly EvidenceArtifact[],
): EvidenceArtifact | undefined {
  if (!event.artifact) return undefined;
  return artifacts.find((artifact) => (
    artifact.kind === event.artifact?.kind
    && artifact.version === event.artifact.version
  ));
}

function latestQAArtifact(artifacts: readonly EvidenceArtifact[]): EvidenceArtifact | undefined {
  return artifacts
    .filter(({ kind }) => kind === "QAReport")
    .sort((left, right) => left.version - right.version)
    .at(-1);
}

function durationLabel(durationMs: number): string {
  return `${durationMs.toFixed(2)} ms`;
}

function ownerLabel(owner: QAOwner | undefined): string {
  return owner ?? "Not assigned";
}

export function deriveEvidenceInspectorModel(
  event: StudioEvent,
  artifacts: readonly EvidenceArtifact[],
): EvidenceInspectorModel {
  const artifact = exactArtifact(event, artifacts);
  if (event.qaStage) {
    const qaChecks = qaChecksFrom(latestQAArtifact(artifacts)?.data)
      .filter(({ id }) => event.qaStage?.checkIds.some((checkId) => checkId === id));
    const evidenceKinds = [...new Set(qaChecks.map(({ artifact: kind }) => kind))];
    const stageState = event.type === "qa_stage_started"
      ? "RUNNING"
      : event.qaStage.passed
        ? "PASS"
        : "FAIL";
    return {
      eyebrow: `QA STAGE · ${stageState}`,
      title: event.qaStage.label,
      description: event.summary,
      metrics: [
        ["Duration", event.qaStage.durationMs === undefined
          ? "In progress"
          : durationLabel(event.qaStage.durationMs)],
        ["Checks", event.qaStage.checkIds.join(", ")],
        ["Evidence", evidenceKinds.join(", ") || "Pending QAReport"],
      ],
      qaChecks,
    };
  }

  if (artifact) {
    const previous = artifacts.find((candidate) => (
      candidate.kind === artifact.kind && candidate.version === artifact.version - 1
    ));
    return {
      eyebrow: `${event.type.replaceAll("_", " ")} · ${event.status}`.toUpperCase(),
      title: `${artifact.kind} v${artifact.version}`,
      description: event.summary,
      metrics: [
        ["Owner", artifact.actor],
        ["Source", artifact.source.mode.replaceAll("_", " ")],
        ["Version", String(artifact.version)],
      ],
      qaChecks: qaChecksFrom(artifact.data),
      artifactData: artifact.data,
      ...(previous ? {
        comparison: {
          label: `${artifact.kind} v${previous.version} → v${artifact.version}`,
          before: previous.data,
          after: artifact.data,
        },
      } : {}),
    };
  }

  return {
    eyebrow: `${event.type.replaceAll("_", " ")} · ${event.status}`.toUpperCase(),
    title: event.actor,
    description: event.summary,
    metrics: [
      ["Sequence", String(event.sequence).padStart(2, "0")],
      ["Owner", ownerLabel(event.owner)],
      ["Recorded", new Date(event.occurredAt).toISOString().slice(11, 23)],
    ],
    qaChecks: [],
  };
}

function createMetrics(rows: EvidenceInspectorModel["metrics"]): HTMLElement {
  const list = document.createElement("dl");
  list.className = "inspector-metrics";
  for (const [label, value] of rows) {
    const term = document.createElement("dt");
    term.textContent = label;
    const description = document.createElement("dd");
    description.textContent = value;
    list.append(term, description);
  }
  return list;
}

function createQAChecks(checks: readonly EvidenceQACheck[]): HTMLElement | null {
  if (checks.length === 0) return null;
  const list = document.createElement("ul");
  list.className = "qa-checks inspector-checks";
  for (const check of checks) {
    const item = document.createElement("li");
    item.className = check.passed ? "is-passed" : "is-failed";
    item.textContent = `${check.passed ? "PASS" : "FAIL"} · ${check.message} Owner: ${check.owner}.`;
    list.append(item);
  }
  return list;
}

function conciseComparisonValue(data: unknown): string {
  if (!isRecord(data)) return JSON.stringify(data, null, 2);
  const phaseTwoOrder = data.phaseTwoOrder;
  if (Array.isArray(phaseTwoOrder)) return phaseTwoOrder.join(" → ");
  if (typeof data.passed === "boolean" && Array.isArray(data.checks)) {
    const failedIds = data.checks.flatMap((check) => (
      isRecord(check) && check.passed === false && typeof check.id === "string"
        ? [check.id]
        : []
    ));
    return data.passed
      ? `PASS · ${data.checks.length}/${data.checks.length} checks`
      : `FAIL · ${failedIds.join(", ") || "release gate"}`;
  }
  if (typeof data.summary === "string") return data.summary;
  if (isRecord(data.combat) && Array.isArray(data.combat.phaseTwoOrder)) {
    return data.combat.phaseTwoOrder.join(" → ");
  }
  return Object.keys(data).slice(0, 4).join(" · ");
}

export function createEvidenceInspector(
  model: EvidenceInspectorModel,
  options: { pinned?: boolean; onResumeLive?: () => void } = {},
): HTMLElement {
  const container = document.createElement("div");
  container.className = "evidence-inspector";
  const header = document.createElement("header");
  const copy = document.createElement("div");
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = model.eyebrow;
  const title = document.createElement("h3");
  title.textContent = model.title;
  copy.append(eyebrow, title);
  header.append(copy);
  if (options.pinned && options.onResumeLive) {
    const resume = document.createElement("button");
    resume.type = "button";
    resume.className = "inspector-resume";
    resume.textContent = "RESUME LIVE";
    resume.addEventListener("click", options.onResumeLive);
    header.append(resume);
  }
  const description = document.createElement("p");
  description.className = "inspector-description";
  description.textContent = model.description;
  container.append(header, description, createMetrics(model.metrics));

  if (model.comparison) {
    const comparison = document.createElement("div");
    comparison.className = "inspector-comparison";
    const label = document.createElement("small");
    label.textContent = model.comparison.label;
    const values = document.createElement("div");
    const before = document.createElement("del");
    before.textContent = conciseComparisonValue(model.comparison.before);
    const arrow = document.createElement("span");
    arrow.textContent = "→";
    const after = document.createElement("ins");
    after.textContent = conciseComparisonValue(model.comparison.after);
    values.append(before, arrow, after);
    comparison.append(label, values);
    container.append(comparison);
  }

  const checks = createQAChecks(model.qaChecks);
  if (checks) container.append(checks);
  if (model.artifactData !== undefined) {
    const details = document.createElement("details");
    details.className = "inspector-payload";
    const summary = document.createElement("summary");
    summary.textContent = "VIEW IMMUTABLE PAYLOAD";
    const payload = document.createElement("pre");
    payload.textContent = JSON.stringify(model.artifactData, null, 2);
    details.append(summary, payload);
    container.append(details);
  }
  return container;
}
