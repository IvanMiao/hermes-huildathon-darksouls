import { STUDIO_RUN_FIXTURES } from "./fixtures";
import { createPageShell, getShellMain } from "./pageShell";
import { startStudioRun } from "./studioApi";

const ACCEPTED_TWEET_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function requireElement<T extends Element>(element: T | null, name: string): T {
  if (!element) throw new Error(`Create form is missing ${name}.`);
  return element;
}

function createFixtureCard(runId: string, label: string): HTMLElement {
  const article = document.createElement("article");
  article.className = "fixture-card";

  const heading = document.createElement("h3");
  heading.textContent = label;
  const description = document.createElement("p");
  description.className = "fixture-description";
  description.textContent = label === "Direct pass"
    ? "Inspect a recorded run that passed its release gate without repair."
    : "Inspect a recorded block, targeted Encounter repair, and regression pass.";
  const link = document.createElement("a");
  link.className = "text-link";
  link.href = `/control-room/${runId}`;
  link.textContent = "Inspect evidence";
  link.setAttribute("aria-label", `Inspect ${label} fixture evidence`);

  article.append(heading, description, link);
  return article;
}

export function mountStudioPage(root: HTMLElement): void {
  document.title = "Soulloom — Autonomous Game Studio";
  const shell = createPageShell("studio");
  const main = getShellMain(shell);

  const hero = document.createElement("section");
  hero.className = "studio-hero";
  hero.setAttribute("aria-labelledby", "create-title");
  hero.innerHTML = `
    <p class="eyebrow"><span class="live-dot" aria-hidden="true"></span> LOCAL STUDIO READY</p>
    <h1 id="create-title">One internet moment in.<br><em>One playable world out.</em></h1>
    <p class="hero-copy">Hermes coordinates creative direction, encounter design, and release QA. Agents produce constrained artifacts; only a passed run can become a game.</p>
  `;

  const form = document.createElement("form");
  form.className = "create-form";
  form.noValidate = true;
  form.innerHTML = `
    <fieldset class="source-mode-switch">
      <legend>Choose source type</legend>
      <label><input type="radio" name="source-mode" value="text" checked><span>Paste text</span></label>
      <label><input type="radio" name="source-mode" value="image"><span>Upload tweet image</span></label>
    </fieldset>
    <div class="source-panel" data-source-panel="text">
      <label for="source-text">Tweet text</label>
      <textarea id="source-text" name="source-text" rows="4" placeholder="Paste the tweet text here…" aria-describedby="source-help source-error"></textarea>
    </div>
    <div class="source-panel" data-source-panel="image" hidden>
      <label class="upload-drop" for="source-image">
        <svg aria-hidden="true" viewBox="0 0 24 24" width="28" height="28"><path d="M12 16V4m0 0L7 9m5-5 5 5M5 14v5h14v-5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <strong>Choose a tweet screenshot</strong>
        <span>PNG, JPEG, or WebP · up to 8 MB</span>
      </label>
      <input class="visually-hidden" id="source-image" name="source-image" type="file" accept="image/png,image/jpeg,image/webp" aria-describedby="source-help source-error">
      <figure class="image-preview" hidden>
        <img alt="Selected tweet screenshot preview">
        <figcaption></figcaption>
      </figure>
    </div>
    <div class="form-footer">
      <p id="source-help">Text starts a live Manager with parallel Hermes specialists. Screenshot mode replays local evidence until OCR is connected.</p>
      <button class="primary-button" type="submit">
        <span>MAKE IT PLAYABLE</span>
        <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20"><path d="m8 5 8 7-8 7V5Z" fill="currentColor"/></svg>
      </button>
    </div>
    <p class="form-error" id="source-error" role="alert"></p>
  `;

  const textInput = requireElement(form.querySelector<HTMLTextAreaElement>("#source-text"), "text input");
  const imageInput = requireElement(form.querySelector<HTMLInputElement>("#source-image"), "image input");
  const textPanel = requireElement(form.querySelector<HTMLElement>('[data-source-panel="text"]'), "text panel");
  const imagePanel = requireElement(form.querySelector<HTMLElement>('[data-source-panel="image"]'), "image panel");
  const imagePreview = requireElement(form.querySelector<HTMLElement>(".image-preview"), "image preview");
  const previewImage = requireElement(imagePreview.querySelector<HTMLImageElement>("img"), "preview image");
  const previewCaption = requireElement(imagePreview.querySelector<HTMLElement>("figcaption"), "preview caption");
  const error = requireElement(form.querySelector<HTMLElement>("#source-error"), "error message");
  const submitButton = requireElement(form.querySelector<HTMLButtonElement>('button[type="submit"]'), "submit button");
  const submitLabel = requireElement(submitButton.querySelector<HTMLElement>("span"), "submit label");
  let selectedImage: File | null = null;
  let previewUrl: string | null = null;

  function selectedMode(): "text" | "image" {
    const checked = form.querySelector<HTMLInputElement>('input[name="source-mode"]:checked');
    return checked?.value === "image" ? "image" : "text";
  }

  function clearError(): void {
    error.textContent = "";
    textInput.removeAttribute("aria-invalid");
    imageInput.removeAttribute("aria-invalid");
  }

  form.querySelectorAll<HTMLInputElement>('input[name="source-mode"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      const imageMode = selectedMode() === "image";
      textPanel.hidden = imageMode;
      imagePanel.hidden = !imageMode;
      clearError();
      if (imageMode) imageInput.focus();
      else textInput.focus();
    });
  });

  imageInput.addEventListener("change", () => {
    clearError();
    selectedImage = imageInput.files?.[0] ?? null;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
    if (!selectedImage) {
      imagePreview.hidden = true;
      return;
    }
    if (!ACCEPTED_TWEET_IMAGE_TYPES.has(selectedImage.type)) {
      error.textContent = "Choose a PNG, JPEG, or WebP tweet image.";
      imageInput.setAttribute("aria-invalid", "true");
      selectedImage = null;
      imageInput.value = "";
      imagePreview.hidden = true;
      return;
    }
    if (selectedImage.size > 8 * 1024 * 1024) {
      error.textContent = "Choose an image smaller than 8 MB.";
      imageInput.setAttribute("aria-invalid", "true");
      selectedImage = null;
      imageInput.value = "";
      imagePreview.hidden = true;
      return;
    }
    previewUrl = URL.createObjectURL(selectedImage);
    previewImage.src = previewUrl;
    previewCaption.textContent = `${selectedImage.name} · ${Math.max(1, Math.round(selectedImage.size / 1024))} KB`;
    imagePreview.hidden = false;
  });

  form.addEventListener("submit", async (submitEvent) => {
    submitEvent.preventDefault();
    clearError();
    const mode = selectedMode();
    const inputText = textInput.value.trim();
    if (mode === "text" && !inputText) {
      error.textContent = "Paste tweet text before starting production.";
      textInput.setAttribute("aria-invalid", "true");
      textInput.focus();
      return;
    }
    if (mode === "image" && !selectedImage) {
      error.textContent = "Choose a tweet image before starting production.";
      imageInput.setAttribute("aria-invalid", "true");
      imageInput.focus();
      return;
    }
    if (mode === "image") {
      const fixture = STUDIO_RUN_FIXTURES[0];
      if (!fixture) throw new Error("Missing local Studio fixture.");
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      window.location.assign(`/control-room/${fixture.runId}?replay=1&source=image`);
      return;
    }

    submitButton.disabled = true;
    submitLabel.textContent = "STARTING HERMES…";
    try {
      const result = await startStudioRun(inputText, {
        onStateChange: (state) => {
          submitLabel.textContent = state === "queued"
            ? "RUN QUEUED…"
            : "HERMES IS PRODUCING…";
        },
      });
      window.location.assign(result.gameUrl ?? result.controlRoomUrl);
    } catch (requestError) {
      error.textContent = requestError instanceof Error
        ? requestError.message
        : "The Hermes runner is unavailable.";
      submitButton.disabled = false;
      submitLabel.textContent = "MAKE IT PLAYABLE";
    }
  });
  hero.append(form);

  const proof = document.createElement("section");
  proof.className = "proof-section";
  proof.setAttribute("aria-labelledby", "proof-title");
  proof.innerHTML = `
    <div>
      <p class="eyebrow">AUDITABLE BY DESIGN</p>
      <h2 id="proof-title">Replay the proof, not a performance.</h2>
    </div>
    <p>These committed scenarios expose the exact artifact handoffs, release gate, targeted retry, and publication decision.</p>
  `;
  const fixtureGrid = document.createElement("div");
  fixtureGrid.className = "fixture-grid";
  for (const fixture of STUDIO_RUN_FIXTURES) {
    fixtureGrid.append(createFixtureCard(fixture.runId, fixture.label));
  }
  proof.append(fixtureGrid);

  main.append(hero, proof);
  root.replaceChildren(shell);
}
