import { createHermesStudioAdapters } from "./hermesStudioAdapters";
import { createLocalStudioAdapters } from "./specialists";
import { HermesStudioManager } from "./studioManager";

export type StudioAgentMode = "hermes" | "local";

export interface StudioRuntime {
  agentMode: StudioAgentMode;
  manager: HermesStudioManager;
}

function configuredHermesTimeoutMs(): number {
  const configured = Number.parseInt(
    process.env.SOULLOOM_HERMES_TIMEOUT_MS ?? "30000",
    10,
  );
  return Number.isFinite(configured) && configured > 0 ? configured : 30_000;
}

export function createStudioRuntime(): StudioRuntime {
  const agentMode: StudioAgentMode = process.env.SOULLOOM_AGENT_MODE === "local"
    ? "local"
    : "hermes";
  if (agentMode === "local") {
    return {
      agentMode,
      manager: new HermesStudioManager({
        adapters: createLocalStudioAdapters(),
        timeoutMs: 8_000,
      }),
    };
  }

  const hermesTimeoutMs = configuredHermesTimeoutMs();
  return {
    agentMode,
    manager: new HermesStudioManager({
      adapters: createHermesStudioAdapters({ timeoutMs: hermesTimeoutMs }),
      timeoutMs: hermesTimeoutMs + 5_000,
    }),
  };
}
