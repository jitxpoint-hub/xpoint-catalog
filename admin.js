const dashboard = { range: "30d", timer: null };
const faNumberAdmin = new Intl.NumberFormat("fa-IR");

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

function renderRankList(id, items = []) {
  const container = document.getElementById(id);
  if (!items.length) { const empty = document.createElement("p"); empty.className = "rank-empty"; empty.textContent = "هنوز داده‌ای ثبت نشده است."; container.replaceChildren(empty); return; }
  const max = Math.max(...items.map(item => Number(item.value) || 0), 1);
  container.replaceChildren(...items.slice(0, 10).map(item => {
    const row = document.createElement("div"), label = document.createElement("span"), bar = document.createElement("span"), fill = document.createElement("i"), value = document.createElement("strong");
    row.className = "rank-item"; label.className = "rank-label"; bar.className = "rank-bar"; value.className = "rank-value";
    label.textContent = item.label; label.title = item.label; fill.style.setProperty("--value", `${Math.max(3, (Number(item.value) || 0) / max * 100)}%`); value.textContent = faNumberAdmin.format(item.value || 0);
    bar.append(fill); row.append(label, bar, value); return row;
  }));
}

function renderDashboard(data) {
  document.getElementById("metricVisits").textContent = faNumberAdmin.format(data.summary.visits || 0);
  document.getElementById("metricSessions").textContent = faNumberAdmin.format(data.summary.sessions || 0);
  document.getElementById("metricProducts").textContent = faNumberAdmin.format(data.summary.productViews || 0);
  document.getElementById("metricSearches").textContent = faNumberAdmin.format(data.summary.searches || 0);
  renderRankList("topProducts", data.products); renderRankList("topSections", data.sections);
  renderRankList("topCategories", data.categories); renderRankList("topSources", data.sources);
  renderRankList("topDevices", data.devices); renderRankList("topSearches", data.searches);
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
