const COLUMNS = [
  { id: "saved", label: "Saved", letter: "S" },
  { id: "applied", label: "Applied", letter: "A" },
  { id: "reverted", label: "Reverted", letter: "R" },
  { id: "interview", label: "Interview", letter: "I" },
  { id: "status", label: "Status", letter: "F" },
];
const COLOR_VAR = { saved: "var(--saved)", applied: "var(--applied)", reverted: "var(--reverted)", interview: "var(--interview)", status: "var(--status)" };
const LABEL = Object.fromEntries(COLUMNS.map((c) => [c.id, c.label]));

let cards = [];

async function init() {
  cards = await jtGetCards();
  render();
}

// ---------- rendering the board ----------

function logoNode(card, size) {
  const wrap = document.createElement("div");
  wrap.className = "logo-circle";
  wrap.style.width = size + "px";
  wrap.style.height = size + "px";
  wrap.style.background = COLOR_VAR[card.stage];
  wrap.textContent = jtInitials(card.company);
  const url = card.logoUrl || jtGuessLogoUrl(card.company);
  if (url) {
    const img = document.createElement("img");
    img.src = url;
    img.onerror = () => { wrap.textContent = jtInitials(card.company); };
    img.onload = () => { wrap.textContent = ""; wrap.appendChild(img); };
  }
  return wrap;
}

function metaChipHTML(card) {
  const c = card.current || {};
  switch (card.stage) {
    case "saved":
      return card.link ? `<a class="card-link" href="${escapeAttr(card.link)}" target="_blank" rel="noopener">View posting</a>` : "";
    case "applied":
      return `<span class="meta-chip">${jtFormatDate(c.date)}</span>`;
    case "reverted":
      return `<span class="meta-chip">${escapeHtml(c.method || "")}${c.method ? " · " : ""}${jtFormatDate(c.date)}</span>`;
    case "interview":
      return `<span class="meta-chip">Round ${c.round || 1} · ${jtFormatDate(c.date)}${c.time ? ", " + escapeHtml(c.time) : ""}</span>`;
    case "status":
      return `<span class="meta-chip">${escapeHtml(c.outcome || "")}${c.outcome ? " · " : ""}${jtFormatDate(c.date)}</span>`;
    default:
      return "";
  }
}

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}
function escapeAttr(s) { return escapeHtml(s); }

function render() {
  const board = document.getElementById("board");
  board.innerHTML = "";

  COLUMNS.forEach((col) => {
    const colCards = cards.filter((c) => c.stage === col.id);
    const colEl = document.createElement("div");
    colEl.className = "column";
    colEl.dataset.stage = col.id;
    colEl.innerHTML = `
      <div class="column-header">
        <div class="column-icon" style="background:${COLOR_VAR[col.id]};">${col.letter}</div>
        <div class="column-title">${col.label}</div>
        <div class="column-count">${colCards.length}</div>
      </div>
      <div class="card-list"></div>
    `;
    const list = colEl.querySelector(".card-list");

    if (colCards.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-column";
      empty.textContent = "No cards yet";
      list.appendChild(empty);
    }

    colCards.forEach((c) => {
      const cardEl = document.createElement("div");
      cardEl.className = "card";
      cardEl.style.setProperty("--accent-color", COLOR_VAR[c.stage]);
      cardEl.draggable = true;
      cardEl.dataset.id = c.id;

      const row = document.createElement("div");
      row.className = "card-row";
      const titles = document.createElement("div");
      titles.className = "card-titles";
      titles.innerHTML = `<p class="card-role">${escapeHtml(c.role || "Untitled role")}</p><p class="card-company">${escapeHtml(c.company)}</p>`;
      row.appendChild(titles);
      row.appendChild(logoNode(c, 26));
      cardEl.appendChild(row);

      const meta = document.createElement("div");
      meta.innerHTML = metaChipHTML(c);
      cardEl.appendChild(meta);

      cardEl.addEventListener("click", (e) => {
        if (e.target.tagName === "A") return; // let the link open normally
        openDetailModal(c.id);
      });
      cardEl.addEventListener("dragstart", () => cardEl.classList.add("dragging"));
      cardEl.addEventListener("dragend", () => cardEl.classList.remove("dragging"));

      list.appendChild(cardEl);
    });

    const addBtn = document.createElement("button");
    addBtn.className = "add-card";
    addBtn.textContent = "+ Add card";
    addBtn.addEventListener("click", () => openAddModal(col.id));
    colEl.appendChild(addBtn);

    colEl.addEventListener("dragover", (e) => {
      e.preventDefault();
      const dragging = document.querySelector(".dragging");
      if (dragging && dragging.parentElement !== list) list.appendChild(dragging);
    });
    colEl.addEventListener("drop", (e) => {
      e.preventDefault();
      const dragging = document.querySelector(".dragging");
      if (!dragging) return;
      const id = dragging.dataset.id;
      const card = cards.find((c) => c.id === id);
      if (!card) return render();
      if (card.stage === col.id) return render(); // dropped back in same column, no-op
      openMoveModal(id, col.id);
    });

    board.appendChild(colEl);
  });
}

// ---------- stage-specific field helpers (shared by move + add modals) ----------

function nextInterviewRound(card) {
  const priorRounds = (card?.timeline || [])
    .filter((t) => t.stage === "interview")
    .map((t) => t.round || 1);
  return priorRounds.length ? Math.max(...priorRounds) + 1 : 1;
}

function stageFieldsHTML(stage, prefill, ns) {
  const today = jtTodayISO();
  const date = prefill.date || today;
  if (stage === "saved") {
    return `
      <label class="field-label">Job posting link</label>
      <input class="text-input" id="${ns}Link" placeholder="https://..." value="${escapeAttr(prefill.link || "")}" />
    `;
  }
  if (stage === "applied") {
    return `
      <label class="field-label">Applied on</label>
      <input class="text-input" type="date" id="${ns}Date" value="${date}" />
      <div class="chip-row">
        <button type="button" class="suggest-chip" data-target="${ns}Date" data-value="${today}">Today</button>
        <button type="button" class="suggest-chip" data-target="${ns}Date" data-value="${jtTomorrowISO()}">Tomorrow</button>
      </div>
    `;
  }
  if (stage === "reverted") {
    return `
      <label class="field-label">How did they revert?</label>
      <select class="select-input" id="${ns}Method">
        ${["Email", "Call", "Portal"].map((m) => `<option value="${m}" ${prefill.method === m ? "selected" : ""}>${m}</option>`).join("")}
      </select>
      <label class="field-label">Date</label>
      <input class="text-input" type="date" id="${ns}Date" value="${date}" />
      <div class="chip-row">
        <button type="button" class="suggest-chip" data-target="${ns}Date" data-value="${today}">Today</button>
        <button type="button" class="suggest-chip" data-target="${ns}Date" data-value="${jtTomorrowISO()}">Tomorrow</button>
      </div>
    `;
  }
  if (stage === "interview") {
    return `
      <label class="field-label">Round</label>
      <input class="text-input" type="number" min="1" id="${ns}Round" value="${prefill.round || 1}" />
      <label class="field-label">Date</label>
      <input class="text-input" type="date" id="${ns}Date" value="${date}" />
      <div class="chip-row">
        <button type="button" class="suggest-chip" data-target="${ns}Date" data-value="${today}">Today</button>
        <button type="button" class="suggest-chip" data-target="${ns}Date" data-value="${jtTomorrowISO()}">Tomorrow</button>
      </div>
      <label class="field-label">Time</label>
      <input class="text-input" type="time" id="${ns}Time" value="${prefill.time || ""}" />
    `;
  }
  if (stage === "status") {
    return `
      <label class="field-label">Outcome</label>
      <select class="select-input" id="${ns}Outcome">
        ${["Accepted", "Rejected"].map((o) => `<option value="${o}" ${prefill.outcome === o ? "selected" : ""}>${o}</option>`).join("")}
      </select>
      <label class="field-label">Date</label>
      <input class="text-input" type="date" id="${ns}Date" value="${date}" />
      <div class="chip-row">
        <button type="button" class="suggest-chip" data-target="${ns}Date" data-value="${today}">Today</button>
        <button type="button" class="suggest-chip" data-target="${ns}Date" data-value="${jtTomorrowISO()}">Tomorrow</button>
      </div>
    `;
  }
  return "";
}

function readStageFields(stage, ns) {
  const val = (id) => { const el = document.getElementById(id); return el ? el.value : ""; };
  if (stage === "saved") return { link: val(`${ns}Link`) };
  if (stage === "applied") return { date: val(`${ns}Date`) };
  if (stage === "reverted") return { method: val(`${ns}Method`), date: val(`${ns}Date`) };
  if (stage === "interview") return { round: Number(val(`${ns}Round`)) || 1, date: val(`${ns}Date`), time: val(`${ns}Time`) };
  if (stage === "status") return { outcome: val(`${ns}Outcome`), date: val(`${ns}Date`) };
  return {};
}

function wireChipButtons(container) {
  container.querySelectorAll(".suggest-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = document.getElementById(btn.dataset.target);
      if (target) target.value = btn.dataset.value;
      container.querySelectorAll(`.suggest-chip[data-target="${btn.dataset.target}"]`).forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });
}

// ---------- move modal (drag-and-drop confirmation) ----------

function openMoveModal(cardId, targetStage) {
  const card = cards.find((c) => c.id === cardId);
  if (!card) return render();

  const prefill = targetStage === "interview" ? { round: nextInterviewRound(card) } : {};
  const modal = document.getElementById("moveModal");
  modal.innerHTML = `
    <div class="modal-header">
      <p class="card-role" style="font-size:14px; margin:0;">Move to ${LABEL[targetStage]}</p>
      <button class="modal-close" id="moveCloseBtn">✕</button>
    </div>
    <p class="card-company" style="margin: 0 0 4px;">${escapeHtml(card.company)} — ${escapeHtml(card.role || "")}</p>
    ${stageFieldsHTML(targetStage, prefill, "move")}
    <div class="btn-row">
      <button class="btn secondary" id="moveCancelBtn">Cancel</button>
      <button class="btn primary" id="moveConfirmBtn">Confirm move</button>
    </div>
  `;
  wireChipButtons(modal);

  const close = () => { document.getElementById("moveOverlay").classList.remove("open"); render(); };
  document.getElementById("moveCloseBtn").addEventListener("click", close);
  document.getElementById("moveCancelBtn").addEventListener("click", close);
  document.getElementById("moveConfirmBtn").addEventListener("click", async () => {
    const fields = readStageFields(targetStage, "move");
    const updated = await jtUpdateCard(cardId, (c) => jtMoveCard(c, targetStage, fields));
    cards = cards.map((c) => (c.id === cardId ? updated : c));
    document.getElementById("moveOverlay").classList.remove("open");
    render();
  });

  document.getElementById("moveOverlay").classList.add("open");
}

// ---------- add card modal ----------

function openAddModal(defaultStage) {
  const modal = document.getElementById("addModal");

  modal.innerHTML = `
    <div class="modal-header">
      <p class="card-role" style="font-size:14px; margin:0;">Add to ${LABEL[defaultStage]}</p>
      <button class="modal-close" id="addCloseBtn">✕</button>
    </div>
    <label class="field-label">Company</label>
    <input class="text-input" id="addCompany" placeholder="e.g. Figma" />
    <label class="field-label">Role</label>
    <input class="text-input" id="addRole" placeholder="e.g. Product Designer" />
    <div id="addStageFields">${stageFieldsHTML(defaultStage, {}, "add")}</div>
    <div class="btn-row">
      <button class="btn secondary" id="addCancelBtn">Cancel</button>
      <button class="btn primary" id="addConfirmBtn">Add to board</button>
    </div>
  `;

  const fieldsHost = document.getElementById("addStageFields");
  wireChipButtons(fieldsHost);

  const close = () => document.getElementById("addOverlay").classList.remove("open");
  document.getElementById("addCloseBtn").addEventListener("click", close);
  document.getElementById("addCancelBtn").addEventListener("click", close);
  document.getElementById("addConfirmBtn").addEventListener("click", async () => {
    const company = document.getElementById("addCompany").value.trim();
    if (!company) { document.getElementById("addCompany").focus(); return; }
    const role = document.getElementById("addRole").value.trim();
    const stage = defaultStage;
    const fields = readStageFields(stage, "add");
    const link = stage === "saved" ? fields.link : "";
    const card = jtBuildCard({ company, role, link, stage, fields: stage === "saved" ? {} : fields });
    await jtAddCard(card);
    cards.push(card);
    close();
    render();
  });

  document.getElementById("addOverlay").classList.add("open");
}

document.getElementById("addBtn").addEventListener("click", () => openAddModal("saved"));

// ---------- detail modal ----------

function openDetailModal(cardId) {
  const card = cards.find((c) => c.id === cardId);
  if (!card) return;

  const modal = document.getElementById("detailModal");
  modal.innerHTML = `
    <div class="modal-header">
      <span id="detailLogoSlot"></span>
      <div style="flex:1;">
        <input class="text-input" id="detailRole" value="${escapeAttr(card.role || "")}" style="font-weight:600; margin-bottom:4px;" />
        <input class="text-input" id="detailCompany" value="${escapeAttr(card.company)}" />
      </div>
      <button class="modal-close" id="detailCloseBtn">✕</button>
    </div>
    ${metaChipHTML(card)}
    <label class="field-label">Posting link</label>
    <input class="text-input" id="detailLink" value="${escapeAttr(card.link || "")}" placeholder="https://..." />

    <div class="section-label">Timeline</div>
    ${card.timeline.slice().reverse().map((t) => `
      <div class="timeline-item">
        <div class="timeline-dot" style="background:${COLOR_VAR[t.stage]};"></div>
        <div>
          <div class="timeline-text">${timelineLabel(t)}</div>
          <div class="timeline-date">${jtFormatDate(t.date) || ""}${t.time ? ", " + escapeHtml(t.time) : ""}</div>
        </div>
      </div>
    `).join("")}

    <div class="section-label">Notes</div>
    <textarea class="notes-box" id="detailNotes" placeholder="Add a note about this application...">${escapeHtml(card.notes || "")}</textarea>

    <div class="btn-row">
      <button class="btn danger" id="detailDeleteBtn">Delete</button>
      <button class="btn primary" id="detailSaveBtn">Save changes</button>
    </div>
  `;

  document.getElementById("detailLogoSlot").appendChild(logoNode(card, 36));

  const close = () => document.getElementById("detailOverlay").classList.remove("open");
  document.getElementById("detailCloseBtn").addEventListener("click", close);

  document.getElementById("detailSaveBtn").addEventListener("click", async () => {
    const role = document.getElementById("detailRole").value.trim();
    const company = document.getElementById("detailCompany").value.trim();
    const link = document.getElementById("detailLink").value.trim();
    const notes = document.getElementById("detailNotes").value;
    const updated = await jtUpdateCard(cardId, (c) => ({
      ...c, role, company, link, notes, logoUrl: jtGuessLogoUrl(company), updatedAt: new Date().toISOString(),
    }));
    cards = cards.map((c) => (c.id === cardId ? updated : c));
    close();
    render();
  });

  document.getElementById("detailDeleteBtn").addEventListener("click", async () => {
    if (!confirm(`Delete the ${card.company} application? This can't be undone.`)) return;
    await jtDeleteCard(cardId);
    cards = cards.filter((c) => c.id !== cardId);
    close();
    render();
  });

  document.getElementById("detailOverlay").classList.add("open");
}

function timelineLabel(t) {
  switch (t.stage) {
    case "saved": return "Saved";
    case "applied": return "Applied";
    case "reverted": return `Reverted${t.method ? " via " + escapeHtml(t.method) : ""}`;
    case "interview": return `Interview — Round ${t.round || 1}`;
    case "status": return escapeHtml(t.outcome || "Status updated");
    default: return escapeHtml(t.stage || "");
  }
}

[document.getElementById("detailOverlay"), document.getElementById("moveOverlay"), document.getElementById("addOverlay")].forEach((ov) => {
  ov.addEventListener("click", (e) => { if (e.target === ov) { ov.classList.remove("open"); render(); } });
});

init();
