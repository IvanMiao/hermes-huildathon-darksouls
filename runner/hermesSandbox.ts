import { realpathSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

const SANDBOX_WORKING_DIRECTORY = "/tmp/soulloom-hermes";

export interface HermesSandboxLayout {
  homeDirectory: string;
  hermesCommand: string;
  hermesInstallDirectory: string;
  pythonRuntimeDirectory: string;
  credentialsFile: string;
  resolverFile: string;
}

export interface HermesSandboxInvocation {
  command: string;
  args: string[];
}

function assertInsideHome(path: string, homeDirectory: string): void {
  const pathFromHome = relative(homeDirectory, path);
  const resolvedPath = resolve(homeDirectory, pathFromHome);
  if (
    pathFromHome === ""
    || pathFromHome.startsWith("..")
    || resolvedPath !== path
  ) {
    throw new Error(`Hermes sandbox path must be inside ${homeDirectory}: ${path}`);
  }
}

function parentDirectories(path: string, homeDirectory: string): string[] {
  const directories: string[] = [];
  let current = dirname(path);
  while (current !== homeDirectory) {
    assertInsideHome(current, homeDirectory);
    directories.push(current);
    current = dirname(current);
  }
  return directories.reverse();
}

function addReadOnlyHomeMount(
  args: string[],
  source: string,
  destination: string,
  homeDirectory: string,
  createdDirectories: Set<string>,
): void {
  assertInsideHome(destination, homeDirectory);
  for (const directory of parentDirectories(destination, homeDirectory)) {
    if (!createdDirectories.has(directory)) {
      args.push("--dir", directory);
      createdDirectories.add(directory);
    }
  }
  args.push("--ro-bind", source, destination);
}

export function resolveHermesSandboxLayout(
  configuredCommand?: string,
): HermesSandboxLayout {
  const homeDirectory = homedir();
  const hermesHome = join(homeDirectory, ".hermes");
  const hermesInstallDirectory = join(hermesHome, "hermes-agent");
  if (configuredCommand && !isAbsolute(configuredCommand)) {
    throw new Error("HERMES_BIN must be an absolute path in isolated mode.");
  }
  const hermesCommand = configuredCommand
    ? configuredCommand
    : join(homeDirectory, ".local", "bin", "hermes");
  const pythonExecutable = realpathSync(
    join(hermesInstallDirectory, "venv", "bin", "python"),
  );

  return {
    homeDirectory,
    hermesCommand,
    hermesInstallDirectory,
    pythonRuntimeDirectory: dirname(dirname(pythonExecutable)),
    credentialsFile: join(hermesHome, ".env"),
    resolverFile: realpathSync("/etc/resolv.conf"),
  };
}

export function createHermesSandboxInvocation(
  layout: HermesSandboxLayout,
  hermesArgs: readonly string[],
  bubblewrapCommand = process.env.SOULLOOM_HERMES_SANDBOX_BIN ?? "/usr/bin/bwrap",
): HermesSandboxInvocation {
  const {
    homeDirectory,
    hermesCommand,
    hermesInstallDirectory,
    pythonRuntimeDirectory,
    credentialsFile,
    resolverFile,
  } = layout;
  const args = [
    "--die-with-parent",
    "--new-session",
    "--unshare-pid",
    "--unshare-ipc",
    "--unshare-uts",
    "--cap-drop",
    "ALL",
    "--ro-bind",
    "/usr",
    "/usr",
    "--symlink",
    "usr/bin",
    "/bin",
    "--symlink",
    "usr/lib",
    "/lib",
    "--symlink",
    "usr/lib64",
    "/lib64",
    "--symlink",
    "usr/sbin",
    "/sbin",
    "--ro-bind",
    "/etc",
    "/etc",
    "--proc",
    "/proc",
    "--dev",
    "/dev",
    "--dir",
    dirname(homeDirectory),
    "--tmpfs",
    homeDirectory,
  ];
  const createdDirectories = new Set<string>();

  if (!resolverFile.startsWith("/etc/")) {
    for (const directory of parentDirectories(resolverFile, "/")) {
      args.push("--dir", directory);
    }
    args.push("--ro-bind", resolverFile, resolverFile);
  }

  addReadOnlyHomeMount(
    args,
    hermesCommand,
    hermesCommand,
    homeDirectory,
    createdDirectories,
  );
  addReadOnlyHomeMount(
    args,
    pythonRuntimeDirectory,
    pythonRuntimeDirectory,
    homeDirectory,
    createdDirectories,
  );
  addReadOnlyHomeMount(
    args,
    hermesInstallDirectory,
    hermesInstallDirectory,
    homeDirectory,
    createdDirectories,
  );
  addReadOnlyHomeMount(
    args,
    credentialsFile,
    credentialsFile,
    homeDirectory,
    createdDirectories,
  );

  args.push(
    "--tmpfs",
    "/tmp",
    "--dir",
    SANDBOX_WORKING_DIRECTORY,
    "--chdir",
    SANDBOX_WORKING_DIRECTORY,
    "--clearenv",
    "--setenv",
    "HOME",
    homeDirectory,
    "--setenv",
    "PATH",
    `${dirname(hermesCommand)}:/usr/local/bin:/usr/bin:/bin`,
    "--setenv",
    "LANG",
    "C.UTF-8",
    "--setenv",
    "SSL_CERT_FILE",
    "/etc/ssl/certs/ca-certificates.crt",
    hermesCommand,
    ...hermesArgs,
  );

  return { command: bubblewrapCommand, args };
}
