const views = {
  loading: document.getElementById("loadingView"),
  detected: document.getElementById("detectedView"),
  formNudge: document.getElementById("formNudgeView"),
  manual: document.getElementById("manualView"),
  confirm: document.getElementById("confirmView"),
};

function showView(name) {
  Object.values(views).forEach((v) => v.classList.add("hidden"));
  views[name].classList.remove("hidden");
}

let currentTab = null;
let pageInfo = { type: "none" };

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tab;

  if (!tab || !tab.id || !tab.url || !tab.url.startsWith("http")) {
    showView("manual");
    return;
  }

  chrome.tabs.sendMessage(tab.id, { type: "JT_GET_PAGE_INFO" }, (response) => {
    if (chrome.runtime.lastError || !response) {
      // Content script isn't present on this page (e.g. it loaded before
      // the extension did) - manual entry still works fine.
      showView("manual");
      return;
    }
    pageInfo = response;
    renderForPageInfo();
  });
}

function renderForPageInfo() {
  if (pageInfo.type === "job" || pageInfo.type === "maybe-job") {
    document.getElementById("detectedRole").value = pageInfo.role || "";
    document.getElementById("detectedCompany").value = pageInfo.company || "";
    updateDetectedLogo(pageInfo.company);
    showView("detected");
  } else if (pageInfo.type === "form") {
    showView("formNudge");
  } else {
    showView("manual");
  }
}

function updateDetectedLogo(company) {
  const el = document.getElementById("detectedLogo");
  el.textContent = jtInitials(company);
  const url = jtGuessLogoUrl(company);
  if (!url) return;
  const img = document.createElement("img");
  img.src = url;
  img.onerror = () => {
    el.textContent = jtInitials(company);
  };
  img.onload = () => {
    el.textContent = "";
    el.appendChild(img);
  };
}

document.getElementById("detectedCompany").addEventListener("input", (e) => {
  updateDetectedLogo(e.target.value);
});

async function saveDetected(stage, fields) {
  const company = document.getElementById("detectedCompany").value.trim();
  const role = document.getElementById("detectedRole").value.trim();
  const card = jtBuildCard({ company, role, link: currentTab.url, stage, fields });
  await jtAddCard(card);
  showView("confirm");
}

document.getElementById("saveForLaterBtn").addEventListener("click", () => saveDetected("saved", {}));
document.getElementById("justAppliedBtn").addEventListener("click", () =>
  saveDetected("applied", { date: jtTodayISO() })
);

document.getElementById("formNoBtn").addEventListener("click", () => showView("manual"));
document.getElementById("formYesBtn").addEventListener("click", () => {
  document.getElementById("manualStage").value = "applied";
  showView("manual");
});

document.getElementById("manualSaveBtn").addEventListener("click", async () => {
  const company = document.getElementById("manualCompany").value.trim();
  const role = document.getElementById("manualRole").value.trim();
  const stage = document.getElementById("manualStage").value;
  if (!company) {
    document.getElementById("manualCompany").focus();
    return;
  }
  const fields = stage === "applied" ? { date: jtTodayISO() } : {};
  const link = currentTab && currentTab.url && currentTab.url.startsWith("http") ? currentTab.url : "";
  const card = jtBuildCard({ company, role, link, stage, fields });
  await jtAddCard(card);
  showView("confirm");
});

document.getElementById("viewBoardBtn").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("board/board.html") });
});

init();
