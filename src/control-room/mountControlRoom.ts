import type { StudioActor, StudioEvent } from "../../runner/contracts";
import { deriveReplayState, type ReplayReleaseState } from "./replayState";
import type { StudioRunFixture } from "../studio/fixtures";
import { createPageShell, getShellMain } from "../studio/pageShell";

const STATUS_COPY: Record<ReplayReleaseState, { label: string; detail: string }> = {
  running: {
    label: "PRODUCTION RUNNING",
    detail: "Artifacts are still being assembled. Publication remains locked.",
  },
  release_blocked: {
    label: "RELEASE BLOCKED",
    detail: "Release QA found an owning artifact that must be repaired.",
  },
  repairing: {
    label: "TARGETED REPAIR",
    detail: "Only the failed ownership area is being rerun before regression QA.",
  },
  published: {
    label: "SHIPPED",
    detail: "Regression QA passed. This run is now eligible for its game route.",
  },
};

const GRAPH_ACTORS: readonly StudioActor[] = [
  "Studio Manager",
  "Creative Director",
  "Encounter Designer",
  "Release QA",
  "Publisher",
];

function actorState(actor: StudioActor, events: readonly StudioEvent[]): string {
  const actorEvents = events.filter((event) => event.actor === actor);
  const latestEvent = actorEvents.at(-1);
  if (latestEvent?.status === "failed") {
    return "blocked";
  }
  if (latestEvent?.status === "passed") {
    return "complete";
  }
  if (latestEvent?.status === "started" || latestEvent?.status === "info") {
    return "active";
  }
  return "waiting";
}

function createGraph(events: readonly StudioEvent[]): HTMLElement {
  const graph = document.createElement("ol");
  graph.className = "run-graph";
  graph.setAttribute("aria-label", "Run ownership graph");
  for (const actor of GRAPH_ACTORS) {
    const state = actorState(actor, events);
    const item = document.createElement("li");
    item.className = `graph-node is-${state}`;
    item.innerHTML = `<span class="node-state" aria-hidden="true"></span><strong></strong><small>${state}</small>`;
    const label = item.querySelector("strong");
    if (label) {
      label.textContent = actor;
    }
    item.setAttribute("aria-label", `${actor}: ${state}`);
    graph.append(item);
  }
  return graph;
}

function createTimeline(events: readonly StudioEvent[]): HTMLElement {
  const list = document.createElement("ol");
  list.className = "artifact-timeline";
  for (const [index, studioEvent] of events.entries()) {
    const item = document.createElement("li");
    item.className = `timeline-event is-${studioEvent.status}`;
    if (index === events.length - 1) {
      item.setAttribute("aria-current", "step");
    }
    const sequence = document.createElement("span");
    sequence.className = "event-sequence";
    sequence.textContent = String(studioEvent.sequence).padStart(2, "0");
    const copy = document.createElement("div");
    const header = document.createElement("p");
    header.innerHTML = "<strong></strong><time></time>";
    const actor = header.querySelector("strong");
    const time = header.querySelector("time");
    if (actor) actor.textContent = studioEvent.actor;
    if (time) {
      time.dateTime = studioEvent.occurredAt;
      time.textContent = new Date(studioEvent.occurredAt).toISOString().slice(11, 23);
    }
    const summary = document.createElement("p");
    summary.textContent = studioEvent.summary;
    copy.append(header, summary);
    item.append(sequence, copy);
    list.append(item);
  }
  return list;
}

function createEmptyState(message: string): HTMLElement {
  const empty = document.createElement("p");
  empty.className = "empty-state";
  empty.textContent = message;
  return empty;
}

export function mountControlRoom(root: HTMLElement, fixture: StudioRunFixture): void {
  document.title = `${fixture.label} — Soulloom Control Room`;
  const query = new URLSearchParams(window.location.search);
  const shell = createPageShell("control-room");
  const main = getShellMain(shell);
  main.classList.add("control-room-main");
  main.innerHTML = `
    <header class="run-heading">
      <div>
        <p class="eyebrow">CONTROL ROOM · DETERMINISTIC FIXTURE</p>
        <h1>${fixture.label}</h1>
        <p class="run-input"></p>
      </div>
      <a class="secondary-button" href="/studio">New production</a>
    </header>
    <section class="release-banner" aria-live="polite">
      <span class="status-icon" aria-hidden="true"></span>
      <div><strong></strong><p></p></div>
      <a class="primary-button open-game" href="/games/${fixture.runId}">OPEN BOSS FIGHT</a>
    </section>
    <section class="replay-toolbar" aria-labelledby="replay-title">
      <div><p class="eyebrow" id="replay-title">EVIDENCE REPLAY</p><p>Step <output></output> of ${fixture.events.length}</p></div>
      <input type="range" min="1" max="${fixture.events.length}" step="1" aria-label="Replay event sequence">
      <div class="replay-actions">
        <button type="button" data-action="previous" aria-label="Previous event">PREV</button>
        <button type="button" data-action="play">PLAY</button>
        <button type="button" data-action="next" aria-label="Next event">NEXT</button>
      </div>
    </section>
    <div class="control-grid">
      <div class="control-primary">
        <section class="panel graph-panel" aria-labelledby="graph-title"><div class="panel-heading"><p class="eyebrow">OWNERSHIP</p><h2 id="graph-title">Run graph</h2></div><div data-region="graph"></div></section>
        <section class="panel timeline-panel" aria-labelledby="timeline-title"><div class="panel-heading"><p class="eyebrow">APPEND-ONLY LOG</p><h2 id="timeline-title">Artifact timeline</h2></div><div data-region="timeline"></div></section>
      </div>
      <aside class="control-secondary" aria-label="Run evidence">
        <section class="panel metrics-panel" aria-labelledby="metrics-title"><div class="panel-heading"><p class="eyebrow">PROOF DATA</p><h2 id="metrics-title">Run evidence</h2></div><dl data-region="metrics"></dl></section>
        <section class="panel repair-panel" aria-labelledby="repair-title"><div class="panel-heading"><p class="eyebrow">OWNED CHANGE</p><h2 id="repair-title">Before / after</h2></div><div data-region="repair"></div></section>
        <section class="panel qa-panel" aria-labelledby="qa-title"><div class="panel-heading"><p class="eyebrow">RELEASE GATE</p><h2 id="qa-title">QA report</h2></div><div data-region="qa"></div></section>
      </aside>
    </div>
    <section class="panel artifacts-panel" aria-labelledby="artifacts-title"><div class="panel-heading"><p class="eyebrow">IMMUTABLE VERSIONS</p><h2 id="artifacts-title">Artifacts</h2></div><div class="artifact-grid" data-region="artifacts"></div></section>
  `;

  const runInput = main.querySelector<HTMLElement>(".run-input");
  const sourceMode = query.get("source");
  if (runInput) {
    runInput.textContent = sourceMode === "image"
      ? `Tweet image uploaded · ${fixture.runId}`
      : sourceMode === "text"
        ? `Tweet text pasted · ${fixture.runId}`
        : `Recorded fixture · ${fixture.runId}`;
  }

  const range = main.querySelector<HTMLInputElement>('input[type="range"]');
  const output = main.querySelector<HTMLOutputElement>("output");
  const banner = main.querySelector<HTMLElement>(".release-banner");
  const playButton = main.querySelector<HTMLButtonElement>('[data-action="play"]');
  const regions = {
    graph: main.querySelector<HTMLElement>('[data-region="graph"]'),
    timeline: main.querySelector<HTMLElement>('[data-region="timeline"]'),
    metrics: main.querySelector<HTMLElement>('[data-region="metrics"]'),
    repair: main.querySelector<HTMLElement>('[data-region="repair"]'),
    qa: main.querySelector<HTMLElement>('[data-region="qa"]'),
    artifacts: main.querySelector<HTMLElement>('[data-region="artifacts"]'),
  };
  if (!range || !output || !banner || !playButton || Object.values(regions).some((region) => !region)) {
    throw new Error("Control Room did not mount all required regions.");
  }
  const replayRange = range;
  const replayOutput = output;
  const releaseBanner = banner;
  const replayButton = playButton;
  const mountedRegions = regions as Record<keyof typeof regions, HTMLElement>;

  let sequence = query.get("replay") === "1" ? 1 : fixture.events.length;
  let replayTimer: number | undefined;

  function render(): void {
    const state = deriveReplayState(fixture, sequence);
    sequence = state.sequence;
    replayRange.value = String(sequence);
    replayOutput.value = String(sequence);
    replayOutput.textContent = String(sequence);

    const statusCopy = STATUS_COPY[state.releaseState];
    releaseBanner.className = `release-banner is-${state.releaseState}`;
    const status = releaseBanner.querySelector("strong");
    const detail = releaseBanner.querySelector("p");
    const openGame = releaseBanner.querySelector<HTMLAnchorElement>(".open-game");
    if (status) status.textContent = statusCopy.label;
    if (detail) detail.textContent = statusCopy.detail;
    if (openGame) {
      openGame.hidden = state.releaseState !== "published";
      openGame.setAttribute("aria-disabled", String(state.releaseState !== "published"));
    }

    mountedRegions.graph.replaceChildren(createGraph(state.visibleEvents));
    mountedRegions.timeline.replaceChildren(createTimeline(state.visibleEvents));

    const metrics = document.createElement("dl");
    const metricRows: ReadonlyArray<readonly [string, string]> = [
      ["Wall time", `${state.wallTimeMs} ms`],
      ["Cost", "Not reported by P3"],
      ["Fallback", state.fallbackStatus],
      ["Artifacts", String(state.visibleArtifacts.length)],
    ];
    for (const [label, value] of metricRows) {
      const term = document.createElement("dt");
      term.textContent = label;
      const description = document.createElement("dd");
      description.textContent = value;
      metrics.append(term, description);
    }
    mountedRegions.metrics.replaceChildren(...metrics.children);

    const repaired = state.visibleArtifacts.some((artifact) => artifact.kind === "EncounterSpec" && artifact.version === 2);
    const blocked = state.visibleArtifacts.some((artifact) => artifact.kind === "QAReport" && artifact.version === 1 && fixture.qaReports[0]?.passed === false);
    if (repaired) {
      const diff = document.createElement("div");
      diff.className = "repair-diff";
      diff.innerHTML = `<div><small>BEFORE · EncounterSpec v1</small><strong><del>charge → sweep</del></strong></div><span aria-hidden="true">→</span><div><small>AFTER · EncounterSpec v2</small><strong><ins>charge → charge</ins></strong></div><p>phaseTwoOrder · Encounter Designer only</p>`;
      mountedRegions.repair.replaceChildren(diff);
    } else {
      mountedRegions.repair.replaceChildren(createEmptyState(blocked ? "Repair has been routed to Encounter Designer." : "No artifact repair has been recorded yet."));
    }

    if (state.qaVersion === null) {
      mountedRegions.qa.replaceChildren(createEmptyState("QA has not produced a report yet."));
    } else {
      const qa = document.createElement("div");
      const qaHeader = document.createElement("p");
      const qaPassed = state.qaChecks.every((check) => check.passed);
      qaHeader.className = `qa-summary is-${qaPassed ? "passed" : "failed"}`;
      qaHeader.textContent = `QAReport v${state.qaVersion} · ${qaPassed ? "PASS" : "FAIL"}`;
      const checks = document.createElement("ul");
      checks.className = "qa-checks";
      for (const check of state.qaChecks) {
        const item = document.createElement("li");
        item.className = check.passed ? "is-passed" : "is-failed";
        item.textContent = `${check.passed ? "PASS" : "FAIL"} · ${check.message} Owner: ${check.owner}.`;
        checks.append(item);
      }
      qa.append(qaHeader, checks);
      mountedRegions.qa.replaceChildren(qa);
    }

    if (state.visibleArtifacts.length === 0) {
      mountedRegions.artifacts.replaceChildren(createEmptyState("No artifact version has been written yet."));
    } else {
      const cards = state.visibleArtifacts.map((artifact) => {
        const details = document.createElement("details");
        details.className = "artifact-card";
        const summary = document.createElement("summary");
        summary.innerHTML = `<span><small></small><strong></strong></span><span class="source-badge"></span>`;
        const small = summary.querySelector("small");
        const strong = summary.querySelector("strong");
        const badge = summary.querySelector<HTMLElement>(".source-badge");
        if (small) small.textContent = artifact.actor;
        if (strong) strong.textContent = `${artifact.kind} v${artifact.version}`;
        if (badge) badge.textContent = artifact.source.mode.replaceAll("_", " ");
        const artifactSummary = document.createElement("p");
        artifactSummary.textContent = artifact.summary;
        const pre = document.createElement("pre");
        pre.textContent = JSON.stringify(artifact.data, null, 2);
        details.append(summary, artifactSummary, pre);
        return details;
      });
      mountedRegions.artifacts.replaceChildren(...cards);
    }
  }

  function stopReplay(): void {
    if (replayTimer !== undefined) {
      window.clearInterval(replayTimer);
      replayTimer = undefined;
    }
    replayButton.textContent = "PLAY";
  }

  function startReplay(): void {
    if (sequence >= fixture.events.length) sequence = 1;
    replayButton.textContent = "PAUSE";
    replayTimer = window.setInterval(() => {
      if (sequence >= fixture.events.length) {
        stopReplay();
        return;
      }
      sequence += 1;
      render();
    }, 420);
  }

  replayRange.addEventListener("input", () => {
    stopReplay();
    sequence = Number(replayRange.value);
    render();
  });
  main.querySelector('[data-action="previous"]')?.addEventListener("click", () => {
    stopReplay();
    sequence -= 1;
    render();
  });
  main.querySelector('[data-action="next"]')?.addEventListener("click", () => {
    stopReplay();
    sequence += 1;
    render();
  });
  replayButton.addEventListener("click", () => {
    if (replayTimer === undefined) startReplay();
    else stopReplay();
  });

  render();
  root.replaceChildren(shell);
  if (query.get("replay") === "1" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    startReplay();
  }
}
