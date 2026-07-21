import type {
  AnyArtifactEnvelope,
  StudioActor,
  StudioEvent,
} from "../../runner/contracts";
import {
  readStudioJob,
  streamStudioJob,
  type StudioJobResponse,
} from "../studio/studioApi";
import { createPageShell, getShellMain } from "../studio/pageShell";
import {
  createEvidenceInspector,
  deriveEvidenceInspectorModel,
} from "./evidenceInspector";

const POLL_INTERVAL_MS = 500;
const DENSE_EVENT_REVEAL_MS = 140;
const GRAPH_ACTORS: readonly StudioActor[] = [
  "Studio Manager",
  "Creative Director",
  "Encounter Designer",
  "Release QA",
  "Publisher",
  "Audio Producer",
];

type ActorState = "waiting" | "active" | "complete" | "blocked";

function requireElement<T extends Element>(
  element: T | null | undefined,
  name: string,
): T {
  if (!element) throw new Error(`Live Control Room is missing ${name}.`);
  return element;
}

function actorState(actor: StudioActor, events: readonly StudioEvent[]): ActorState {
  const latestEvent = events.filter((event) => event.actor === actor).at(-1);
  if (latestEvent?.status === "failed") return "blocked";
  if (latestEvent?.status === "passed") return "complete";
  if (latestEvent?.status === "started" || latestEvent?.status === "info") return "active";
  return "waiting";
}

function createGraph(events: readonly StudioEvent[]): HTMLElement {
  const graph = document.createElement("ol");
  graph.className = "run-graph live-run-graph";
  graph.setAttribute("aria-label", "Live production ownership graph");
  for (const actor of GRAPH_ACTORS) {
    const state = actorState(actor, events);
    const item = document.createElement("li");
    item.className = `graph-node is-${state}`;
    item.innerHTML = '<span class="node-state" aria-hidden="true"></span><strong></strong><small></small>';
    const name = item.querySelector("strong");
    const stateLabel = item.querySelector("small");
    if (name) name.textContent = actor;
    if (stateLabel) stateLabel.textContent = state;
    item.setAttribute("aria-label", `${actor}: ${state}`);
    graph.append(item);
  }
  return graph;
}

function createTimeline(
  events: readonly StudioEvent[],
  selectedSequence: number,
  onSelect: (sequence: number) => void,
): HTMLElement {
  if (events.length === 0) {
    const waiting = document.createElement("div");
    waiting.className = "live-waiting-state";
    waiting.innerHTML = '<span aria-hidden="true"></span><p><strong>Waiting for Studio Manager</strong><small>The first durable event will appear here.</small></p>';
    return waiting;
  }
  const list = document.createElement("ol");
  list.className = "artifact-timeline live-artifact-timeline";
  for (const studioEvent of events) {
    const item = document.createElement("li");
    item.className = `timeline-event is-${studioEvent.status}`;
    if (studioEvent.sequence === selectedSequence) item.setAttribute("aria-current", "step");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "timeline-event-button";
    button.setAttribute(
      "aria-label",
      `Inspect step ${studioEvent.sequence}: ${studioEvent.summary}`,
    );
    button.addEventListener("click", () => onSelect(studioEvent.sequence));
    const sequence = document.createElement("span");
    sequence.className = "event-sequence";
    sequence.textContent = String(studioEvent.sequence).padStart(2, "0");
    const copy = document.createElement("div");
    const header = document.createElement("p");
    const actor = document.createElement("strong");
    actor.textContent = studioEvent.actor;
    const time = document.createElement("time");
    time.dateTime = studioEvent.occurredAt;
    time.textContent = new Date(studioEvent.occurredAt).toISOString().slice(11, 19);
    header.append(actor, time);
    const summary = document.createElement("p");
    summary.textContent = studioEvent.summary;
    copy.append(header, summary);
    button.append(sequence, copy);
    item.append(button);
    list.append(item);
  }
  return list;
}

function artifactSummary(artifact: AnyArtifactEnvelope): string {
  const data = artifact.data as unknown;
  if (typeof data === "object" && data !== null && "summary" in data) {
    const summary = (data as { summary?: unknown }).summary;
    if (typeof summary === "string") return summary;
  }
  return `${artifact.kind} v${artifact.version} is durable and ready for inspection.`;
}

function createArtifacts(artifacts: readonly AnyArtifactEnvelope[]): HTMLElement {
  const container = document.createElement("div");
  container.className = "live-artifact-grid";
  if (artifacts.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Artifacts will appear as each specialist completes its handoff.";
    container.append(empty);
    return container;
  }
  for (const artifact of artifacts) {
    const card = document.createElement("details");
    card.className = "artifact-card live-artifact-card";
    const heading = document.createElement("summary");
    const title = document.createElement("span");
    const actor = document.createElement("small");
    actor.textContent = artifact.actor;
    const kind = document.createElement("strong");
    kind.textContent = `${artifact.kind} v${artifact.version}`;
    title.append(actor, kind);
    const badge = document.createElement("span");
    badge.className = "source-badge";
    badge.textContent = artifact.source.mode.replaceAll("_", " ");
    heading.append(title, badge);
    const summary = document.createElement("p");
    summary.textContent = artifactSummary(artifact);
    const data = document.createElement("pre");
    data.textContent = JSON.stringify(artifact.data, null, 2);
    card.append(heading, summary, data);
    container.append(card);
  }
  return container;
}

function completedStageCount(events: readonly StudioEvent[]): number {
  const completedActors = new Set(
    events
      .filter((event) => event.status === "passed")
      .map((event) => event.actor),
  );
  return GRAPH_ACTORS.filter((actor) => completedActors.has(actor)).length;
}

function elapsedSeconds(job: StudioJobResponse): number {
  const start = Date.parse(job.submittedAt);
  const end = job.state === "completed" || job.state === "failed"
    ? Date.parse(job.updatedAt)
    : Date.now();
  return Number.isFinite(start) && Number.isFinite(end)
    ? Math.max(0, Math.round((end - start) / 1_000))
    : 0;
}

export function mountLiveControlRoom(root: HTMLElement, runId: string): void {
  document.title = "Live production — Soulloom Control Room";
  const shell = createPageShell("control-room");
  const main = getShellMain(shell);
  main.classList.add("control-room-main", "live-control-room-main");
  main.innerHTML = `
    <header class="run-heading live-run-heading">
      <div>
        <p class="eyebrow"><span class="live-dot" aria-hidden="true"></span> CONTROL ROOM · LIVE HERMES PRODUCTION</p>
        <h1>Building your boss fight</h1>
        <p class="run-input"></p>
      </div>
      <a class="secondary-button" href="/">New production</a>
    </header>
    <section class="release-banner is-running live-release-banner" aria-live="polite" aria-atomic="true">
      <span class="status-icon" aria-hidden="true"></span>
      <div><strong>CONNECTING TO STUDIO</strong><p>Loading the durable production trace.</p></div>
      <a class="primary-button open-game" hidden>OPEN BOSS FIGHT</a>
    </section>
    <section class="live-progress-panel" aria-labelledby="live-progress-title">
      <div>
        <p class="eyebrow" id="live-progress-title">PRODUCTION PROGRESS</p>
        <p><strong data-progress-label>0 of 5 teams complete</strong><small data-connection-label>Connecting…</small></p>
      </div>
      <div class="live-progress-track" role="progressbar" aria-label="Production progress" aria-valuemin="0" aria-valuemax="5" aria-valuenow="0"><span></span></div>
    </section>
    <div class="control-grid live-control-grid">
      <div class="control-primary">
        <section class="panel graph-panel" aria-labelledby="live-graph-title"><div class="panel-heading"><p class="eyebrow">OWNERSHIP</p><h2 id="live-graph-title">Hermes studio floor</h2></div><div data-region="live-graph"></div></section>
        <section class="panel timeline-panel" aria-labelledby="live-timeline-title"><div class="panel-heading"><p class="eyebrow">APPEND-ONLY LOG</p><h2 id="live-timeline-title">Live artifact timeline</h2></div><div data-region="live-timeline" aria-live="polite"></div></section>
      </div>
      <aside class="control-secondary" aria-label="Live production evidence">
        <section class="panel metrics-panel" aria-labelledby="live-metrics-title"><div class="panel-heading"><p class="eyebrow">RUN TELEMETRY</p><h2 id="live-metrics-title">Production pulse</h2></div><dl data-region="live-metrics"></dl></section>
        <section class="panel inspector-panel" aria-labelledby="live-inspector-title"><div class="panel-heading"><p class="eyebrow">SELECTED STEP</p><h2 id="live-inspector-title">Evidence inspector</h2></div><div data-region="evidence-inspector"></div></section>
      </aside>
    </div>
    <section class="panel artifacts-panel" aria-labelledby="live-artifacts-title"><div class="panel-heading"><p class="eyebrow">DURABLE HANDOFFS</p><h2 id="live-artifacts-title">Artifacts as they land</h2></div><div data-region="live-artifacts"></div></section>
  `;
  root.replaceChildren(shell);

  const runInput = requireElement(main.querySelector<HTMLElement>(".run-input"), "run input");
  const banner = requireElement(main.querySelector<HTMLElement>(".release-banner"), "release banner");
  const bannerTitle = requireElement(banner.querySelector<HTMLElement>("strong"), "release title");
  const bannerDetail = requireElement(banner.querySelector<HTMLElement>("p"), "release detail");
  const openGame = requireElement(banner.querySelector<HTMLAnchorElement>(".open-game"), "game link");
  const progressLabel = requireElement(main.querySelector<HTMLElement>("[data-progress-label]"), "progress label");
  const connectionLabel = requireElement(main.querySelector<HTMLElement>("[data-connection-label]"), "connection label");
  const progressBar = requireElement(main.querySelector<HTMLElement>('[role="progressbar"]'), "progress bar");
  const progressFill = requireElement(progressBar.querySelector<HTMLElement>("span"), "progress fill");
  const graph = requireElement(main.querySelector<HTMLElement>('[data-region="live-graph"]'), "run graph");
  const timeline = requireElement(main.querySelector<HTMLElement>('[data-region="live-timeline"]'), "timeline");
  const metrics = requireElement(main.querySelector<HTMLElement>('[data-region="live-metrics"]'), "metrics");
  const inspector = requireElement(main.querySelector<HTMLElement>('[data-region="evidence-inspector"]'), "evidence inspector");
  const artifacts = requireElement(main.querySelector<HTMLElement>('[data-region="live-artifacts"]'), "artifacts");

  let stopped = false;
  let selectedSequence: number | null = null;
  let latestJob: StudioJobResponse | undefined;
  let presentedEventCount = 0;
  let revealTimer: number | undefined;
  let stopStream: (() => void) | undefined;

  function render(job: StudioJobResponse): void {
    runInput.textContent = `“${job.inputText}” · ${job.runId}`;
    const completedStages = completedStageCount(job.events);
    progressLabel.textContent = `${completedStages} of ${GRAPH_ACTORS.length} teams complete`;
    connectionLabel.textContent = job.state === "queued"
      ? "Waiting for an available Studio slot"
      : job.state === "running"
        ? `Live · updated ${new Date(job.updatedAt).toLocaleTimeString()}`
        : "Production trace complete";
    progressBar.setAttribute("aria-valuenow", String(completedStages));
    progressFill.style.transform = `scaleX(${completedStages / GRAPH_ACTORS.length})`;

    banner.className = "release-banner live-release-banner";
    openGame.hidden = true;
    openGame.removeAttribute("href");
    if (job.state === "failed") {
      banner.classList.add("is-release_blocked");
      bannerTitle.textContent = "PRODUCTION INTERRUPTED";
      bannerDetail.textContent = job.error ?? "The Studio stopped before release QA completed.";
    } else if (job.state === "completed" && job.result?.status === "published") {
      const evidenceReady = job.result.cloudflareEvidence === "mirrored"
        || job.result.convexEvidence === "mirrored";
      banner.classList.add(evidenceReady ? "is-published" : "is-release_blocked");
      bannerTitle.textContent = evidenceReady ? "BOSS FIGHT READY" : "EVIDENCE SYNC FAILED";
      bannerDetail.textContent = evidenceReady
        ? "QA passed and the durable release is ready. Open it when you are ready."
        : "The fight passed QA, but its durable Cloudflare evidence did not finish syncing.";
      if (evidenceReady && job.result.gameUrl) {
        openGame.href = job.result.gameUrl;
        openGame.hidden = false;
      }
    } else if (job.state === "completed") {
      banner.classList.add("is-release_blocked");
      bannerTitle.textContent = "RELEASE BLOCKED";
      bannerDetail.textContent = "Release QA did not approve this production. Inspect the final evidence below.";
    } else {
      banner.classList.add("is-running");
      bannerTitle.textContent = job.state === "queued" ? "PRODUCTION QUEUED" : "HERMES IS PRODUCING";
      bannerDetail.textContent = "Specialists are delivering constrained artifacts. The game remains locked until QA passes.";
    }

    graph.replaceChildren(createGraph(job.events));
    const selectedEvent = selectedSequence === null
      ? job.events.at(-1)
      : job.events.find((event) => event.sequence === selectedSequence) ?? job.events.at(-1);
    timeline.replaceChildren(createTimeline(
      job.events,
      selectedEvent?.sequence ?? 0,
      (nextSequence) => {
        selectedSequence = nextSequence;
        render(job);
      },
    ));
    artifacts.replaceChildren(createArtifacts(job.artifacts));

    const metricRows: ReadonlyArray<readonly [string, string]> = [
      ["State", job.state],
      ["Elapsed", `${elapsedSeconds(job)} s`],
      ["Events", String(job.events.length)],
      ["Artifacts", String(job.artifacts.length)],
    ];
    const metricElements = metricRows.flatMap(([label, value]) => {
      const term = document.createElement("dt");
      term.textContent = label;
      const description = document.createElement("dd");
      description.textContent = value;
      return [term, description];
    });
    metrics.replaceChildren(...metricElements);

    if (selectedEvent) {
      inspector.replaceChildren(createEvidenceInspector(
        deriveEvidenceInspectorModel(selectedEvent, job.artifacts),
        {
          pinned: selectedSequence !== null,
          onResumeLive: () => {
            selectedSequence = null;
            render(job);
          },
        },
      ));
    } else {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "Evidence will follow the latest durable timeline step.";
      inspector.replaceChildren(empty);
    }
  }

  function presentationSnapshot(job: StudioJobResponse): StudioJobResponse {
    const events = job.events.slice(0, presentedEventCount);
    const visibleArtifacts = new Set(events.flatMap((event) => event.artifact
      ? [`${event.artifact.kind}:v${event.artifact.version}`]
      : []));
    const caughtUp = presentedEventCount >= job.events.length;
    return {
      ...job,
      state: caughtUp ? job.state : "running",
      events,
      artifacts: job.artifacts.filter((artifact) => (
        visibleArtifacts.has(`${artifact.kind}:v${artifact.version}`)
      )),
      ...(!caughtUp ? { result: undefined, error: undefined } : {}),
    };
  }

  function scheduleReveal(): void {
    if (stopped || !latestJob || revealTimer !== undefined) return;
    if (presentedEventCount >= latestJob.events.length) {
      render(presentationSnapshot(latestJob));
      return;
    }
    revealTimer = window.setTimeout(() => {
      revealTimer = undefined;
      presentedEventCount += 1;
      if (latestJob) render(presentationSnapshot(latestJob));
      scheduleReveal();
    }, DENSE_EVENT_REVEAL_MS);
  }

  function acceptSnapshot(job: StudioJobResponse): void {
    latestJob = job;
    if (job.events.length === 0) render(job);
    scheduleReveal();
  }

  function showDisconnected(error: unknown): void {
    banner.className = "release-banner live-release-banner is-release_blocked";
    bannerTitle.textContent = "CONTROL ROOM DISCONNECTED";
    bannerDetail.textContent = error instanceof Error
      ? error.message
      : "The live production trace is unavailable.";
    connectionLabel.textContent = "Connection lost";
    const retry = document.createElement("button");
    retry.type = "button";
    retry.className = "secondary-button live-retry-button";
    retry.textContent = "RETRY CONNECTION";
    retry.addEventListener("click", () => {
      retry.remove();
      connectionLabel.textContent = "Reconnecting…";
      startConnection();
    });
    inspector.replaceChildren(retry);
  }

  async function poll(): Promise<void> {
    try {
      const job = await readStudioJob(`/api/studio/runs/${runId}`);
      if (stopped) return;
      acceptSnapshot(job);
      if (job.state === "queued" || job.state === "running") {
        window.setTimeout(() => void poll(), POLL_INTERVAL_MS);
      }
    } catch (error) {
      if (stopped) return;
      showDisconnected(error);
    }
  }

  function startConnection(): void {
    stopStream?.();
    try {
      stopStream = streamStudioJob(`/api/studio/runs/${runId}`, {
        onSnapshot: acceptSnapshot,
        onError: () => void poll(),
      });
    } catch {
      void poll();
    }
  }

  window.addEventListener("pagehide", () => {
    stopped = true;
    stopStream?.();
    if (revealTimer !== undefined) window.clearTimeout(revealTimer);
  }, { once: true });
  startConnection();
}
