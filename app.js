const CATEGORY_GROUPS = [
  { name: "همه", icon: "X.", description: "تمام محصولات موجود کاتالوگ", image: "assets/category-all.jpg", imageCategories: [], children: [] },
  { name: "لوازم خانگی", icon: "🏠", description: "یخچال، لباسشویی و ظرفشویی", image: "assets/category-home.jpg", imageCategories: ["یخچال", "لباسشویی", "ظرفشویی", "لوازم خانگی"], children: ["یخچال", "ظرفشویی", "لباسشویی"] },
  { name: "کالای دیجیتال", icon: "⌘", description: "موبایل، لپ‌تاپ، گجت و اکسسوری", image: "assets/category-digital.jpg", imageCategories: ["لپ تاپ", "موبایل", "کنسول بازی", "تبلت", "کالای دیجیتال"], children: ["موبایل", "لپ تاپ", "اکسسوری", "گجت", "اسپیکر", "تبلت", "کنسول بازی", "شارژر"] },
  { name: "تلویزیون", icon: "📺", description: "انواع تلویزیون از برندهای معتبر", image: "assets/category-tv.jpg", imageCategories: ["تلویزیون"], children: [] },
  { name: "گجت خانگی", icon: "✦", description: "گجت‌ها و ابزارهای هوشمند و کاربردی خانه", image: "assets/category-small-home.jpg", imageCategories: ["گجت خانگی", "لوازم خانگی ریز", "گجت", "گجت های خانگی"], children: [] }
];

const SUBCATEGORY_ICONS = {
  "یخچال": "fridge", "ظرفشویی": "dishwasher", "لباسشویی": "washer",
  "موبایل": "phone", "لپ تاپ": "laptop", "اکسسوری": "headphones",
  "گجت": "watch", "اسپیکر": "speaker", "تبلت": "tablet",
  "کنسول بازی": "gamepad", "شارژر": "charger", "تلویزیون": "tv",
  "نظافت خانه": "vacuum", "آشپزخانه و پخت‌وپز": "cooking", "قهوه و نوشیدنی": "coffee",
  "تهویه و هوای خانه": "air", "سلامت و ابزارهای هوشمند": "health",
  "ساعت و مچ‌بند هوشمند": "watch", "هدفون و هندزفری": "headphones"
};

const state = { catalog: [], products: [], category: "همه", brands: new Set(), search: "", sort: "featured" };
let categoryNodes = new Map();
const bannerState = { items: [], index: 0, rotationTimer: null, refreshTimer: null };
const el = {
  rail: document.querySelector("#categoryRail"), subrail: document.querySelector("#subcategoryRail"), brandFilters: document.querySelector("#brandFilters"),
  brandContext: document.querySelector("#brandFilterContext"),
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

function splitMediaList(value) {
  return normalize(value).split(/[|\n]+/).map(item => item.trim()).filter(Boolean);
}

function normalizeMediaUrl(value) {
  const raw = normalize(value);
  if (!raw || !/^https?:\/\//i.test(raw)) return "";
  const drive = raw.match(/drive\.google\.com\/file\/d\/([^/]+)/i);
  if (drive) return `https://drive.google.com/file/d/${drive[1]}/preview`;
  const youtube = raw.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{6,})/i);
  if (youtube) return `https://www.youtube-nocookie.com/embed/${youtube[1]}`;
  const aparat = raw.match(/aparat\.com\/v\/([\w-]+)/i);
  if (aparat) return `https://www.aparat.com/video/video/embed/videohash/${aparat[1]}/vt/frame`;
  return raw;
}

function normalizeProduct(row, index) {
  const image = pick(row, ["image", "imageurl", "image_url", "photo", "عکس", "تصویر", "عکس اصلی", "تصویر اصلی", "لینک عکس", "آدرس تصویر"]);
  const listedImages = splitMediaList(pick(row, ["images", "gallery", "تصاویر", "تصاویر بیشتر", "عکس‌های بیشتر", "عکس های بیشتر", "گالری عکس", "لینک گالری"]));
  const extraImages = [1, 2, 3, 4, 5, 6].map(number => pick(row, [`image${number}`, `image_${number}`, `عکس ${number}`, `تصویر ${number}`]));
  const images = [image, ...listedImages, ...extraImages].map(driveImageUrl).filter((url, position, all) => url && all.indexOf(url) === position);
  const product = {
    id: pick(row, ["id", "ردیف"]) || String(index + 1),
    name: pick(row, ["name", "product", "productname", "product_name", "نام", "نام محصول"]),
    brand: pick(row, ["brand", "برند"]),
    code: pick(row, ["code", "sku", "productcode", "product_code", "کد", "کد محصول"]),
    price: parsePrice(pick(row, ["price", "cashprice", "cash_price", "قیمت", "قیمت نقد"])),
    category: canonicalCategory(pick(row, ["category", "دسته", "دسته بندی", "دسته‌بندی"])),
    group: canonicalCategory(pick(row, ["group", "گروه اصلی"])),
    subcategory: normalize(pick(row, ["subcategory", "زیرمجموعه", "زیر دسته", "زیر‌دسته", "زیر دسته‌بندی"])),
    description: pick(row, ["description", "desc", "توضیحات", "شرح"]),
    image: images[0] || "",
    images,
    video: normalizeMediaUrl(pick(row, ["video", "videourl", "video_url", "ویدئو", "ویدیو", "فیلم", "ویدئوی محصول", "ویدیوی محصول", "لینک ویدئو", "لینک ویدیو"])),
    view360: normalizeMediaUrl(pick(row, ["360", "3d", "view360", "model3d", "مدل", "مدل سه بعدی", "مدل سه‌بعدی", "لینک مدل", "لینک مدل سه بعدی", "لینک مدل سه‌بعدی", "لینک سه بعدی", "نمای ۳۶۰", "نمای 360"])),
    // قیمت، منبع اصلی وضعیت موجودی است: محصول دارای قیمت همیشه موجود است.
    stock: "موجود"
  };
  if (product.category === "یخچال و فریزر") {
    product.category = /لباسشویی/.test(`${product.name} ${product.group}`) ? "لباسشویی" : "یخچال";
  }
  return product;
}

function applyMediaEnhancements(products) {
  if (!products.length) return;
  const previewCode = "1103961018";
  let product = products.find(item => item.code === previewCode);
  if (!product && window.location?.hostname === "127.0.0.1") {
    const catalogProduct = state.catalog.find(item => item.code === previewCode);
    product = {
      ...(catalogProduct || {}),
      id: catalogProduct?.id || "preview-iphone-17-mist-blue",
      name: catalogProduct?.name || "iPhone 17 256GB CH/A Non Active Mist Blue",
      brand: catalogProduct?.brand || "اپل",
      code: previewCode,
      price: 364527000,
      category: "موبایل",
      group: "کالای دیجیتال",
      subcategory: "موبایل",
      stock: "موجود"
    };
    products.unshift(product);
  }
  // دارایی محلی فقط برای داده‌های قدیمیِ فاقد هرگونه رسانه استفاده می‌شود.
  // در حالت عادی عکس، ویدئو و مدل مستقیماً از شیت خوانده می‌شوند.
  if (product && !product.images?.length && !product.video && !product.view360) {
    product.image = "assets/iphone-17-mist-blue-01.webp";
    product.images = [
      "assets/iphone-17-mist-blue-01.webp",
      "assets/iphone-17-mist-blue-02.webp",
      "assets/iphone-17-gallery-03.webp",
      "assets/iphone-17-gallery-04.webp",
      "assets/iphone-17-black.webp",
      "assets/iphone-17-white.webp",
      "assets/iphone-17-sage.webp",
      "assets/iphone-17-lavender.webp"
    ];
    product.video = "assets/iphone-17-mist-blue.webm";
    product.view360 = "assets/demo-product-360.html";
    product.description = "آیفون ۱۷ با حافظه داخلی ۲۵۶ گیگابایت و رنگ Mist Blue، برای استفاده روزمره، عکاسی و اجرای روان برنامه‌ها طراحی شده است. نسخه CH/A این محصول به‌صورت Non Active عرضه می‌شود.\n• حافظه داخلی ۲۵۶ گیگابایت\n• رنگ Mist Blue\n• پارت‌نامبر CH/A\n• وضعیت فعال‌سازی Non Active\n• گالری تصاویر شامل نماهای مختلف و رنگ‌بندی محصول";
  }

  const speaker = products.find(item => item.code === "1001619");
  if (speaker && !speaker.images?.length && !speaker.video && !speaker.view360) {
    const mainPhoto = "https://drive.google.com/file/d/10BIP0fYBZIiQ2Xfj7Xoh3EVkqci7kp_e/view?usp=drive_link";
    const galleryPhotos = [
      "https://drive.google.com/open?id=13BO0iE7WizilDm3kHJ9JeyJpKUbsV4G1&usp=drive_copy",
      "https://drive.google.com/open?id=1RDegl5BY5grcABygQ6zoaCFWN0qM58hI&usp=drive_copy",
      "https://drive.google.com/open?id=1hE_agVb5Xfw-7K_I-_-6bwtVTsi7-3Ms&usp=drive_copy"
    ];
    speaker.image = driveImageUrl(mainPhoto);
    speaker.images = [speaker.image, ...galleryPhotos.map(driveImageUrl).filter(Boolean)];
    speaker.video = normalizeMediaUrl("https://drive.google.com/file/d/1B0jGnzpsf7so8TBpi9w8tXAOgGL9w7A3/view?usp=drive_link");
    speaker.view360 = normalizeMediaUrl("https://drive.google.com/file/d/1FNYJPnjSpC1j12lCnUUwQKXsGGMH1uzC/view?usp=drive_link");
    if (!speaker.description) speaker.description = "اسپیکر قابل‌حمل JBL PartyBox 520 برای مهمانی و دورهمی طراحی شده است و بدنه مقاوم، چرخ و دسته تلسکوپی، پنل کنترل کامل و نورپردازی هماهنگ با موسیقی دارد.\n• توان صوتی مناسب فضاهای بزرگ\n• اتصال بی‌سیم و ورودی میکروفون\n• چرخ و دسته برای جابه‌جایی آسان\n• پنل کنترل صدا، باس، تریبل و اکو\n• نورپردازی چندرنگ در پنل جلویی";
  }
}

function canonicalCategory(value) {
  const compact = normalize(value)
    .replace(/ي/g, "ی").replace(/ك/g, "ک")
    .replace(/[\u200c\s_-]+/g, "")
    .toLocaleLowerCase("fa");
  const aliases = {
    "لوازمخانگی": "لوازم خانگی", "گجتهایخانگی": "گجت خانگی", "لوازمخانگیریز": "گجت خانگی", "گجتخانگی": "گجت خانگی",
    "تلویزیون": "تلویزیون", "تلوزیون": "تلویزیون", "اسپیکر": "اسپیکر",
    "کنسولبازی": "کنسول بازی", "لپتاپ": "لپ تاپ", "تبلت": "تبلت",
    "اکسسوری": "اکسسوری", "موبایل": "موبایل", "آرایشیبهداشتی": "اکسسوری",
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
    applyMediaEnhancements(state.products);
    buildCategories(); buildBrandFilters(); render();
  } catch (error) {
    try {
      const fallbackResponse = await fetch(config.fallbackDataUrl || "products.sample.json", { cache: "no-store" });
      if (!fallbackResponse.ok) throw error;
      const fallbackRaw = await fallbackResponse.json();
      state.catalog = fallbackRaw.map(normalizeProduct).filter(p => p.name && p.brand && p.code);
      state.products = state.catalog.filter(p => p.price > 0);
      applyMediaEnhancements(state.products);
      buildCategories(); buildBrandFilters(); render();
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
  categoryNodes = window.XPointCategoryTree.build(CATEGORY_GROUPS, state.catalog, baseProductsForCategory);
  if (!categoryNodes.has(state.category)) state.category = "همه";
  el.rail.replaceChildren(...CATEGORY_GROUPS.map((category, index) => {
    const hasChildren = category.name !== "همه" && categoryNodes.get(category.name).children.length > 0;
    const button = document.createElement("button");
    button.type = "button"; button.className = "category-card"; button.dataset.category = category.name;
    const visual = document.createElement("span"), image = document.createElement("img"), shade = document.createElement("span");
    const content = document.createElement("span"), number = document.createElement("span"), title = document.createElement("strong"), description = document.createElement("small"), action = document.createElement("span"), count = document.createElement("span");
    visual.className = "category-visual"; shade.className = "category-shade"; content.className = "category-content"; number.className = "category-number"; action.className = "category-action";
    const representative = category.image || categoryRepresentativeImage(category);
    image.src = representative; image.alt = ""; image.loading = "lazy"; image.addEventListener("error", () => { image.src = placeholder({ category: category.name }); }, { once: true });
    const categoryCount = productsForCategory(category.name).length;
    number.textContent = faNumber.format(index + 1).padStart(2, "۰"); title.textContent = category.name; description.textContent = category.description;
    count.className = "category-count"; count.textContent = `${faNumber.format(categoryCount)} کالا`;
    action.innerHTML = `<span>${hasChildren ? "مشاهده زیرمجموعه‌ها" : "مشاهده محصولات"}</span><b aria-hidden="true">←</b>`;
    visual.append(image, shade); content.append(number, title, description, count, action); button.append(visual, content);
    if (hasChildren) button.setAttribute("aria-controls", "subcategoryRail");
    button.addEventListener("click", () => {
      selectCategory(category.name);
      scrollCategorySelection();
    });
    return button;
  }));
  renderSubcategories();
}

function categoryRepresentativeImage(category) {
  const preferences = category.imageCategories || [];
  for (const preferredCategory of preferences) {
    const product = state.catalog.find(item => item.category === preferredCategory && item.image);
    if (product) return product.image;
  }
  return state.catalog.find(item => item.image)?.image || placeholder({ category: category.name });
}

function renderSubcategories() {
  if (!el.subrail) return;
  const selected = categoryNodes.get(state.category);
  const group = selected?.children.length ? selected : categoryNodes.get(selected?.parent);
  if (state.category === "همه" || !group?.children.length) { el.subrail.hidden = true; el.subrail.replaceChildren(); return; }

  const breadcrumbs = document.createElement("nav"); breadcrumbs.className = "category-breadcrumbs"; breadcrumbs.setAttribute("aria-label", "مسیر دسته‌بندی");
  categoryPath(group.id).forEach((node, index, path) => {
    const button = document.createElement("button"); button.type = "button"; button.textContent = node.label;
    if (index === path.length - 1) button.setAttribute("aria-current", "location");
    button.addEventListener("click", () => { selectCategory(node.id); scrollCategorySelection(); });
    breadcrumbs.append(button);
    if (index < path.length - 1) { const divider = document.createElement("span"); divider.textContent = "‹"; divider.setAttribute("aria-hidden", "true"); breadcrumbs.append(divider); }
  });

  const header = document.createElement("div"); header.className = "subcategory-head";
  const headingCopy = document.createElement("div"), eyebrow = document.createElement("span"), title = document.createElement("strong"), hint = document.createElement("small");
  eyebrow.textContent = "انتخاب دقیق‌تر"; title.textContent = `زیرمجموعه‌های ${group.label}`; title.tabIndex = -1; title.id = "subcategoryTitle";
  hint.textContent = "نوع کالا را انتخاب کنید؛ از مسیر بالا به دستهٔ قبلی برگردید.";
  headingCopy.append(eyebrow, title, hint); header.append(headingCopy);

  const grid = document.createElement("div"); grid.className = "subcategory-grid";
  const options = [{ name: group.id, label: `همه ${group.label}`, all: true }, ...group.children.map(id => ({ name: id, label: categoryNodes.get(id).label, all: false }))];
  grid.replaceChildren(...options.map(option => {
    const name = option.name;
    const button = document.createElement("button");
    const icon = document.createElement("span"), copy = document.createElement("span"), label = document.createElement("strong"), count = document.createElement("small"), arrow = document.createElement("b");
    button.type = "button"; button.className = `subcategory-card${option.all ? " subcategory-all" : ""}`; button.dataset.category = name;
    const node = categoryNodes.get(name), hasChildren = !option.all && node.children.length > 0;
    const productCount = productsForCategory(name).length;
    const inheritedIcon = categoryPath(name).reverse().map(item => SUBCATEGORY_ICONS[item.label]).find(Boolean);
    icon.className = "subcategory-icon"; icon.innerHTML = subcategoryIcon(option.all ? "grid" : inheritedIcon); icon.setAttribute("aria-hidden", "true");
    copy.className = "subcategory-copy"; label.textContent = option.label;
    count.textContent = productCount ? `${faNumber.format(productCount)} کالای موجود` : "فعلاً ناموجود";
    if (hasChildren) count.textContent += ` · ${faNumber.format(node.children.length)} زیرمجموعه`;
    button.classList.toggle("is-unavailable", !productCount); copy.append(label, count);
    if (hasChildren) { button.setAttribute("aria-controls", "subcategoryRail"); button.setAttribute("aria-expanded", "false"); }
    arrow.textContent = "←"; arrow.setAttribute("aria-hidden", "true"); button.append(icon, copy, arrow);
    button.addEventListener("click", () => {
      selectCategory(name);
      if (hasChildren) { document.querySelector("#subcategoryTitle")?.focus({ preventScroll: true }); scrollCategorySelection(); }
      else document.querySelector("#products").scrollIntoView({ behavior: scrollBehavior(), block: "start" });
    });
    return button;
  }));
  el.subrail.replaceChildren(breadcrumbs, header, grid);
  el.subrail.hidden = false;
}

function buildBrandFilters() {
  const categoryProducts = productsForCategory(state.category);
  const counts = categoryProducts.reduce((map, product) => map.set(product.brand, (map.get(product.brand) || 0) + 1), new Map());
  const brands = [...counts.keys()].sort((a,b) => a.localeCompare(b,"fa"));
  const allowedBrands = new Set(brands);
  state.brands = new Set([...state.brands].filter(brand => allowedBrands.has(brand)));
  if (el.brandContext) el.brandContext.textContent = state.category === "همه" ? "برای همه محصولات" : `مرتبط با ${categoryNodes.get(state.category)?.label || state.category}`;
  if (!brands.length) {
    const empty = document.createElement("p"); empty.className = "brand-empty"; empty.textContent = "برای این دسته برندی پیدا نشد."; el.brandFilters.replaceChildren(empty); return;
  }
  el.brandFilters.replaceChildren(...brands.map(brand => {
    const label = document.createElement("label"); label.className = "brand-option";
    const left = document.createElement("span"), input = document.createElement("input"), text = document.createElement("span"), count = document.createElement("i");
    input.type = "checkbox"; input.value = brand; input.checked = state.brands.has(brand); text.textContent = brand; count.textContent = faNumber.format(counts.get(brand));
    input.addEventListener("change", () => { input.checked ? state.brands.add(brand) : state.brands.delete(brand); render(); });
    left.append(input,text); label.append(left,count); return label;
  }));
}

function categoryPath(selection) {
  const path = []; let node = categoryNodes.get(selection);
  while (node) { path.unshift(node); node = categoryNodes.get(node.parent); }
  return path;
}

function categorySetFor(selection) {
  if (selection === "همه") return null;
  const group = CATEGORY_GROUPS.find(item => item.name === selection);
  if (!group) return new Set([canonicalCategory(selection)]);
  return new Set([group.name, ...group.children].map(canonicalCategory));
}

function baseProductsForCategory(selection, source = state.products) {
  const selectedGroup = canonicalCategory(selection);
  const hasSheetGroup = source.some(product => canonicalCategory(product.group) === selectedGroup);
  if (hasSheetGroup) {
    return source.filter(product => canonicalCategory(product.group) === selectedGroup);
  }
  const categories = categorySetFor(selection);
  return categories ? source.filter(product => categories.has(product.category)) : [...source];
}

function productsForCategory(selection, source = state.products) {
  const node = categoryNodes.get(selection);
  return node ? source.filter(node.matches) : baseProductsForCategory(selection, source);
}

function scrollBehavior() { return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"; }
function scrollCategorySelection() {
  requestAnimationFrame(() => (el.subrail.hidden ? document.querySelector("#categories") : el.subrail).scrollIntoView({ behavior: scrollBehavior(), block: "start" }));
}

function selectCategory(name) {
  state.category = name;
  renderSubcategories();
  buildBrandFilters();
  render();
}

function subcategoryIcon(name = "grid") {
  const paths = {
    tv: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M12 17v4M7 21h10"/>',
    vacuum: '<rect x="3" y="13" width="11" height="7" rx="3"/><path d="M6 20v1M12 20v1M10 13V7a4 4 0 0 1 8 0v12M16 21h6M18 19l2 2"/>',
    cooking: '<path d="M5 9h14v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2ZM3 9h18M2 13h3M19 13h3M9 6V3M15 6V3"/>',
    coffee: '<path d="M4 8h13v8a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4ZM17 9h2a3 3 0 0 1 0 6h-2M2 22h18M8 5V2M13 5V2"/>',
    air: '<path d="M3 8h12a3 3 0 1 0-3-3M2 12h17a3 3 0 1 1-3 3M4 16h5a3 3 0 1 1-3 3"/>',
    health: '<path d="M20 5a5 5 0 0 0-8 1 5 5 0 0 0-8-1C-1 10 8 18 12 21c4-3 13-11 8-16Z"/><path d="M7 12h3l2-3 2 6 2-3h2"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
    fridge: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M6 10h12M9 6v2M9 14v3"/>',
    dishwasher: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 8h18M7 5h.01M10 5h.01"/><circle cx="12" cy="14" r="4"/>',
    washer: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 8h18M7 5h.01M10 5h.01"/><circle cx="12" cy="14" r="4"/>',
    phone: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
    laptop: '<rect x="4" y="4" width="16" height="12" rx="2"/><path d="M2 20h20M8 20h8"/>',
    headphones: '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><path d="M4 14h3v6H5a2 2 0 0 1-2-2v-2a2 2 0 0 1 1-2Zm16 0h-3v6h2a2 2 0 0 0 2-2v-2a2 2 0 0 0-1-2Z"/>',
    watch: '<rect x="7" y="6" width="10" height="12" rx="3"/><path d="M9 6V2h6v4M9 18v4h6v-4M12 9v3l2 1"/>',
    speaker: '<rect x="6" y="2" width="12" height="20" rx="3"/><circle cx="12" cy="15" r="4"/><circle cx="12" cy="7" r="1"/>',
    tablet: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M11 18h2"/>',
    gamepad: '<path d="M8 8h8a6 6 0 0 1 5 7l-1 4a2 2 0 0 1-3 1l-3-2h-4l-3 2a2 2 0 0 1-3-1l-1-4a6 6 0 0 1 5-7Z"/><path d="M7 12v4M5 14h4M16 13h.01M18 15h.01"/>',
    charger: '<path d="M8 3v5M16 3v5M7 8h10v4a5 5 0 0 1-5 5v4M9 21h6"/>'
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.grid}</svg>`;
}

function filteredProducts() {
  const query = state.search.toLocaleLowerCase("fa");
  const items = productsForCategory(state.category).filter(product => {
    const brandOk = !state.brands.size || state.brands.has(product.brand);
    const haystack = `${product.name} ${product.brand} ${product.code}`.toLocaleLowerCase("fa");
    return brandOk && (!query || haystack.includes(query));
  });
  return items.sort((a,b) => {
    if (state.sort === "price-asc") return a.price - b.price;
    if (state.sort === "price-desc") return b.price - a.price;
    if (state.sort === "name") return a.name.localeCompare(b.name,"fa");
    return Number(a.id) - Number(b.id);
  });
}

function render() {
  const path = categoryPath(state.category);
  document.querySelectorAll(".category-card").forEach(button => {
    const isActive = button.dataset.category === "همه" ? state.category === "همه" : path.some(node => node.id === button.dataset.category);
    button.classList.toggle("active", isActive); button.setAttribute("aria-pressed", String(isActive));
    if (button.hasAttribute("aria-controls")) button.setAttribute("aria-expanded", String(isActive));
  });
  document.querySelectorAll(".subcategory-card").forEach(button => {
    const active = button.dataset.category === state.category;
    button.classList.toggle("active", active); button.setAttribute("aria-pressed", String(active));
  });
  document.querySelectorAll(".brand-option input").forEach(input => input.checked = state.brands.has(input.value));
  const products = filteredProducts();
  el.count.textContent = `${faNumber.format(products.length)} کالا`;
  el.grid.replaceChildren(...products.map(productCard));
  el.grid.hidden = !products.length; el.empty.hidden = !!products.length;
  if (!products.length) {
    const categoryEmpty = state.category !== "همه" && !productsForCategory(state.category).length;
    el.empty.querySelector("h3").textContent = categoryEmpty ? "این بخش فعلاً کالای موجود ندارد" : "محصولی پیدا نشد";
    el.empty.querySelector("p").textContent = categoryEmpty ? "می‌توانید از مسیر دسته‌بندی به بخش قبلی برگردید یا سایر محصولات را ببینید." : "فیلترها یا عبارت جستجو را تغییر دهید.";
  }
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
  card.tabIndex = 0; card.setAttribute("role", "button"); card.setAttribute("aria-label", `مشاهده جزئیات ${product.name}`);
  card.addEventListener("click", () => openProductModal(product));
  card.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openProductModal(product); }
  });
  card.dataset.code = product.code; return fragment;
}

let modalTrigger = null;
let modalScrollY = 0;

function lockPageForModal() {
  if (document.documentElement.classList.contains("modal-open")) return;
  modalScrollY = window.scrollY;
  document.body.style.top = `-${modalScrollY}px`;
  document.documentElement.classList.add("modal-open");
}

function unlockPageAfterModal() {
  if (!document.documentElement.classList.contains("modal-open")) return;
  document.documentElement.classList.remove("modal-open");
  document.body.style.top = "";
  const previousBehavior = document.documentElement.style.scrollBehavior;
  document.documentElement.style.scrollBehavior = "auto";
  window.scrollTo(0, modalScrollY);
  document.documentElement.style.scrollBehavior = previousBehavior;
}

function openProductModal(product) {
  const modal = document.querySelector("#productModal");
  renderModalMedia(product);
  document.querySelector("#modalProductCategory").textContent = product.category || "X.Point";
  document.querySelector("#modalProductName").textContent = product.name;
  renderProductDescription(product);
  document.querySelector("#modalProductBrand").textContent = product.brand;
  document.querySelector("#modalProductCode").textContent = product.code;
  document.querySelector("#modalProductStock").textContent = product.stock || "موجود";
  document.querySelector("#modalProductPrice").innerHTML = product.price ? `${faNumber.format(product.price)} <small>${window.XPOINT_CONFIG?.currencyLabel || "تومان"}</small>` : "تماس بگیرید";
  modalTrigger = document.activeElement;
  lockPageForModal();
  modal.hidden = false;
  document.querySelector("#modalClose").focus({ preventScroll: true });
}

function renderProductDescription(product) {
  const container = document.querySelector("#modalProductDescription");
  const fallback = `محصول ${product.brand} در دسته ${product.category || "محصولات دیجیتال"}.`;
  const lines = normalize(product.description || fallback).split(/\n+/).map(line => line.trim()).filter(Boolean);
  const list = document.createElement("ul");
  const content = [];
  for (const line of lines) {
    if (/^[•\-–]\s*/.test(line)) {
      const item = document.createElement("li"); item.textContent = line.replace(/^[•\-–]\s*/, ""); list.append(item);
    } else {
      const paragraph = document.createElement("p"); paragraph.textContent = line; content.push(paragraph);
    }
  }
  container.replaceChildren(...content, ...(list.children.length ? [list] : []));
}

function renderModalMedia(product) {
  const tabs = document.querySelector("#modalMediaTabs"), stage = document.querySelector("#modalMediaStage"), thumbnails = document.querySelector("#modalThumbnails");
  const images = (product.images?.length ? product.images : [product.image]).filter(Boolean);
  if (!images.length) images.push(placeholder(product));
  tabs.replaceChildren(); stage.replaceChildren(); thumbnails.replaceChildren();

  const activate = (button, render) => {
    tabs.querySelectorAll("button").forEach(tab => { tab.classList.toggle("active", tab === button); tab.setAttribute("aria-selected", tab === button ? "true" : "false"); });
    render();
  };
  const addTab = (label, icon, render) => {
    const button = document.createElement("button");
    button.type = "button"; button.className = "modal-media-tab"; button.setAttribute("role", "tab");
    button.innerHTML = `<span aria-hidden="true">${icon}</span>${label}`;
    button.addEventListener("click", () => activate(button, render)); tabs.append(button); return button;
  };
  const showImage = index => {
    stage.replaceChildren();
    const image = document.createElement("img"); image.src = images[index]; image.alt = `تصویر ${product.name}`;
    image.addEventListener("error", () => { image.src = placeholder(product); }, { once: true }); stage.append(image);
    const counter = document.createElement("span"); counter.className = "modal-media-counter"; counter.textContent = `${faNumber.format(index + 1)} / ${faNumber.format(images.length)}`; stage.append(counter);
    if (images.length > 1) {
      const previous = document.createElement("button"), next = document.createElement("button");
      previous.type = next.type = "button"; previous.className = "modal-gallery-arrow is-previous"; next.className = "modal-gallery-arrow is-next";
      previous.setAttribute("aria-label", "تصویر قبلی"); next.setAttribute("aria-label", "تصویر بعدی"); previous.textContent = "→"; next.textContent = "←";
      previous.addEventListener("click", () => showImage((index - 1 + images.length) % images.length));
      next.addEventListener("click", () => showImage((index + 1) % images.length)); stage.append(previous, next);
    }
    thumbnails.hidden = images.length < 2;
    [...thumbnails.children].forEach((thumb, position) => { thumb.classList.toggle("active", position === index); thumb.setAttribute("aria-current", position === index ? "true" : "false"); });
  };
  images.forEach((source, index) => {
    const button = document.createElement("button"), image = document.createElement("img");
    button.type = "button"; button.className = "modal-thumbnail"; button.setAttribute("aria-label", `تصویر ${faNumber.format(index + 1)}`);
    image.src = source; image.alt = ""; image.addEventListener("error", () => { image.src = placeholder(product); }, { once: true });
    button.append(image); button.addEventListener("click", () => showImage(index)); thumbnails.append(button);
  });
  const imageTab = addTab(images.length > 1 ? `تصاویر (${faNumber.format(images.length)})` : "تصویر", "▧", () => showImage(0));

  const showFrame = (url, title, isVideo = false) => {
    stage.replaceChildren(); thumbnails.hidden = true;
    if (isVideo && /\.(?:mp4|webm|ogg)(?:$|[?#])/i.test(url)) {
      const video = document.createElement("video"); video.src = url; video.controls = true; video.playsInline = true; video.preload = "metadata"; video.poster = images[0]; video.setAttribute("aria-label", title); stage.append(video);
    } else {
      const frame = document.createElement("iframe"); frame.src = url; frame.title = title; frame.loading = "eager"; frame.allowFullscreen = true; frame.allow = "accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"; stage.append(frame);
    }
    if (isVideo) {
      const label = document.createElement("span"); label.className = "modal-stage-label"; label.innerHTML = '<b aria-hidden="true">▶</b>ویدئوی محصول'; stage.append(label);
    }
  };
  if (product.video) addTab("ویدئو", "▶", () => showFrame(product.video, `ویدئوی ${product.name}`, true));
  if (product.view360) addTab("نمای ۳۶۰°", "↻", () => showFrame(product.view360, `نمای ۳۶۰ درجه ${product.name}`));
  activate(imageTab, () => showImage(0));
}

function closeProductModal() {
  const modal = document.querySelector("#productModal");
  if (modal.hidden) return;
  modal.hidden = true;
  unlockPageAfterModal();
  if (modalTrigger instanceof HTMLElement) modalTrigger.focus({ preventScroll: true });
}

document.querySelector("#modalClose").addEventListener("click", closeProductModal);
document.querySelector("#productModal").addEventListener("click", event => { if (event.target.id === "productModal") closeProductModal(); });
document.addEventListener("keydown", event => { if (event.key === "Escape") closeProductModal(); });

function renderActiveFilters() {
  const chips = [];
  if (state.category !== "همه") chips.push(chip(categoryPath(state.category).slice(1).map(node => node.label).join(" / "), () => selectCategory("همه")));
  state.brands.forEach(brand => chips.push(chip(brand, () => { state.brands.delete(brand); render(); })));
  if (state.search) chips.push(chip(`جستجو: ${state.search}`, () => { state.search = ""; el.search.value = ""; render(); }));
  el.active.replaceChildren(...chips);
}

function chip(label, remove) {
  const node = document.createElement("span"); node.className = "filter-chip";
  const text = document.createElement("span"), close = document.createElement("button");
  text.textContent = label; close.type = "button"; close.textContent = "×"; close.setAttribute("aria-label", `حذف فیلتر ${label}`); close.addEventListener("click", remove); node.append(text,close); return node;
}

function resetAll() { state.brands.clear(); state.search = ""; state.sort = "featured"; el.search.value = ""; el.sort.value = "featured"; selectCategory("همه"); }

let searchTimer;
el.search.addEventListener("input", event => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    const query = normalize(event.target.value);
    state.search = query;
    if (query) {
      state.category = "همه";
      state.brands.clear();
      renderSubcategories();
      buildBrandFilters();
    }
    render();
  }, 180);
});
el.sort.addEventListener("change", event => { state.sort = event.target.value; render(); });
el.clear.addEventListener("click", resetAll); el.emptyReset.addEventListener("click", resetAll);
document.querySelectorAll("[data-scroll-products]").forEach(button => button.addEventListener("click", () => document.querySelector("#products").scrollIntoView({ behavior: "smooth" })));
bannerEl.prev.addEventListener("click", () => showBanner(bannerState.index - 1));
bannerEl.next.addEventListener("click", () => showBanner(bannerState.index + 1));

buildCategories(); loadProducts(); loadDriveBanners();
// شیت هنگام بازشدن صفحه و سپس هر پنج دقیقه بدون کش دوباره خوانده می‌شود.
setInterval(loadProducts, 5 * 60 * 1000);
bannerState.refreshTimer = setInterval(loadDriveBanners, Number(window.XPOINT_CONFIG?.bannerRefreshMs) || 300000);
