import { createPageShell, getShellMain } from "../studio/pageShell";

export function mountReleaseGate(root: HTMLElement, runId: string): void {
  document.title = "Release blocked — Soulloom";
  const shell = createPageShell("control-room");
  const main = getShellMain(shell);
  main.className = "studio-main gate-main";
  main.innerHTML = `
    <section class="gate-card" role="alert" aria-labelledby="gate-title">
      <p class="eyebrow">PUBLICATION GATE</p>
      <span class="gate-lock" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="32" height="32"><path d="M7 10V7a5 5 0 0 1 10 0v3m-11 0h12v10H6V10Zm3 0h6V7a3 3 0 0 0-6 0v3Z" fill="currentColor"/></svg>
      </span>
      <h1 id="gate-title">RELEASE BLOCKED</h1>
      <p>The run <code></code> has no published release in the local evidence registry. A game route cannot open until QA passes and Publisher records <code>release_published</code>.</p>
      <div class="gate-actions"><a class="primary-button" href="/">START A PRODUCTION</a><a class="secondary-button" href="/control-room/fixture-encounter-repair">VIEW REPAIR PROOF</a></div>
    </section>
  `;
  const code = main.querySelector("code");
  if (code) code.textContent = runId;
  root.replaceChildren(shell);
}
