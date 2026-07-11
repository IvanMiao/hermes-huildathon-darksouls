import { describe, expect, it } from "vitest";
import {
  createHermesSandboxInvocation,
  type HermesSandboxLayout,
} from "./hermesSandbox";
import { createIsolatedHermesArguments } from "./hermesStudioAdapters";

const layout: HermesSandboxLayout = {
  homeDirectory: "/home/studio",
  hermesCommand: "/home/studio/.local/bin/hermes",
  hermesInstallDirectory: "/home/studio/.hermes/hermes-agent",
  pythonRuntimeDirectory: "/home/studio/.local/share/uv/python/cpython-3.11",
  credentialsFile: "/home/studio/.hermes/.env",
  resolverFile: "/run/systemd/resolve/stub-resolv.conf",
};

describe("Hermes process isolation", () => {
  it("mounts an empty home with only the Hermes runtime and credentials visible", () => {
    const invocation = createHermesSandboxInvocation(
      layout,
      ["--version"],
      "/usr/bin/bwrap",
    );
    const joinedArgs = invocation.args.join(" ");

    expect(invocation.command).toBe("/usr/bin/bwrap");
    expect(joinedArgs).toContain("--tmpfs /home/studio");
    expect(joinedArgs).toContain(
      "--ro-bind /home/studio/.hermes/hermes-agent /home/studio/.hermes/hermes-agent",
    );
    expect(joinedArgs).toContain(
      "--ro-bind /home/studio/.hermes/.env /home/studio/.hermes/.env",
    );
    expect(joinedArgs).toContain("--tmpfs /tmp");
    expect(joinedArgs).toContain("--clearenv");
    expect(joinedArgs).toContain("--cap-drop ALL");
    expect(joinedArgs).toContain(
      "--ro-bind /run/systemd/resolve/stub-resolv.conf /run/systemd/resolve/stub-resolv.conf",
    );
    expect(joinedArgs).not.toContain("--ro-bind / /");
    expect(joinedArgs).not.toContain("Documents");
  });

  it("selects no file, terminal, code execution, plugin, or MCP tools", () => {
    const args = createIsolatedHermesArguments(
      "untrusted input",
      "openai-api",
      "gpt-5.6-terra",
    );

    expect(args).toContain("hermes-webhook");
    expect(args).toContain("--safe-mode");
    expect(args).not.toContain("file");
    expect(args).not.toContain("terminal");
    expect(args).not.toContain("--yolo");
  });

  it("rejects runtime mounts outside the hidden home", () => {
    expect(() => createHermesSandboxInvocation(
      { ...layout, credentialsFile: "/tmp/hermes.env" },
      ["--version"],
    )).toThrow("Hermes sandbox path must be inside");
  });
});
