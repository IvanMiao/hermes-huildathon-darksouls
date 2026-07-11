export function createPageShell(active: "studio" | "control-room"): HTMLElement {
  const shell = document.createElement("div");
  shell.className = "studio-shell";

  const skipLink = document.createElement("a");
  skipLink.className = "skip-link";
  skipLink.href = "#studio-main";
  skipLink.textContent = "Skip to main content";

  const header = document.createElement("header");
  header.className = "studio-header";
  header.innerHTML = `
    <a class="studio-brand" href="/studio" aria-label="Soulloom Studio home">
      <span class="brand-mark" aria-hidden="true"></span>
      <span>SOULLOOM</span>
      <small>AUTONOMOUS GAME STUDIO</small>
    </a>
    <nav class="studio-nav" aria-label="Primary navigation">
      <a href="/studio" ${active === "studio" ? 'aria-current="page"' : ""}>Create</a>
      <a href="/control-room/fixture-encounter-repair" ${active === "control-room" ? 'aria-current="page"' : ""}>Control Room</a>
    </nav>
  `;

  const main = document.createElement("main");
  main.id = "studio-main";
  main.className = "studio-main";
  main.tabIndex = -1;

  shell.append(skipLink, header, main);
  return shell;
}

export function getShellMain(shell: HTMLElement): HTMLElement {
  const main = shell.querySelector<HTMLElement>("#studio-main");
  if (!main) {
    throw new Error("Studio shell is missing its main region.");
  }
  return main;
}
