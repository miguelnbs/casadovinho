const data = window.WINE_DATA || { countries: [], wines: [], regionMedia: [] };

const state = {
  country: "Todos",
  type: "Todos",
  query: "",
};

const countryAccents = {
  Portugal: "#1f6b53",
  Chile: "#a63734",
  Argentina: "#3f7f9f",
  Itália: "#758a3a",
  França: "#865d30",
};

const els = {
  totalWines: document.querySelector("#total-wines"),
  totalCountries: document.querySelector("#total-countries"),
  countryFilters: document.querySelector("#country-filters"),
  typeFilters: document.querySelector("#type-filters"),
  searchInput: document.querySelector("#search-input"),
  sections: document.querySelector("#wine-sections"),
  summary: document.querySelector("#result-summary"),
  backToTop: document.querySelector("#back-to-top"),
  dialog: document.querySelector("#wine-dialog"),
  dialogClose: document.querySelector("#dialog-close"),
  dialogImageLink: document.querySelector("#dialog-image-link"),
  dialogMainImage: document.querySelector("#dialog-main-image"),
  dialogThumbs: document.querySelector("#dialog-thumbs"),
  dialogMeta: document.querySelector("#dialog-meta"),
  dialogTitle: document.querySelector("#dialog-title"),
  dialogVariant: document.querySelector("#dialog-variant"),
  dialogFacts: document.querySelector("#dialog-facts"),
  dialogDetails: document.querySelector("#dialog-details"),
};

const winesById = new Map(data.wines.map((wine) => [wine.id, wine]));
const wineImageRoles = new Set(["garrafa"]);

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function uniqueTypes() {
  const order = ["Tinto", "Branco", "Rosé"];
  const found = new Set(data.wines.map((wine) => wine.type).filter(Boolean));
  return order.filter((type) => found.has(type)).concat(
    [...found].filter((type) => !order.includes(type)).sort()
  );
}

function createButton(label, active, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "filter-btn";
  button.textContent = label;
  button.setAttribute("aria-pressed", String(active));
  button.addEventListener("click", onClick);
  return button;
}

function renderFilters() {
  els.countryFilters.replaceChildren(
    createButton("Todos", state.country === "Todos", () => {
      state.country = "Todos";
      render();
    }),
    ...data.countries.map((country) =>
      createButton(country, state.country === country, () => {
        state.country = country;
        render();
      })
    )
  );

  const types = uniqueTypes();
  els.typeFilters.replaceChildren(
    createButton("Todos os tipos", state.type === "Todos", () => {
      state.type = "Todos";
      render();
    }),
    ...types.map((type) =>
      createButton(type, state.type === type, () => {
        state.type = type;
        render();
      })
    )
  );
}

function wineMatches(wine) {
  const haystack = normalize(
    [
      wine.name,
      wine.variant,
      wine.country,
      wine.type,
      wine.grapes,
      wine.producer,
      wine.temperature,
      wine.rawText,
    ].join(" ")
  );

  const countryOk = state.country === "Todos" || wine.country === state.country;
  const typeOk = state.type === "Todos" || wine.type === state.type;
  const queryOk = !state.query || haystack.includes(normalize(state.query));

  return countryOk && typeOk && queryOk;
}

function compact(value, limit = 128) {
  if (!value) return "";
  return value.length > limit ? `${value.slice(0, limit - 1)}...` : value;
}

function detailValue(wine, label) {
  return wine.details?.find((detail) => detail.label === label)?.value || "";
}

function winePreview(wine) {
  return (
    detailValue(wine, "Notas de Prova") ||
    detailValue(wine, "Sobre o vinho") ||
    detailValue(wine, "Descrição") ||
    detailValue(wine, "Vinificação") ||
    detailValue(wine, "Estágio") ||
    ""
  );
}

function makeHighlight(label, value, wide = false) {
  if (!value) return null;
  const item = document.createElement("div");
  item.className = wide ? "card-highlight card-highlight--wide" : "card-highlight";
  const small = document.createElement("span");
  const strong = document.createElement("strong");
  small.textContent = label;
  strong.textContent = value;
  item.append(small, strong);
  return item;
}

function imageAlt(prefix, image) {
  return `${prefix} - ${image.role || "imagem"}`;
}

function imageRatio(image) {
  return image?.width && image?.height ? image.width / image.height : 1;
}

function isBottleLikeImage(image) {
  return wineImageRoles.has(image?.role) || imageRatio(image) <= 0.42;
}

function imagePriority(image) {
  if (!image) return 0;
  if (wineImageRoles.has(image.role)) return 5;
  if (image.role === "imagem do PDF" && isBottleLikeImage(image)) return 4;
  if (image.role === "imagem do PDF") return 3;
  if (image.role === "selo ou icone") return 2;
  if (image.role === "faixa ou logotipo") return 1;
  return 0;
}

function imageKind(image) {
  const ratio = imageRatio(image);
  if (isBottleLikeImage(image)) return "bottle";
  if (ratio >= 1.35) return "wide";
  if (ratio <= 0.75) return "tall";
  return "standard";
}

function getPrimaryImage(wine) {
  const images = wine.images || [];
  const savedPrimary = images.find((image) => image.src === wine.primaryImage);
  const bestImage = images
    .slice()
    .sort((a, b) => imagePriority(b) - imagePriority(a))[0];

  if (!savedPrimary) return bestImage || images[0] || null;
  if (!bestImage) return savedPrimary;
  return imagePriority(bestImage) >= 4 && imagePriority(bestImage) > imagePriority(savedPrimary)
    ? bestImage
    : savedPrimary;
}

function getDialogImages(wine) {
  const images = wine.images || [];
  const primary = getPrimaryImage(wine);
  if (!primary) return [];
  return [primary, ...images.filter((image) => image.src !== primary.src)];
}

function makeImage(src, alt, loading = "lazy") {
  const img = document.createElement("img");
  img.src = src;
  img.alt = alt;
  img.loading = loading;
  img.decoding = "async";
  return img;
}

function makeImageGallery(images, altPrefix) {
  const gallery = document.createElement("div");
  gallery.className = "image-gallery";

  images.forEach((image) => {
    const figure = document.createElement("figure");
    figure.className = "image-thumb";
    figure.title = `${image.role} - ${image.width}x${image.height}`;
    figure.append(makeImage(image.src, imageAlt(altPrefix, image)));

    const caption = document.createElement("figcaption");
    caption.textContent = image.role;
    figure.append(caption);
    gallery.append(figure);
  });

  return gallery;
}

function makePill(text, accent = false) {
  const span = document.createElement("span");
  span.className = accent ? "pill pill--accent" : "pill";
  span.textContent = text;
  return span;
}

function makeFact(term, value) {
  if (!value) return null;
  const item = document.createElement("div");
  const dt = document.createElement("dt");
  const dd = document.createElement("dd");
  dt.textContent = term;
  dd.textContent = value;
  item.append(dt, dd);
  return item;
}

function makeActionButton(wine) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "card-action";
  button.dataset.wineId = wine.id;
  button.textContent = "Ver ficha completa";
  return button;
}

function makeCard(wine) {
  const article = document.createElement("article");
  article.className = "wine-card";
  article.style.setProperty("--accent", countryAccents[wine.country] || "#7c1f31");

  const body = document.createElement("div");
  body.className = "wine-card__body";
  const primaryImage = getPrimaryImage(wine);

  if (primaryImage) {
    const media = document.createElement("div");
    media.className = "wine-card__image";
    media.dataset.imageKind = imageKind(primaryImage);
    media.append(makeImage(primaryImage.src, `Imagem do vinho ${wine.name}`, "eager"));
    body.append(media);
  }

  const meta = document.createElement("div");
  meta.className = "wine-card__meta";
  meta.append(makePill(wine.country, true));
  if (wine.type) meta.append(makePill(wine.type));

  const title = document.createElement("h3");
  title.textContent = wine.name;

  body.append(meta, title);

  if (wine.variant) {
    const variant = document.createElement("p");
    variant.className = "variant";
    variant.textContent = wine.variant;
    body.append(variant);
  }

  const highlights = document.createElement("div");
  highlights.className = "card-highlights";
  [
    makeHighlight("Uvas", compact(wine.grapes, 120), true),
    makeHighlight("Produtor / região", compact(wine.producer, 110), true),
    makeHighlight("Temperatura", wine.temperature),
  ]
    .filter(Boolean)
    .forEach((item) => highlights.append(item));
  body.append(highlights);

  const previewText = compact(winePreview(wine), 210);
  if (previewText) {
    const preview = document.createElement("p");
    preview.className = "card-preview";
    preview.textContent = previewText;
    body.append(preview);
  }

  body.append(makeActionButton(wine));

  article.append(body);
  return article;
}

function selectDialogImage(wine, image) {
  if (!image) {
    els.dialogImageLink.removeAttribute("href");
    els.dialogImageLink.setAttribute("aria-disabled", "true");
    els.dialogMainImage.removeAttribute("src");
    els.dialogMainImage.removeAttribute("width");
    els.dialogMainImage.removeAttribute("height");
    els.dialogMainImage.alt = "";
    return;
  }

  els.dialogImageLink.href = image.src;
  els.dialogImageLink.removeAttribute("aria-disabled");
  els.dialogImageLink.dataset.imageKind = imageKind(image);
  els.dialogMainImage.src = image.src;
  els.dialogMainImage.alt = imageAlt(wine.name, image);
  if (image.width && image.height) {
    els.dialogMainImage.width = image.width;
    els.dialogMainImage.height = image.height;
  } else {
    els.dialogMainImage.removeAttribute("width");
    els.dialogMainImage.removeAttribute("height");
  }
  [...els.dialogThumbs.querySelectorAll("button")].forEach((button) => {
    button.setAttribute("aria-current", String(button.dataset.src === image.src));
  });
}

function openDialogElement() {
  if (typeof els.dialog.showModal === "function") {
    if (!els.dialog.open) els.dialog.showModal();
  } else {
    els.dialog.classList.add("wine-dialog--fallback");
    els.dialog.setAttribute("open", "");
    document.body.classList.add("is-dialog-fallback-open");
  }
  document.body.classList.add("is-dialog-open");
}

function closeDialogElement() {
  if (typeof els.dialog.close === "function" && els.dialog.open) {
    els.dialog.close();
  } else {
    els.dialog.removeAttribute("open");
  }
  els.dialog.classList.remove("wine-dialog--fallback");
  document.body.classList.remove("is-dialog-open", "is-dialog-fallback-open");
}

function addDialogDetail(detail) {
  const section = document.createElement("section");
  const heading = document.createElement("h3");
  const text = document.createElement("p");
  heading.textContent = detail.label;
  text.textContent = detail.value;
  section.append(heading, text);
  return section;
}

function openWineDialog(wine) {
  const images = getDialogImages(wine);
  const primary = images[0];

  els.dialog.style.setProperty("--accent", countryAccents[wine.country] || "#7c1f31");
  els.dialogMeta.replaceChildren();
  els.dialogMeta.append(makePill(wine.country, true));
  if (wine.type) els.dialogMeta.append(makePill(wine.type));

  els.dialogTitle.textContent = wine.name;
  els.dialogVariant.textContent = wine.variant || "";
  els.dialogVariant.hidden = !wine.variant;

  els.dialogFacts.replaceChildren(
    ...[
      makeFact("Uvas", wine.grapes),
      makeFact("Produtor / região", wine.producer),
      makeFact("Temperatura", wine.temperature),
    ].filter(Boolean)
  );

  els.dialogDetails.replaceChildren();
  const details = wine.details?.length
    ? wine.details
    : wine.rawText.split("\n").map((line) => ({ label: "Detalhe", value: line }));
  details.forEach((detail) => {
    els.dialogDetails.append(addDialogDetail(detail));
  });

  els.dialogThumbs.replaceChildren();
  images.forEach((image, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "dialog-thumb";
    button.dataset.src = image.src;
    button.title = `${image.role} - ${image.width}x${image.height}`;
    button.setAttribute("aria-label", `Selecionar ${image.role || "imagem"} de ${wine.name}`);
    button.dataset.imageKind = imageKind(image);
    button.append(makeImage(image.src, imageAlt(wine.name, image)));
    button.addEventListener("click", () => selectDialogImage(wine, image));
    if (index === 0) button.setAttribute("aria-label", "Imagem principal");
    els.dialogThumbs.append(button);
  });

  selectDialogImage(wine, primary);
  if (typeof els.dialogThumbs.scrollTo === "function") {
    els.dialogThumbs.scrollTo({ left: 0, top: 0 });
  } else {
    els.dialogThumbs.scrollLeft = 0;
    els.dialogThumbs.scrollTop = 0;
  }
  openDialogElement();
}

function renderSections(wines) {
  els.sections.replaceChildren();

  if (!wines.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Nenhum vinho encontrado para os filtros selecionados.";
    els.sections.append(empty);
    return;
  }

  data.countries.forEach((country) => {
    const countryWines = wines.filter((wine) => wine.country === country);
    if (!countryWines.length) return;

    const section = document.createElement("section");
    section.className = "country-section";
    section.id = `pais-${normalize(country).replace(/[^a-z0-9]+/g, "-")}`;

    const inner = document.createElement("div");
    inner.className = "country-inner";

    const heading = document.createElement("div");
    heading.className = "country-heading";

    const h2 = document.createElement("h2");
    h2.textContent = country;
    h2.style.color = countryAccents[country] || "#7c1f31";

    const count = document.createElement("span");
    count.textContent = `${countryWines.length} ${countryWines.length === 1 ? "vinho" : "vinhos"}`;
    heading.append(h2, count);

    const grid = document.createElement("div");
    grid.className = "wine-grid";
    countryWines.forEach((wine) => grid.append(makeCard(wine)));

    inner.append(heading);
    inner.append(grid);
    section.append(inner);
    els.sections.append(section);
  });
}

function handleCardClick(event) {
  const button = event.target.closest(".card-action");
  if (!button) return;
  const wine = winesById.get(button.dataset.wineId);
  if (wine) openWineDialog(wine);
}

function renderSummary(wines) {
  const parts = [`${wines.length} ${wines.length === 1 ? "vinho encontrado" : "vinhos encontrados"}`];
  if (state.country !== "Todos") parts.push(state.country);
  if (state.type !== "Todos") parts.push(state.type);
  if (state.query) parts.push(`"${state.query}"`);
  els.summary.textContent = parts.join(" · ");
}

function render() {
  renderFilters();
  const wines = data.wines.filter(wineMatches);
  renderSummary(wines);
  renderSections(wines);
}

els.searchInput.addEventListener("input", (event) => {
  state.query = event.target.value.trim();
  render();
});

els.backToTop.addEventListener("click", (event) => {
  event.preventDefault();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

els.sections.addEventListener("click", handleCardClick);

els.dialogClose.addEventListener("click", closeDialogElement);

els.dialog.addEventListener("click", (event) => {
  if (event.target === els.dialog) {
    closeDialogElement();
  }
});

els.dialog.addEventListener("close", () => {
  document.body.classList.remove("is-dialog-open", "is-dialog-fallback-open");
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && els.dialog.hasAttribute("open")) {
    closeDialogElement();
  }
});

els.totalWines.textContent = String(data.wines.length);
els.totalCountries.textContent = String(data.countries.length);

render();
