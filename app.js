const searchInput = document.querySelector("#searchInput");
const suggestionsContainer = document.querySelector("#suggestions");
const statusMessage = document.querySelector("#statusMessage");
const resultCard = document.querySelector("#resultCard");
const suggestionTemplate = document.querySelector("#suggestionTemplate");
const installButton = document.querySelector("#installButton");
const imageModal = document.querySelector("#imageModal");
const closeModalButton = document.querySelector("#closeModalButton");
const zoomStage = document.querySelector("#zoomStage");
const zoomedImage = document.querySelector("#zoomedImage");
const zoomInButton = document.querySelector("#zoomInButton");
const zoomOutButton = document.querySelector("#zoomOutButton");
const zoomResetButton = document.querySelector("#zoomResetButton");

let items = [];
let deferredInstallPrompt = null;
let zoomState = {
  scale: 1,
  translateX: 0,
  translateY: 0,
  dragging: false,
  startX: 0,
  startY: 0,
};

function normalize(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildSearchIndex(item) {
  return [
    item.code,
    item.productName,
    item.finish,
    item.category,
    item.materialGroup,
    ...(item.styles || []),
  ]
    .map(normalize)
    .filter(Boolean)
    .join(" ");
}

function scoreMatch(item, query) {
  if (!query) {
    return 0;
  }

  const code = item.normalizedCode || normalize(item.code);
  const name = normalize(item.productName);
  const index = item.searchIndex;

  let score = 0;

  if (code === query) {
    score += 120;
  }

  if (code.startsWith(query)) {
    score += 80;
  }

  if (code.includes(query)) {
    score += 45;
  }

  if (name.includes(query)) {
    score += 18;
  }

  if (index.includes(query)) {
    score += 12;
  }

  score -= Math.max(0, code.length - query.length) * 0.4;

  return score;
}

function findMatches(rawQuery) {
  const query = normalize(rawQuery);
  if (!query) {
    return [];
  }

  return items
    .map((item) => ({ item, score: scoreMatch(item, query) }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 5)
    .map(({ item }) => item);
}

function setStatus(text) {
  statusMessage.textContent = text;
}

function clearSuggestions() {
  suggestionsContainer.innerHTML = "";
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function applyZoom() {
  zoomedImage.style.transform =
    `translate(calc(-50% + ${zoomState.translateX}px), calc(-50% + ${zoomState.translateY}px)) ` +
    `scale(${zoomState.scale})`;
}

function setZoom(nextScale) {
  zoomState.scale = clamp(nextScale, 1, 5);

  if (zoomState.scale === 1) {
    zoomState.translateX = 0;
    zoomState.translateY = 0;
  }

  applyZoom();
}

function openImageModal(imageUrl, title) {
  zoomedImage.src = imageUrl;
  zoomedImage.alt = title;
  document.querySelector("#imageModalTitle").textContent = title;
  zoomState = {
    scale: 1,
    translateX: 0,
    translateY: 0,
    dragging: false,
    startX: 0,
    startY: 0,
  };
  applyZoom();
  imageModal.classList.remove("hidden");
  imageModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeImageModal() {
  imageModal.classList.add("hidden");
  imageModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function renderSuggestions(matches) {
  clearSuggestions();

  matches.forEach((item) => {
    const button = suggestionTemplate.content.firstElementChild.cloneNode(true);
    button.innerHTML = `
      <span class="suggestion-code">${escapeHtml(item.code)}</span>
      <span class="suggestion-name">${escapeHtml(item.productName)}</span>
    `;
    button.addEventListener("click", () => {
      searchInput.value = item.code;
      renderResult(item);
      renderSuggestions(findMatches(item.code));
      setStatus(`1 match gevonden`);
    });
    suggestionsContainer.appendChild(button);
  });
}

function detailRow(label, value) {
  return `
    <div class="detail-row">
      <span class="detail-label">${escapeHtml(label)}</span>
      <span class="detail-value">${escapeHtml(value || "-")}</span>
    </div>
  `;
}

function renderResult(item) {
  if (!item) {
    resultCard.classList.add("hidden");
    resultCard.innerHTML = "";
    return;
  }

  resultCard.classList.remove("hidden");
  resultCard.innerHTML = `
    <div class="result-layout">
      <div>
        <button class="result-image-button" type="button" data-image-url="${escapeHtml(item.imageUrl)}">
          <img class="result-image" src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.productName)}" />
        </button>
        <p class="result-image-hint">Tik of klik op de afbeelding om te vergroten en verder in te zoomen.</p>
      </div>
      <div class="result-copy">
        <h2>${escapeHtml(item.productName)}</h2>
        <div class="result-code">${escapeHtml(item.code)}</div>
        <div class="detail-list">
          ${detailRow("Kleur / afwerking", item.finish)}
          ${detailRow("Diameter / doorsnede", item.diameter)}
          ${detailRow("Lengte", item.length)}
          ${detailRow("Categorie", item.category)}
        </div>
        <a class="open-link" href="${escapeHtml(item.productUrl)}" target="_blank" rel="noreferrer">
          Open productpagina
        </a>
      </div>
    </div>
  `;

  const imageButton = resultCard.querySelector(".result-image-button");
  imageButton?.addEventListener("click", () => openImageModal(item.imageUrl, item.productName));
}

function updateView() {
  const query = searchInput.value;
  const normalizedQuery = normalize(query);

  if (!normalizedQuery) {
    clearSuggestions();
    renderResult(null);
    setStatus("Typ een code om te zoeken");
    return;
  }

  const matches = findMatches(query);
  renderSuggestions(matches);

  if (matches.length === 0) {
    renderResult(null);
    setStatus("Geen spijl gevonden");
    return;
  }

  const bestMatch = matches[0];
  renderResult(bestMatch);
  setStatus(`${matches.length} suggest${matches.length === 1 ? "ie" : "ies"} gevonden`);
}

async function loadData() {
  try {
    const response = await fetch("spijlen.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Kon spijlen.json niet laden (${response.status})`);
    }

    const data = await response.json();
    items = (data.items || []).map((item) => ({
      ...item,
      normalizedCode: item.normalizedCode || normalize(item.code),
      searchIndex: buildSearchIndex(item),
    }));

    setStatus(`Klaar. ${items.length} spijlen geladen`);
  } catch (error) {
    console.error(error);
    setStatus("Data laden mislukt");
  }
}

function setupInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    installButton.classList.remove("hidden");
  });

  installButton.addEventListener("click", async () => {
    if (!deferredInstallPrompt) {
      return;
    }

    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    installButton.classList.add("hidden");
  });
}

function setupServiceWorker() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("service-worker.js").catch((error) => {
        console.error("Service worker registreren mislukt:", error);
      });
    });
  }
}

function setupImageZoom() {
  closeModalButton.addEventListener("click", closeImageModal);
  imageModal.addEventListener("click", (event) => {
    if (event.target instanceof HTMLElement && event.target.dataset.closeModal === "true") {
      closeImageModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !imageModal.classList.contains("hidden")) {
      closeImageModal();
    }
  });

  zoomInButton.addEventListener("click", () => setZoom(zoomState.scale + 0.4));
  zoomOutButton.addEventListener("click", () => setZoom(zoomState.scale - 0.4));
  zoomResetButton.addEventListener("click", () => setZoom(1));

  zoomStage.addEventListener("wheel", (event) => {
    event.preventDefault();
    setZoom(zoomState.scale + (event.deltaY < 0 ? 0.2 : -0.2));
  });

  zoomStage.addEventListener("pointerdown", (event) => {
    if (zoomState.scale <= 1) {
      return;
    }

    zoomState.dragging = true;
    zoomState.startX = event.clientX - zoomState.translateX;
    zoomState.startY = event.clientY - zoomState.translateY;
    zoomStage.setPointerCapture(event.pointerId);
  });

  zoomStage.addEventListener("pointermove", (event) => {
    if (!zoomState.dragging) {
      return;
    }

    zoomState.translateX = event.clientX - zoomState.startX;
    zoomState.translateY = event.clientY - zoomState.startY;
    applyZoom();
  });

  const stopDragging = () => {
    zoomState.dragging = false;
  };

  zoomStage.addEventListener("pointerup", stopDragging);
  zoomStage.addEventListener("pointercancel", stopDragging);
}

searchInput.addEventListener("input", updateView);
setupInstallPrompt();
setupServiceWorker();
setupImageZoom();
loadData();
