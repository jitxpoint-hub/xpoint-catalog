const CATEGORIES = [
  { name: "همه", icon: "X." },
  { name: "لوازم خانگی", icon: "🏠" },
  { name: "یخچال", icon: "▣" },
  { name: "ظرفشویی", icon: "◇" },
  { name: "لباسشویی", icon: "◌" },
  { name: "کالای دیجیتال", icon: "⌘" },
  { name: "موبایل", icon: "📱" },
  { name: "اکسسوری", icon: "🎧" },
  { name: "لپ تاپ", icon: "💻" },
  { name: "گجت", icon: "⚙️" },
  { name: "تلویزیون", icon: "📺" },
  { name: "اسپیکر", icon: "🔊" },
  { name: "تبلت", icon: "▯" },
  { name: "کنسول بازی", icon: "🎮" },
  { name: "شارژر", icon: "⚡" },
  { name: "لوازم خانگی ریز", icon: "✦" }
];

const state = { catalog: [], products: [], category: "همه", brands: new Set(), search: "", sort: "featured" };
const bannerState = { items: [], index: 0, rotationTimer: null, refreshTimer: null };
const el = {
  rail: document.querySelector("#categoryRail"), brandFilters: document.querySelector("#brandFilters"),
  grid: document.querySelector("#productGrid"), template: document.querySelector("#productTemplate"),
  count: document.querySelector("#resultCount"), search: document.querySelector("#searchInput"),
  sort: document.querySelector("#sortSelect"), clear: document.querySelector("#clearFilters"),
  active: document.querySelector("#activeFilters"), loading: document.querySelector("#loadingState"),
  error: document.querySelector("#errorState"), empty: document.querySelector("#emptyState"),
  emptyReset: document.querySelector("#emptyReset")
};
const bannerEl = {
  root: document.querySelector("#driveBanner"), track: document.querySelector("#driveBannerTrack"),
  dots: document.querySelector("#driveBannerDots"), prev: document.querySelector("#bannerPrev"),
  next: document.querySelector("#bannerNext"), controls: document.querySelector(".drive-banner-controls")
};

const faNumber = new Intl.NumberFormat("fa-IR");
const normalize = value => String(value ?? "").trim();
const digitsToEnglish = value => normalize(value).replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d)).replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
const parsePrice = value => Number(digitsToEnglish(value).replace(/[^\d.]/g, "")) || 0;

function parseCsv(text) {
  const rows = []; let row = []; let cell = ""; let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i], next = text[i + 1];
    if (char === '"' && quoted && next === '"') { cell += '"'; i++; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { row.push(cell); cell = ""; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') i++;
      row.push(cell); if (row.some(item => item.trim())) rows.push(row); row = []; cell = "";
    } else cell += char;
  }
  row.push(cell); if (row.some(item => item.trim())) rows.push(row);
  if (!rows.length) return [];
  const headers = rows.shift().map(h => normalize(h).replace(/^\uFEFF/, "").toLowerCase());
  return rows.map(values => Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""])));
}

function pick(row, keys) {
  for (const key of keys) if (row[key] !== undefined && normalize(row[key])) return row[key];
  return "";
}

function normalizeProduct(row, index) {
  const image = pick(row, ["image", "imageurl", "image_url", "photo", "عکس", "تصویر", "لینک عکس", "آدرس تصویر"]);
  return {
    id: pick(row, ["id", "ردیف"]) || String(index + 1),
    name: pick(row, ["name", "product", "productname", "product_name", "نام", "نام محصول"]),
    brand: pick(row, ["brand", "برند"]),
    code: pick(row, ["code", "sku", "productcode", "product_code", "کد", "کد محصول"]),
    price: parsePrice(pick(row, ["price", "cashprice", "cash_price", "قیمت", "قیمت نقد"])),
    category: canonicalCategory(pick(row, ["category", "دسته", "دسته بندی", "دسته‌بندی"])),
    description: pick(row, ["description", "desc", "توضیحات", "شرح"]),
    image: driveImageUrl(image),
    // قیمت، منبع اصلی وضعیت موجودی است: محصول دارای قیمت همیشه موجود است.
    stock: "موجود"
  };
}

function canonicalCategory(value) {
  const compact = normalize(value)
    .replace(/ي/g, "ی").replace(/ك/g, "ک")
    .replace(/[\u200c\s_-]+/g, "")
    .toLocaleLowerCase("fa");
  const aliases = {
    "لوازمخانگی": "لوازم خانگی", "گجتهایخانگی": "گجت",
    "تلویزیون": "تلویزیون", "تلوزیون": "تلویزیون", "اسپیکر": "اسپیکر",
    "کنسولبازی": "کنسول بازی", "لپتاپ": "لپ تاپ", "تبلت": "تبلت",
    "اکسسوری": "اکسسوری", "موبایل": "موبایل", "آرایشیبهداشتی": "لوازم خانگی ریز",
    "شارژر": "شارژر"
  };
  return aliases[compact] || normalize(value);
}

function driveImageUrl(value) {
  const raw = normalize(value);
  if (!raw) return "";
  const idMatch = raw.match(/(?:\/d\/|id=)([-\w]{20,})/) || raw.match(/^[-\w]{20,}$/);
  const id = idMatch ? (idMatch[1] || idMatch[0]) : "";
  return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w1200` : raw;
}

function placeholder(product) {
  const label = (product.category || "X.Point").replace(/[<&>]/g, "");
  const colors = { "موبایل":"#3d566e", "تلویزیون":"#48515a", "لپ‌تاپ":"#6f7880", "اسپیکر":"#31363b", "کنسول بازی":"#5e646b", "تبلت":"#899198", "لوازم خانگی":"#aeb4b8", "گجت‌های خانگی":"#727b82", "اکسسوری":"#949ba0" };
  const color = colors[product.category] || "#737b82";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 520"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f8f8f8"/><stop offset="1" stop-color="#e3e5e6"/></linearGradient><filter id="s"><feDropShadow dx="0" dy="18" stdDeviation="18" flood-opacity=".16"/></filter></defs><rect width="700" height="520" fill="url(#g)"/><path d="M210 120h280c22 0 40 18 40 40v190c0 22-18 40-40 40H210c-22 0-40-18-40-40V160c0-22 18-40 40-40Z" fill="${color}" filter="url(#s)"/><path d="M230 145h240c16 0 30 14 30 30v150c0 16-14 30-30 30H230c-16 0-30-14-30-30V175c0-16 14-30 30-30Z" fill="#f26322" opacity=".9"/><path d="m268 168 164 164M432 168 268 332" stroke="#fff" stroke-width="28" stroke-linecap="round" opacity=".95"/><text x="350" y="460" text-anchor="middle" font-family="Tahoma,Arial" font-size="26" font-weight="700" fill="#596067">${label}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

async function loadProducts() {
  el.loading.hidden = false; el.error.hidden = true;
  const config = window.XPOINT_CONFIG || {};
  try {
    let raw;
    if (normalize(config.googleSheetCsvUrl)) {
      const sourceUrl = `${config.googleSheetCsvUrl}${config.googleSheetCsvUrl.includes("?") ? "&" : "?"}_=${Date.now()}`;
      const response = await fetch(sourceUrl, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      raw = parseCsv(await response.text());
    } else {
      const response = await fetch(config.fallbackDataUrl || "products.sample.json");
      if (!response.ok) throw new Error("فایل داده نمونه در دسترس نیست");
      raw = await response.json();
    }
    // ردیف‌های بدون قیمت یا با قیمت صفر، به‌طور کامل از سایت حذف می‌شوند.
    state.catalog = raw.map(normalizeProduct).filter(p => p.name && p.brand && p.code);
    state.products = state.catalog.filter(p => p.price > 0);
    buildBrandFilters(); render();
  } catch (error) {
    try {
      const fallbackResponse = await fetch(config.fallbackDataUrl || "products.sample.json", { cache: "no-store" });
      if (!fallbackResponse.ok) throw error;
      const fallbackRaw = await fallbackResponse.json();
      state.catalog = fallbackRaw.map(normalizeProduct).filter(p => p.name && p.brand && p.code);
      state.products = state.catalog.filter(p => p.price > 0);
      buildBrandFilters(); render();
      el.error.hidden = true;
    } catch (fallbackError) {
      el.error.hidden = false;
      el.error.textContent = `دریافت فهرست محصولات انجام نشد. تنظیمات منبع داده را بررسی کنید. (${error.message})`;
    }
  } finally { el.loading.hidden = true; }
}

async function loadDriveBanners() {
  const config = window.XPOINT_CONFIG || {};
  const feedUrl = normalize(config.bannerFeedUrl);
  if (!feedUrl) { bannerEl.root.hidden = true; return; }
  try {
    const payload = await requestBannerFeed_(feedUrl);
    const items = Array.isArray(payload) ? payload : payload.banners;
    if (!Array.isArray(items)) throw new Error("فرمت فهرست بنر معتبر نیست");
    bannerState.items = items
      .filter(item => normalize(item.url))
      .map(item => ({ url: driveImageUrl(item.url), name: normalize(item.name) || "بنر X.Point" }));
    renderDriveBanners();
  } catch (error) {
    console.warn("X.Point banner feed:", error.message);
    if (!bannerState.items.length) bannerEl.root.hidden = true;
  }
}

function requestBannerFeed_(feedUrl) {
  return new Promise((resolve, reject) => {
    const callbackName = `__xpointBannerFeed_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const separator = feedUrl.includes("?") ? "&" : "?";
    const script = document.createElement("script");
    const cleanup = () => { delete window[callbackName]; script.remove(); clearTimeout(timeout); };
    const timeout = setTimeout(() => { cleanup(); reject(new Error("زمان دریافت بنرها تمام شد")); }, 12000);
    window[callbackName] = payload => { cleanup(); resolve(payload); };
    script.onerror = () => { cleanup(); reject(new Error("ارتباط با فید بنر برقرار نشد")); };
    script.src = `${feedUrl}${separator}callback=${encodeURIComponent(callbackName)}&v=${Math.floor(Date.now() / 60000)}`;
    document.head.append(script);
  });
}

function renderDriveBanners() {
  clearInterval(bannerState.rotationTimer);
  if (!bannerState.items.length) { bannerEl.root.hidden = true; return; }
  bannerState.index = Math.min(bannerState.index, bannerState.items.length - 1);
  bannerEl.track.replaceChildren(...bannerState.items.map((item, index) => {
    const slide = document.createElement("div"); slide.className = `drive-banner-slide${index === bannerState.index ? " active" : ""}`;
    const image = document.createElement("img"); image.src = item.url; image.alt = item.name; image.loading = index ? "lazy" : "eager";
    image.addEventListener("error", () => slide.remove()); slide.append(image); return slide;
  }));
  bannerEl.dots.replaceChildren(...bannerState.items.map((item, index) => {
    const dot = document.createElement("button"); dot.type = "button"; dot.className = `drive-banner-dot${index === bannerState.index ? " active" : ""}`;
    dot.setAttribute("aria-label", `نمایش بنر ${index + 1}`); dot.addEventListener("click", () => showBanner(index)); return dot;
  }));
  bannerEl.root.hidden = false;
  bannerEl.controls.hidden = bannerState.items.length === 1;
  if (bannerState.items.length > 1 && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    bannerState.rotationTimer = setInterval(() => showBanner(bannerState.index + 1), Number(window.XPOINT_CONFIG?.bannerRotationMs) || 5500);
  }
}

function showBanner(index) {
  if (!bannerState.items.length) return;
  bannerState.index = (index + bannerState.items.length) % bannerState.items.length;
  bannerEl.track.querySelectorAll(".drive-banner-slide").forEach((slide, i) => slide.classList.toggle("active", i === bannerState.index));
  bannerEl.dots.querySelectorAll(".drive-banner-dot").forEach((dot, i) => dot.classList.toggle("active", i === bannerState.index));
}

function buildCategories() {
  el.rail.replaceChildren(...CATEGORIES.map(category => {
    const button = document.createElement("button");
    button.type = "button"; button.className = "category-card"; button.dataset.category = category.name; button.setAttribute("role", "listitem");
    button.innerHTML = `<span class="category-icon" aria-hidden="true">${category.icon}</span><strong>${category.name}</strong>`;
    button.addEventListener("click", () => { state.category = category.name; render(); document.querySelector("#products").scrollIntoView({ behavior: "smooth", block: "start" }); });
    return button;
  }));
}

function buildBrandFilters() {
  const counts = state.catalog.reduce((map, product) => map.set(product.brand, (map.get(product.brand) || 0) + 1), new Map());
  const brands = [...counts.keys()].sort((a,b) => a.localeCompare(b,"fa"));
  el.brandFilters.replaceChildren(...brands.map(brand => {
    const label = document.createElement("label"); label.className = "brand-option";
    const left = document.createElement("span"), input = document.createElement("input"), text = document.createElement("span"), count = document.createElement("i");
    input.type = "checkbox"; input.value = brand; input.checked = state.brands.has(brand); text.textContent = brand; count.textContent = faNumber.format(counts.get(brand));
    input.addEventListener("change", () => { input.checked ? state.brands.add(brand) : state.brands.delete(brand); render(); });
    left.append(input,text); label.append(left,count); return label;
  }));
}

function filteredProducts() {
  const query = state.search.toLocaleLowerCase("fa");
  const groups = {
    "لوازم خانگی": new Set(["لوازم خانگی", "یخچال", "ظرفشویی", "لباسشویی"]),
    "کالای دیجیتال": new Set(["کالای دیجیتال", "موبایل", "لپ تاپ", "اکسسوری", "گجت", "گجت های خانگی", "اسپیکر", "تبلت", "کنسول بازی", "شارژر"])
  };
  const items = state.products.filter(product => {
    const categoryOk = state.category === "همه" || (groups[state.category] ? groups[state.category].has(product.category) : product.category === state.category);
    const brandOk = !state.brands.size || state.brands.has(product.brand);
    const haystack = `${product.name} ${product.brand} ${product.code}`.toLocaleLowerCase("fa");
    return categoryOk && brandOk && (!query || haystack.includes(query));
  });
  return items.sort((a,b) => {
    if (state.sort === "price-asc") return a.price - b.price;
    if (state.sort === "price-desc") return b.price - a.price;
    if (state.sort === "name") return a.name.localeCompare(b.name,"fa");
    return Number(a.id) - Number(b.id);
  });
}

function render() {
  document.querySelectorAll(".category-card").forEach(button => button.classList.toggle("active", button.dataset.category === state.category));
  document.querySelectorAll(".brand-option input").forEach(input => input.checked = state.brands.has(input.value));
  const products = filteredProducts();
  el.count.textContent = `${faNumber.format(products.length)} کالا`;
  el.grid.replaceChildren(...products.map(productCard));
  el.grid.hidden = !products.length; el.empty.hidden = !!products.length;
  renderActiveFilters();
}

function productCard(product) {
  const fragment = el.template.content.cloneNode(true), card = fragment.querySelector(".product-card"), image = fragment.querySelector(".product-image");
  image.src = product.image || placeholder(product); image.alt = `تصویر ${product.name}`;
  image.addEventListener("error", () => { image.src = placeholder(product); }, { once: true });
  fragment.querySelector(".product-brand").textContent = product.brand;
  fragment.querySelector(".product-code").textContent = `کد ${product.code}`;
  fragment.querySelector(".product-name").textContent = product.name;
  fragment.querySelector(".product-category").textContent = product.category || "";
  const price = fragment.querySelector(".product-price");
  price.innerHTML = product.price ? `${faNumber.format(product.price)} <small>${window.XPOINT_CONFIG?.currencyLabel || "تومان"}</small>` : `<small>برای دریافت قیمت تماس بگیرید</small>`;
  const stock = fragment.querySelector(".stock-badge"), isOut = /ناموجود|out/i.test(product.stock);
  stock.textContent = isOut ? "ناموجود" : product.stock; stock.classList.toggle("out", isOut);
  card.addEventListener("click", () => openProductModal(product));
  card.dataset.code = product.code; return fragment;
}

function openProductModal(product) {
  const modal = document.querySelector("#productModal");
  const image = document.querySelector("#modalProductImage");
  image.src = product.image || placeholder(product); image.alt = `تصویر ${product.name}`;
  image.onerror = () => { image.src = placeholder(product); };
  document.querySelector("#modalProductCategory").textContent = product.category || "X.Point";
  document.querySelector("#modalProductName").textContent = product.name;
  document.querySelector("#modalProductDescription").textContent = product.description || `محصول ${product.brand} در دسته ${product.category || "محصولات دیجیتال"}.`;
  document.querySelector("#modalProductBrand").textContent = product.brand;
  document.querySelector("#modalProductCode").textContent = product.code;
  document.querySelector("#modalProductStock").textContent = product.stock || "موجود";
  document.querySelector("#modalProductPrice").innerHTML = product.price ? `${faNumber.format(product.price)} <small>${window.XPOINT_CONFIG?.currencyLabel || "تومان"}</small>` : "تماس بگیرید";
  modal.showModal();
}

document.querySelector("#modalClose").addEventListener("click", () => document.querySelector("#productModal").close());
document.querySelector("#productModal").addEventListener("click", event => { if (event.target.id === "productModal") event.target.close(); });

function renderActiveFilters() {
  const chips = [];
  if (state.category !== "همه") chips.push(chip(state.category, () => { state.category = "همه"; render(); }));
  state.brands.forEach(brand => chips.push(chip(brand, () => { state.brands.delete(brand); render(); })));
  if (state.search) chips.push(chip(`جستجو: ${state.search}`, () => { state.search = ""; el.search.value = ""; render(); }));
  el.active.replaceChildren(...chips);
}

function chip(label, remove) {
  const node = document.createElement("span"); node.className = "filter-chip";
  const text = document.createElement("span"), close = document.createElement("button");
  text.textContent = label; close.type = "button"; close.textContent = "×"; close.setAttribute("aria-label", `حذف فیلتر ${label}`); close.addEventListener("click", remove); node.append(text,close); return node;
}

function resetAll() { state.category = "همه"; state.brands.clear(); state.search = ""; state.sort = "featured"; el.search.value = ""; el.sort.value = "featured"; render(); }

let searchTimer;
el.search.addEventListener("input", event => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { state.search = normalize(event.target.value); render(); }, 180); });
el.sort.addEventListener("change", event => { state.sort = event.target.value; render(); });
el.clear.addEventListener("click", resetAll); el.emptyReset.addEventListener("click", resetAll);
document.querySelectorAll("[data-scroll-products]").forEach(button => button.addEventListener("click", () => document.querySelector("#products").scrollIntoView({ behavior: "smooth" })));
bannerEl.prev.addEventListener("click", () => showBanner(bannerState.index - 1));
bannerEl.next.addEventListener("click", () => showBanner(bannerState.index + 1));

buildCategories(); loadProducts(); loadDriveBanners();
// همگام‌سازی خودکار فهرست محصولات هر ۴ ساعت، حتی وقتی صفحه باز بماند.
setInterval(loadProducts, 4 * 60 * 60 * 1000);
bannerState.refreshTimer = setInterval(loadDriveBanners, Number(window.XPOINT_CONFIG?.bannerRefreshMs) || 300000);
