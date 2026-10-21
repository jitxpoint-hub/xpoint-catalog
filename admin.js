const dashboard = { range: "30d", timer: null };
const faNumberAdmin = new Intl.NumberFormat("fa-IR");
const faDateAdmin = new Intl.DateTimeFormat("fa-IR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

function requestStats(range) {
  const endpoint = String(window.XPOINT_CONFIG?.analyticsEndpoint || "").trim();
  if (!endpoint) return Promise.reject(new Error("آدرس سرویس آمار تنظیم نشده است."));
  return new Promise((resolve, reject) => {
    const callback = `__xpointStats_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const script = document.createElement("script");
    const timeout = setTimeout(() => finish(new Error("پاسخی از سرویس آمار دریافت نشد.")), 15000);
    const finish = (error, value) => { clearTimeout(timeout); delete window[callback]; script.remove(); error ? reject(error) : resolve(value); };
    window[callback] = data => data?.ok && data?.summary ? finish(null, data) : finish(new Error(data?.error || "سرویس آمار هنوز فعال نشده است."));
    script.onerror = () => finish(new Error("ارتباط با سرویس آمار برقرار نشد."));
    script.src = `${endpoint}${endpoint.includes("?") ? "&" : "?"}action=stats&range=${encodeURIComponent(range)}&callback=${encodeURIComponent(callback)}&_=${Date.now()}`;
    document.head.append(script);
  });
}

function renderRankList(id, items = [], emptyText = "هنوز داده کافی ثبت نشده است.") {
  const container = document.getElementById(id);
  if (!items.length) { const empty = document.createElement("p"); empty.className = "rank-empty"; empty.textContent = emptyText; container.replaceChildren(empty); return; }
  const max = Math.max(...items.map(item => Number(item.value) || 0), 1);
  container.replaceChildren(...items.slice(0, 10).map(item => {
    const row = document.createElement("div"), label = document.createElement("span"), bar = document.createElement("span"), fill = document.createElement("i"), value = document.createElement("strong");
    row.className = "rank-item"; label.className = "rank-label"; bar.className = "rank-bar"; value.className = "rank-value";
    label.textContent = item.label; label.title = item.label; fill.style.setProperty("--value", `${Math.max(3, (Number(item.value) || 0) / max * 100)}%`); value.textContent = faNumberAdmin.format(item.value || 0);
    bar.append(fill); row.append(label, bar, value); return row;
  }));
}

function renderDailyActivity(items = []) {
  const container = document.getElementById("dailyActivity");
  if (!items.length) { const empty = document.createElement("p"); empty.className = "rank-empty"; empty.textContent = "هنوز فعالیتی برای این بازه ثبت نشده است."; container.replaceChildren(empty); return; }
  const max = Math.max(...items.map(item => Number(item.value) || 0), 1);
  container.replaceChildren(...items.slice(-14).map(item => {
    const row = document.createElement("div"), label = document.createElement("span"), bar = document.createElement("span"), fill = document.createElement("i"), value = document.createElement("strong");
    row.className = "activity-day"; label.textContent = item.label; bar.className = "activity-bar"; fill.style.setProperty("--value", `${Math.max(4, (Number(item.value) || 0) / max * 100)}%`); value.textContent = faNumberAdmin.format(item.value || 0);
    bar.append(fill); row.append(label, bar, value); return row;
  }));
}

function renderRecentActivity(items = []) {
  const container = document.getElementById("recentActivity");
  if (!items.length) { const empty = document.createElement("p"); empty.className = "rank-empty"; empty.textContent = "هنوز فعالیت تازه‌ای ثبت نشده است."; container.replaceChildren(empty); return; }
  container.replaceChildren(...items.slice(0, 8).map(item => {
    const row = document.createElement("div"), badge = document.createElement("span"), content = document.createElement("div"), title = document.createElement("strong"), meta = document.createElement("small"), time = document.createElement("time");
    row.className = "recent-item"; badge.className = "recent-badge"; badge.textContent = item.action || "فعالیت"; title.textContent = item.title || "بدون عنوان";
    meta.textContent = item.detail || "کاتالوگ"; time.dateTime = item.time || ""; time.textContent = item.time ? faDateAdmin.format(new Date(item.time)) : "—";
    content.append(title, meta); row.append(badge, content, time); return row;
  }));
}

function renderDashboard(data) {
  document.getElementById("metricVisits").textContent = faNumberAdmin.format(data.summary.visits || 0);
  document.getElementById("metricProducts").textContent = faNumberAdmin.format(data.summary.productViews || 0);
  document.getElementById("metricSearches").textContent = faNumberAdmin.format(data.summary.searches || 0);
  document.getElementById("metricEngagement").textContent = `${faNumberAdmin.format(data.summary.engagementRate || 0)}٪`;
  renderRankList("topProducts", data.products);
  renderRankList("topGroups", data.groups, "با انتخاب گروه‌های اصلی، آمار این بخش تکمیل می‌شود.");
  renderRankList("topCategories", data.categories, "با مشاهده محصولات، دسته‌بندی‌های محبوب اینجا دیده می‌شوند.");
  renderRankList("topCategoryPaths", data.categoryPaths, "پس از مشاهده محصول، مسیر گروه و دسته اینجا نمایش داده می‌شود.");
  renderRankList("topSources", data.sources);
  renderRankList("topDevices", data.devices); renderRankList("topSearches", data.searches);
  renderDailyActivity(data.dailyActivity); renderRecentActivity(data.recentActivity);
  const topProduct = data.products?.[0]?.label;
  const topGroup = data.groups?.[0]?.label;
  const headline = document.getElementById("insightHeadline");
  const details = document.getElementById("insightDetails");
  if (topProduct || topGroup) {
    headline.textContent = topProduct ? `بیشترین توجه به «${topProduct}» بوده است.` : `«${topGroup}» محبوب‌ترین گروه است.`;
    details.textContent = [topGroup && `گروه پربازدید: ${topGroup}`, data.sources?.[0]?.label && `ورودی غالب: ${data.sources[0].label}`, data.summary.searches && `${faNumberAdmin.format(data.summary.searches)} جستجو`].filter(Boolean).join("  •  ");
  } else {
    headline.textContent = "هنوز برای نتیجه‌گیری داده کافی نداریم.";
    details.textContent = "با اولین استفاده کاربران، محصولات و دسته‌های محبوب به‌صورت خودکار مشخص می‌شوند.";
  }
  const updated = new Date(data.generatedAt);
  const status = document.getElementById("dashboardStatus"); status.classList.remove("error");
  status.textContent = `آخرین به‌روزرسانی: ${updated.toLocaleString("fa-IR")}`;
}

async function loadDashboard() {
  const status = document.getElementById("dashboardStatus"); status.classList.remove("error"); status.textContent = "در حال دریافت گزارش…";
  try { renderDashboard(await requestStats(dashboard.range)); }
  catch (error) { status.classList.add("error"); status.textContent = error.message; }
}

document.querySelectorAll("#rangeTabs button").forEach(button => button.addEventListener("click", () => {
  dashboard.range = button.dataset.range;
  document.querySelectorAll("#rangeTabs button").forEach(item => item.classList.toggle("active", item === button));
  loadDashboard();
}));

loadDashboard();
dashboard.timer = setInterval(loadDashboard, 60000);
