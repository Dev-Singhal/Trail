// Runs on every page. Figures out what kind of page this is and, if it's a
// job posting, extracts what it can. Does nothing visible on its own - the
// popup asks it for this info via chrome.runtime messaging.

function jtText(selector) {
  const el = document.querySelector(selector);
  return el ? el.textContent.trim() : null;
}

function jtStripBadge(title) {
  return (title || "").replace(/^\(\d+\+?\)\s*/, "");
}

// Many job boards and ATS platforms embed structured JobPosting data
// (schema.org, via JSON-LD) for search-engine purposes - far more reliable
// than guessing at CSS classes when present.
function jtFromJsonLd() {
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
  for (const script of scripts) {
    try {
      const data = JSON.parse(script.textContent);
      const candidates = Array.isArray(data) ? data : [data];
      for (const item of candidates) {
        const type = item && (item["@type"] || (item["@graph"] && item["@graph"][0] && item["@graph"][0]["@type"]));
        const posting = type === "JobPosting" ? item : (item["@graph"] || []).find((g) => g["@type"] === "JobPosting");
        if (posting) {
          const company =
            (posting.hiringOrganization && posting.hiringOrganization.name) ||
            posting.hiringOrganization ||
            null;
          if (posting.title || company) {
            return { role: posting.title || null, company: typeof company === "string" ? company : null };
          }
        }
      }
    } catch (err) {
      // Not valid JSON, or not a JobPosting - ignore and keep looking.
    }
  }
  return null;
}

// LinkedIn's job title, at least in the list+preview layout, is itself a
// link to /jobs/view/{id} - not a heading tag at all, which is why a
// heading-based search comes up empty there. This pairs each such link
// with its own nearby /company/ link (using the same "stop if this scope
// spans multiple postings" safeguard as jtFromCompanyLink below), then -
// since a list+preview page typically has the list before the preview
// pane in DOM order - takes the LAST valid pair found, which tends to be
// the currently open preview rather than a list row.
function jtFromJobViewLink() {
  const jobLinks = Array.from(document.querySelectorAll('a[href*="/jobs/view/"]'));
  const matches = [];
  for (const link of jobLinks) {
    const role = (link.textContent || "").trim();
    if (!role) continue;
    let container = link;
    for (let i = 0; i < 6 && container; i++) {
      container = container.parentElement;
      if (!container) break;
      if (container.querySelectorAll('a[href*="/jobs/view/"]').length > 1) break;
      const companyLink = container.querySelector('a[href*="/company/"]');
      if (companyLink && companyLink.textContent.trim()) {
        matches.push({ role, company: companyLink.textContent.trim() });
        break;
      }
    }
  }
  return matches.length ? matches[matches.length - 1] : null;
}

// LinkedIn (and many company career pages) reliably link a company's name
// to its profile/about page via a URL containing "/company/" - regardless
// of how often the CSS class names around it change. This anchors on that
// link, then looks for the nearest heading as the role. Tries every such
// link on the page (there may be several, e.g. in a job list) until one
// has a heading nearby, rather than assuming the first is the right one.
function jtFromCompanyLink() {
  const companyLinks = Array.from(document.querySelectorAll('a[href*="/company/"]'));
  for (const link of companyLinks) {
    const companyName = (link.textContent || "").trim();
    if (!companyName) continue;
    let container = link;
    for (let i = 0; i < 6 && container; i++) {
      container = container.parentElement;
      if (!container) break;
      // If this ancestor now spans more than one company link, we've
      // walked up into a wrapper covering multiple postings (e.g. a
      // results list) - any heading found from here on isn't reliably
      // "this" link's heading, so stop and move on to the next candidate.
      if (container.querySelectorAll('a[href*="/company/"]').length > 1) break;
      const heading = container.querySelector("h1, h2");
      if (heading && heading.textContent.trim()) {
        return { role: heading.textContent.trim(), company: companyName };
      }
    }
  }
  return null;
}

// Fallback structural heuristic: finds an "Apply"-like control by its
// visible text (checking every leaf element, not just <a>/<button>, since
// some sites render it as nested <span>s with a click handler instead of a
// real link), then reads the nearest heading and a nearby logo/text as the
// role and company. Used when there's no /company/-style link to anchor on.
function jtFromApplyButton() {
  const applyPattern = /^(easy apply|apply now|apply)$/i;
  const leafElements = Array.from(document.querySelectorAll("body *")).filter((el) => el.children.length === 0);
  const applyEl = leafElements.find((el) => applyPattern.test((el.textContent || "").trim()));
  if (!applyEl) return null;

  let container = applyEl;
  let headingEl = null;
  for (let i = 0; i < 6 && container; i++) {
    container = container.parentElement;
    if (!container) break;
    const headings = container.querySelectorAll("h1, h2");
    // More than one heading in scope means we've widened into territory
    // covering multiple postings/cards - stop rather than risk grabbing
    // the wrong one.
    if (headings.length > 1) break;
    if (headings.length === 1) { headingEl = headings[0]; break; }
  }
  if (!headingEl) return null;

  const role = headingEl.textContent.trim();
  let company = null;
  const img = container.querySelector("img[alt]");
  if (img && img.alt && img.alt.trim() && img.alt.trim().toLowerCase() !== role.toLowerCase()) {
    company = img.alt.trim();
  }
  if (!company) {
    const textNodes = Array.from(container.querySelectorAll("a, span, div")).filter((el) => {
      const t = (el.textContent || "").trim();
      return t && t !== role && t.length < 60 && el.children.length === 0;
    });
    if (textNodes[0]) company = textNodes[0].textContent.trim();
  }

  return role || company ? { role, company } : null;
}

// Site-specific extraction for platforms where a simple, stable selector
// exists. Kept short - the heuristics above catch far more sites, including
// ones we haven't written specific rules for.
const JT_SITE_RULES = [
  {
    match: () => location.hostname.includes("naukri.com"),
    extract: () => ({
      role: jtText(".jd-header-title") || jtText("h1"),
      company: jtText(".jd-header-comp-name"),
    }),
  },
  {
    match: () => location.hostname.includes("indeed.com"),
    extract: () => ({
      role: jtText("h1.jobsearch-JobInfoHeader-title") || jtText("h1"),
      company: jtText("[data-company-name]") || jtText(".jobsearch-CompanyInfoContainer a"),
    }),
  },
];

function jtFromTitle() {
  const title = jtStripBadge(document.title);
  const parts = title.split(/ at | - |\|/);
  return parts[0] ? parts[0].trim() : null;
}
function jtCompanyFromTitle() {
  const title = jtStripBadge(document.title);
  const atMatch = title.match(/ at (.+?)(\||$)/i);
  if (atMatch) return atMatch[1].trim();
  const dashParts = title.split(" - ");
  if (dashParts.length > 1) return dashParts[1].trim();
  return null;
}

function jtDetectGoogleForm() {
  return location.hostname === "docs.google.com" && location.pathname.includes("/forms/");
}

function jtGetPageInfo() {
  if (jtDetectGoogleForm()) {
    return { type: "form" };
  }

  const jsonLd = jtFromJsonLd();
  if (jsonLd && (jsonLd.role || jsonLd.company)) {
    return { type: "job", role: jsonLd.role || "", company: jsonLd.company || "", link: location.href };
  }

  const jobViewLinkResult = jtFromJobViewLink();
  if (jobViewLinkResult && (jobViewLinkResult.role || jobViewLinkResult.company)) {
    return { type: "job", role: jobViewLinkResult.role || "", company: jobViewLinkResult.company || "", link: location.href };
  }

  const companyLinkResult = jtFromCompanyLink();
  if (companyLinkResult && (companyLinkResult.role || companyLinkResult.company)) {
    return { type: "job", role: companyLinkResult.role || "", company: companyLinkResult.company || "", link: location.href };
  }

  const applyResult = jtFromApplyButton();
  if (applyResult && (applyResult.role || applyResult.company)) {
    return { type: "job", role: applyResult.role || "", company: applyResult.company || "", link: location.href };
  }

  for (const rule of JT_SITE_RULES) {
    try {
      if (rule.match()) {
        const data = rule.extract();
        if (data.role || data.company) {
          return { type: "job", role: data.role || "", company: data.company || "", link: location.href };
        }
      }
    } catch (err) {
      // A site's markup changed and broke a selector - fall through.
    }
  }

  if (location.hostname.includes("linkedin.com")) {
    return { type: "none" };
  }

  const guessRole = jtFromTitle();
  const guessCompany = jtCompanyFromTitle();
  if (guessRole || guessCompany) {
    return { type: "maybe-job", role: guessRole || "", company: guessCompany || "", link: location.href };
  }

  return { type: "none" };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "JT_GET_PAGE_INFO") {
    sendResponse(jtGetPageInfo());
  }
  return true;
});
