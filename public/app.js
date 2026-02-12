const songSheetEl = document.getElementById("songSheet");
const instructionEl = document.getElementById("instruction");
const applyBtn = document.getElementById("applyBtn");
const undoBtn = document.getElementById("undoBtn");
const clearBtn = document.getElementById("clearBtn");
const statusEl = document.getElementById("status");
const apiKeyEl = document.getElementById("apiKey");
const toggleKeyBtn = document.getElementById("toggleKey");
const historyPanel = document.getElementById("historyPanel");
const historyList = document.getElementById("historyList");
const clearHistoryBtn = document.getElementById("clearHistory");
const previewContainer = document.getElementById("previewContainer");
const previewContent = document.getElementById("previewContent");
const copyBtn = document.getElementById("copyBtn");

// State
let undoStack = [];
let history = [];

// Persist API key in localStorage
const savedKey = localStorage.getItem("onsong_api_key");
if (savedKey) apiKeyEl.value = savedKey;

apiKeyEl.addEventListener("input", () => {
  localStorage.setItem("onsong_api_key", apiKeyEl.value.trim());
});

// Toggle key visibility
toggleKeyBtn.addEventListener("click", () => {
  apiKeyEl.type = apiKeyEl.type === "password" ? "text" : "password";
});

// Status helpers
function showStatus(msg, type) {
  statusEl.textContent = msg;
  statusEl.className = "status " + type;
}

function hideStatus() {
  statusEl.className = "status hidden";
}

// Undo
function pushUndo(text) {
  undoStack.push(text);
  if (undoStack.length > 50) undoStack.shift();
  undoBtn.disabled = false;
}

undoBtn.addEventListener("click", () => {
  if (undoStack.length === 0) return;
  songSheetEl.value = undoStack.pop();
  if (undoStack.length === 0) undoBtn.disabled = true;
  renderPreview(songSheetEl.value);
});

// Clear
clearBtn.addEventListener("click", () => {
  if (songSheetEl.value.trim()) {
    pushUndo(songSheetEl.value);
  }
  songSheetEl.value = "";
  previewContainer.classList.add("hidden");
  songSheetEl.focus();
});

// Copy preview content
copyBtn.addEventListener("click", () => {
  const text = songSheetEl.value;
  navigator.clipboard.writeText(text).then(() => {
    copyBtn.textContent = "Kopiert!";
    setTimeout(() => { copyBtn.textContent = "Kopieren"; }, 1500);
  });
});

// History
function addHistory(instruction) {
  const now = new Date();
  const time = now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  history.unshift({ instruction, time });
  if (history.length > 20) history.pop();
  renderHistory();
}

function renderHistory() {
  if (history.length === 0) {
    historyPanel.classList.add("hidden");
    return;
  }
  historyPanel.classList.remove("hidden");
  historyList.innerHTML = "";
  history.forEach((item) => {
    const li = document.createElement("li");
    li.innerHTML = `<span class="history-instruction">${escapeHtml(item.instruction)}</span><span class="history-time">${item.time}</span>`;
    historyList.appendChild(li);
  });
}

clearHistoryBtn.addEventListener("click", () => {
  history = [];
  renderHistory();
});

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ── Song Sheet Renderer ──────────────────────────────────────────────

function renderPreview(text) {
  if (!text.trim()) {
    previewContainer.classList.add("hidden");
    return;
  }

  previewContainer.classList.remove("hidden");
  previewContent.innerHTML = "";

  const lines = text.split("\n");
  let titleFound = false;
  let metaLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines – add spacer
    if (trimmed === "") {
      const spacer = document.createElement("div");
      spacer.className = "preview-spacer";
      previewContent.appendChild(spacer);
      continue;
    }

    // Title: first non-empty, non-tag line
    if (!titleFound && !trimmed.startsWith("{") && !trimmed.startsWith("|")) {
      titleFound = true;
      const titleEl = document.createElement("div");
      titleEl.className = "preview-title";
      titleEl.textContent = trimmed.replace(/\[.*?\]/g, "");
      previewContent.appendChild(titleEl);
      continue;
    }

    // Metadata tags: {key: value} that aren't section markers
    const metaMatch = trimmed.match(/^\{(\w+):\s*(.*?)\}$/);
    if (metaMatch) {
      const tag = metaMatch[1].toLowerCase();

      // Section headers: c, comment
      if (tag === "c" || tag === "comment") {
        const sectionEl = document.createElement("div");
        sectionEl.className = "preview-section";
        sectionEl.textContent = metaMatch[2];
        previewContent.appendChild(sectionEl);
        continue;
      }

      // Other metadata (key, tempo, time, etc.)
      const metaEl = document.createElement("div");
      metaEl.className = "preview-meta";
      metaEl.textContent = metaMatch[1] + ": " + metaMatch[2];
      previewContent.appendChild(metaEl);
      continue;
    }

    // Chord/lyric lines
    renderChordLyricLine(trimmed, previewContent);
  }
}

function renderChordLyricLine(line, container) {
  // Handle |. prefix (repeat/bar marker)
  let prefix = "";
  let content = line;
  if (content.startsWith("|.")) {
    prefix = "|. ";
    content = content.substring(2).trimStart();
  } else if (content.startsWith("|")) {
    prefix = "| ";
    content = content.substring(1).trimStart();
  }

  // Check if line has chords
  if (!content.includes("[")) {
    // Plain text line (no chords)
    const textLine = document.createElement("div");
    textLine.className = "preview-line";
    const lyricSpan = document.createElement("span");
    lyricSpan.className = "preview-lyrics";
    lyricSpan.textContent = prefix + content;
    textLine.appendChild(lyricSpan);
    container.appendChild(textLine);
    return;
  }

  // Parse chords and lyrics
  const chords = [];
  const lyrics = [];
  let pos = 0;
  const regex = /\[([^\]]+)\]/g;
  let match;
  let lyricText = prefix;

  while ((match = regex.exec(content)) !== null) {
    // Text before this chord
    const textBefore = content.substring(pos, match.index);
    lyricText += textBefore;

    chords.push({ position: lyricText.length, chord: match[1] });
    pos = match.index + match[0].length;
  }

  // Remaining text after last chord
  lyricText += content.substring(pos);

  // Check if this is a chord-only line (no lyrics text)
  const isChordOnly = lyricText.trim() === "" || lyricText.trim() === prefix.trim();

  // Build the chord line and lyric line
  const wrapper = document.createElement("div");
  wrapper.className = "preview-line";

  // Chord row
  const chordRow = document.createElement("div");
  chordRow.className = "preview-chords";

  // Build chord string with spacing
  let chordStr = "";
  for (let i = 0; i < chords.length; i++) {
    const targetPos = chords[i].position;
    while (chordStr.length < targetPos) {
      chordStr += "\u00A0";
    }
    chordStr += chords[i].chord;
    // Add a space after chord for readability
    if (i < chords.length - 1) {
      chordStr += " ";
    }
  }

  chordRow.textContent = chordStr;
  wrapper.appendChild(chordRow);

  // Lyric row (skip if chord-only)
  if (!isChordOnly) {
    const lyricRow = document.createElement("div");
    lyricRow.className = "preview-lyrics";
    lyricRow.textContent = lyricText;
    wrapper.appendChild(lyricRow);
  }

  container.appendChild(wrapper);
}

// ── Apply instruction ────────────────────────────────────────────────

applyBtn.addEventListener("click", apply);

instructionEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    apply();
  }
});

async function apply() {
  const songSheet = songSheetEl.value.trim();
  const instruction = instructionEl.value.trim();
  const apiKey = apiKeyEl.value.trim();

  if (!apiKey) {
    showStatus("Bitte gib deinen Anthropic API Key ein.", "error");
    apiKeyEl.focus();
    return;
  }

  if (!songSheet) {
    showStatus("Bitte füge zuerst ein Song Sheet ein.", "error");
    songSheetEl.focus();
    return;
  }

  if (!instruction) {
    showStatus("Bitte gib eine Anweisung ein.", "error");
    instructionEl.focus();
    return;
  }

  applyBtn.disabled = true;
  applyBtn.textContent = "...";
  showStatus("AI verarbeitet deine Anweisung...", "loading");

  try {
    const res = await fetch("/api/edit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ songSheet, instruction, apiKey }),
    });

    const data = await res.json();

    if (!res.ok) {
      showStatus(data.error || "Fehler bei der Verarbeitung.", "error");
      return;
    }

    // Save current state for undo
    pushUndo(songSheet);

    // Apply result
    songSheetEl.value = data.result;

    // Render preview
    renderPreview(data.result);

    // Add to history
    addHistory(instruction);

    // Clear instruction
    instructionEl.value = "";

    showStatus("Änderung angewendet.", "success");
    setTimeout(hideStatus, 3000);
  } catch (err) {
    showStatus("Netzwerkfehler: " + err.message, "error");
  } finally {
    applyBtn.disabled = false;
    applyBtn.textContent = "Anwenden";
  }
}

// Render preview on initial load if there's content
if (songSheetEl.value.trim()) {
  renderPreview(songSheetEl.value);
}

// Also render preview when user edits the song sheet directly
songSheetEl.addEventListener("input", () => {
  renderPreview(songSheetEl.value);
});
