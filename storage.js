// Thin promise-based wrapper around chrome.storage.local.
// All cards live under a single key so reads/writes stay simple.

const JT_STORAGE_KEY = "jobCards";

async function jtGetCards() {
  const result = await chrome.storage.local.get(JT_STORAGE_KEY);
  return result[JT_STORAGE_KEY] || [];
}

async function jtSaveCards(cards) {
  await chrome.storage.local.set({ [JT_STORAGE_KEY]: cards });
}

async function jtAddCard(card) {
  const cards = await jtGetCards();
  cards.push(card);
  await jtSaveCards(cards);
  return card;
}

async function jtUpdateCard(id, updater) {
  const cards = await jtGetCards();
  const idx = cards.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  cards[idx] = updater(cards[idx]);
  await jtSaveCards(cards);
  return cards[idx];
}

async function jtDeleteCard(id) {
  const cards = await jtGetCards();
  await jtSaveCards(cards.filter((c) => c.id !== id));
}

// Builds a fresh card object. `stage` and `fields` (the stage-specific data
// like date/round/method) determine the first timeline entry too.
function jtBuildCard({ company, role, link, stage, fields }) {
  const now = new Date().toISOString();
  return {
    id: jtUid(),
    company,
    role: role || "",
    link: link || "",
    logoUrl: jtGuessLogoUrl(company),
    stage,
    current: { ...fields },
    timeline: [{ stage, ...fields, loggedAt: now }],
    notes: "",
    createdAt: now,
    updatedAt: now,
  };
}

// Appends a move to a card's timeline and updates its current stage/fields.
// Never mutates or removes earlier timeline entries.
function jtMoveCard(card, stage, fields) {
  const now = new Date().toISOString();
  return {
    ...card,
    stage,
    current: { ...fields },
    timeline: [...card.timeline, { stage, ...fields, loggedAt: now }],
    updatedAt: now,
  };
}
