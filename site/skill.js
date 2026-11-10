const STRINGS = {
  en: {
    back: "← Back to catalog",
    copy: "Copy",
    copied: "Copied!",
    failed: "Copy failed",
    loading: "Loading…",
    missing: "Skill not found.",
    source: "Source",
    raw: "Raw Markdown",
  },
  pt: {
    back: "← Voltar ao catálogo",
    copy: "Copiar",
    copied: "Copiado!",
    failed: "Falha ao copiar",
    loading: "Carregando…",
    missing: "Skill não encontrada.",
    source: "Fonte",
    raw: "Markdown bruto",
  },
};

const params = new URLSearchParams(location.search);
const requestedPath = params.get("path");
const stored = localStorage.getItem("skills-lang");
let lang = params.get("lang") || stored || (navigator.language.toLowerCase().startsWith("pt") ? "pt" : "en");
let entry = null;
let bodyText = "";
let siteTitle = "";
let siteRepository = "";
let siteRef = "main";

const $ = (selector) => document.querySelector(selector);

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

function stripFrontmatter(text) {
  if (!text.startsWith("---")) return text;
  const lines = text.split("\n");
  if (lines[0].trim() !== "---") return text;
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index].trim() === "---") {
      return lines.slice(index + 1).join("\n").replace(/^\n+/, "");
    }
  }
  return text;
}

function applyStrings() {
  const strings = STRINGS[lang];
  $("#back").textContent = strings.back;
  $("#copy").textContent = strings.copy;
}

function applySiteLinks() {
  const brand = document.getElementById("brand");
  if (brand) brand.textContent = siteTitle || "Skills";
  if (!siteRepository) return;
  const source = document.getElementById("footer-github");
  if (source) source.href = `https://github.com/${siteRepository}`;
}

function categoryLabel(labels, key) {
  if (!labels) return key;
  return labels[lang] || labels.en || Object.values(labels)[0] || key;
}

async function main() {
  applyStrings();
  $("#content").textContent = STRINGS[lang].loading;

  const data = await (await fetch("skills.json")).json();
  siteTitle = data.title || "";
  siteRepository = data.repository || "";
  siteRef = data.ref || "main";
  applySiteLinks();
  entry = data.skills.find((skill) => skill.path === requestedPath);

  if (!entry) {
    $("#content").textContent = STRINGS[lang].missing;
    return;
  }

  lang = entry.language;
  localStorage.setItem("skills-lang", lang);
  applyStrings();

  document.title = `${entry.title} — ${data.title || "Skills"}`;
  document.documentElement.lang = lang === "pt" ? "pt-BR" : "en";

  const siblings = data.skills.filter((skill) => skill.group === entry.group);
  const languageLinks = siblings.map((skill) => (
    `<a class="lang-link ${skill.language === entry.language ? "active" : ""}" href="skill.html?path=${encodeURIComponent(skill.path)}&lang=${skill.language}">${skill.language.toUpperCase()}</a>`
  )).join("");

  const sourceUrl = siteRepository
    ? `https://github.com/${siteRepository}/blob/${siteRef}/${entry.source}`
    : "";
  const sourceCode = `<code>${escapeHtml(entry.source)}</code>`;
  const sourceHtml = sourceUrl
    ? `<a href="${sourceUrl}">${sourceCode}</a>`
    : sourceCode;

  $("#meta").innerHTML = `
    <div class="card-top">
      <span class="badge">${escapeHtml(categoryLabel(entry.categoryLabel, entry.category))}</span>
      <span class="lang-links">${languageLinks}</span>
    </div>
    <h1>${escapeHtml(entry.title)}</h1>
    <p class="lead">${escapeHtml(entry.description)}</p>
    <p class="source">${escapeHtml(STRINGS[lang].source)}: ${sourceHtml} · <a href="${escapeHtml(entry.path)}">${escapeHtml(STRINGS[lang].raw)}</a></p>`;

  const response = await fetch(entry.path);
  if (!response.ok) throw new Error(STRINGS[lang].missing);
  bodyText = stripFrontmatter(await response.text());

  try {
    $("#content").innerHTML = window.marked ? window.marked.parse(bodyText) : `<pre>${escapeHtml(bodyText)}</pre>`;
  } catch {
    $("#content").innerHTML = `<pre>${escapeHtml(bodyText)}</pre>`;
  }

  $("#copy").addEventListener("click", async () => {
    const strings = STRINGS[lang];
    try {
      await navigator.clipboard.writeText(bodyText);
      $("#copy").textContent = strings.copied;
      setTimeout(() => {
        $("#copy").textContent = strings.copy;
      }, 1500);
    } catch {
      $("#copy").textContent = strings.failed;
      setTimeout(() => {
        $("#copy").textContent = strings.copy;
      }, 1500);
    }
  });
}

main().catch((error) => {
  $("#content").textContent = error.message;
});
