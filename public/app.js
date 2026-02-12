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
});

// Clear
clearBtn.addEventListener("click", () => {
  if (songSheetEl.value.trim()) {
    pushUndo(songSheetEl.value);
  }
  songSheetEl.value = "";
  songSheetEl.focus();
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

// Apply instruction
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
