// Shared helpers used by the popup, board, and content script.
// Loaded as a plain script (not a module) so it works as a content script too.

function jtUid() {
  return "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function jtTodayISO() {
  return new Date().toISOString().slice(0, 10);
}

function jtTomorrowISO() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function jtFormatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d)) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Best-effort logo lookup: guesses a company domain and asks Clearbit's free,
// keyless logo API for it. The <img> using this has an onerror fallback to a
// plain initials circle, so a wrong guess never breaks the UI.
function jtGuessLogoUrl(companyName) {
  if (!companyName) return null;
  const slug = companyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
  if (!slug) return null;
  return `https://logo.clearbit.com/${slug}.com`;
}

function jtInitials(name) {
  if (!name) return "?";
  return name.trim().slice(0, 2).toUpperCase();
}
