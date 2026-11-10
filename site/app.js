const I18N = {
  en: {
    title: "Skills catalog",
    subtitle: "Open a skill, copy it, or install the whole catalog.",
    search: "Search skills...",
    all: "All",
    open: "Open",
    empty: "No skills found.",
    en: "English",
    pt: "Português",
  },
  pt: {
    title: "Catálogo de skills",
    subtitle: "Abra uma skill, copie ou instale o catálogo inteiro.",
    search: "Buscar skills...",
    all: "Todas",
    open: "Abrir",
    empty: "Nenhuma skill encontrada.",
    en: "English",
    pt: "Português",
  },
};

const $ = (selector) => document.querySelector(selector);
const stored = localStorage.getItem("skills-lang");
let lang = stored || (navigator.language.toLowerCase().startsWith("pt") ? "pt" : "en");
let skills = [];
let activeCategory = "all";
let siteTitle = "";
let siteRepository = "";
let siteRef = "main";

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

function setLang(next) {
  lang = next;
  localStorage.setItem("skills-lang", lang);
  render();
}

function applySiteLinks() {
  if (!siteRepository) return;
  const base = `https://github.com/${siteRepository}`;
  const raw = `https://raw.githubusercontent.com/${siteRepository}/${siteRef}`;
  const links = {
    "link-github": base,
    "link-manifest": `${raw}/llms.txt`,
    "link-opencode": `${raw}/opencode.json`,
    "footer-github": base,
    "footer-manifest": `${raw}/llms.txt`,
  };
  for (const [id, href] of Object.entries(links)) {
    const element = document.getElementById(id);
    if (element) element.href = href;
  }
  const brand = document.getElementById("brand");
  if (brand) brand.textContent = siteTitle || "Skills";
}

function groups() {
  const map = new Map();
  for (const skill of skills) {
    if (!map.has(skill.group)) map.set(skill.group, []);
    map.get(skill.group).push(skill);
  }
  return [...map.entries()].map(([group, entries]) => ({
    group,
    order: entries[0].order,
    category: entries[0].category,
    categoryLabel: entries[0].categoryLabel,
    entries,
  }));
}

function pick(entries) {
  return entries.find((entry) => entry.language === lang)
    || entries.find((entry) => entry.language === "en")
    || entries[0];
}

function categoryLabel(labels, key) {
  if (!labels) return key;
  return labels[lang] || labels.en || Object.values(labels)[0] || key;
}

function render() {
  const strings = I18N[lang];
  document.documentElement.lang = lang === "pt" ? "pt-BR" : "en";
  document.title = siteTitle || strings.title;
  $("#hero-title").textContent = siteTitle || strings.title;
  $("#hero-subtitle").textContent = strings.subtitle;
  $("#search").placeholder = strings.search;
  $("#empty").textContent = strings.empty;
  document.querySelectorAll("[data-lang]").forEach((button) => {
    button.classList.toggle("active", button.dataset.lang === lang);
  });

  const filters = $("#filters");
  filters.innerHTML = "";
  const allButton = document.createElement("button");
  allButton.type = "button";
  allButton.textContent = strings.all;
  allButton.className = activeCategory === "all" ? "chip active" : "chip";
  allButton.addEventListener("click", () => {
    activeCategory = "all";
    render();
  });
  filters.appendChild(allButton);

  const categories = [...new Set(skills.map((skill) => skill.category))];
  for (const category of categories) {
    const label = categoryLabel(
      skills.find((skill) => skill.category === category).categoryLabel,
      category,
    );
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.className = activeCategory === category ? "chip active" : "chip";
    button.addEventListener("click", () => {
      activeCategory = category;
      render();
    });
    filters.appendChild(button);
  }

  const query = $("#search").value.trim().toLowerCase();
  const catalog = $("#catalog");
  catalog.innerHTML = "";
  let count = 0;

  const ordered = groups().sort((a, b) => a.category.localeCompare(b.category) || a.order - b.order);
  for (const group of ordered) {
    if (activeCategory !== "all" && group.category !== activeCategory) continue;
    const entry = pick(group.entries);
    const haystack = [
      entry.name,
      entry.title,
      entry.description,
      ...group.entries.map((item) => item.description),
    ].join(" ").toLowerCase();
    if (query && !haystack.includes(query)) continue;
    count += 1;
    catalog.appendChild(card(group, entry, strings));
  }

  $("#empty").hidden = count > 0;
}

function card(group, entry, strings) {
  const element = document.createElement("article");
  element.className = "card";

  const languageLinks = group.entries.map((item) => {
    const label = I18N[lang][item.language] || item.language.toUpperCase();
    return `<a class="lang-link ${item.language === lang ? "active" : ""}" href="skill.html?path=${encodeURIComponent(item.path)}&lang=${item.language}">${label}</a>`;
  }).join("");

  element.innerHTML = `
    <div class="card-top">
      <span class="badge">${escapeHtml(categoryLabel(group.categoryLabel, group.category))}</span>
      <span class="lang-links">${languageLinks}</span>
    </div>
    <h2>${escapeHtml(entry.title)}</h2>
    <p>${escapeHtml(entry.description)}</p>
    <div class="card-actions">
      <a class="btn primary" href="skill.html?path=${encodeURIComponent(entry.path)}&lang=${entry.language}">${escapeHtml(strings.open)}</a>
    </div>`;
  return element;
}

async function load() {
  const response = await fetch("skills.json");
  if (!response.ok) throw new Error("Failed to load skills.json");
  const data = await response.json();
  siteTitle = data.title || "";
  siteRepository = data.repository || "";
  siteRef = data.ref || "main";
  applySiteLinks();
  skills = data.skills;
  render();
}

document.querySelectorAll("[data-lang]").forEach((button) => {
  button.addEventListener("click", () => setLang(button.dataset.lang));
});
$("#search").addEventListener("input", render);

load().catch((error) => {
  $("#catalog").innerHTML = `<p class="empty">${escapeHtml(error.message)}</p>`;
});
