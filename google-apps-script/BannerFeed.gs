/**
 * X.Point — Google Drive Banner Feed + Usage Analytics
 *
 * 1) شناسه پوشه عمومی Google Drive را جایگزین کنید.
 * 2) اسکریپت را به‌صورت Web app منتشر کنید.
 * 3) آدرس /exec را در config.js مقابل bannerFeedUrl قرار دهید.
 */

const XPOINT_BANNER_FOLDER_ID = "10z96SA3t1pFmb9jkj-ExfBInb6JUtrIz";
const XPOINT_MAX_BANNERS = 20;
const XPOINT_ANALYTICS_SPREADSHEET_ID = "1bVSa_MVZhf5hVa3KVeLkU3V4DgyXePsnsV1MupEJa7M";
const XPOINT_ANALYTICS_SHEET_NAME = "آمار سایت";
const XPOINT_ANALYTICS_EVENTS = ["page_view", "section_view", "product_view", "category_select", "search", "festival_click"];

function doGet(event) {
  const params = event && event.parameter ? event.parameter : {};
  const callback = params.callback || "";
  try {
    if (params.action === "track") return recordAnalyticsEvent_(params, callback);
    if (params.action === "stats") return analyticsStatsOutput_(params, callback);
    if (params.action === "festival") return festivalOutput_(callback);

    const cached = CacheService.getScriptCache().get("xpoint-banners-v1");
    if (cached) return jsonOutput_(JSON.parse(cached), callback);

    if (!XPOINT_BANNER_FOLDER_ID || XPOINT_BANNER_FOLDER_ID.indexOf("PUT_") === 0) {
      throw new Error("شناسه پوشه Google Drive در BannerFeed.gs تنظیم نشده است.");
    }

    const folder = DriveApp.getFolderById(XPOINT_BANNER_FOLDER_ID);
    const files = folder.getFiles();
    const banners = [];

    while (files.hasNext()) {
      const file = files.next();
      const mimeType = file.getMimeType() || "";
      if (mimeType.indexOf("image/") !== 0) continue;

      banners.push({
        id: file.getId(),
        name: cleanName_(file.getName()),
        url: "https://drive.google.com/thumbnail?id=" + file.getId() + "&sz=w2000",
        updatedAt: file.getLastUpdated().toISOString()
      });
    }

    banners.sort(function(a, b) {
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    const result = {
      ok: true,
      folder: folder.getName(),
      banners: banners.slice(0, XPOINT_MAX_BANNERS),
      generatedAt: new Date().toISOString()
    };

    CacheService.getScriptCache().put("xpoint-banners-v1", JSON.stringify(result), 60);
    return jsonOutput_(result, callback);
  } catch (error) {
    return jsonOutput_({ ok: false, banners: [], error: error.message }, callback);
  }
}

function recordAnalyticsEvent_(params, callback) {
  const eventName = safeCell_(params.event, 40);
  if (XPOINT_ANALYTICS_EVENTS.indexOf(eventName) === -1) {
    return jsonOutput_({ ok: false, error: "رویداد معتبر نیست." }, callback);
  }

  const row = [
    new Date(),
    eventName,
    safeCell_(params.session, 100),
    safeCell_(params.product, 200),
    safeCell_(params.code, 80),
    safeCell_(params.group, 120),
    safeCell_(params.category, 120),
    safeCell_(params.section, 120),
    safeCell_(params.query, 200),
    safeCell_(params.source, 160),
    safeCell_(params.utmSource, 120),
    safeCell_(params.utmMedium, 120),
    safeCell_(params.utmCampaign, 160),
    safeCell_(params.device, 40),
    safeCell_(params.path, 250)
  ];

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = analyticsSheet_();
    sheet.getRange(nextAnalyticsRow_(sheet), 1, 1, row.length).setValues([row]);
  } finally {
    lock.releaseLock();
  }
  ["today", "7d", "30d", "all"].forEach(function(range) {
    CacheService.getScriptCache().remove("xpoint-stats-v1-" + range);
  });
  return jsonOutput_({ ok: true }, callback);
}

function analyticsStatsOutput_(params, callback) {
  const range = ["today", "7d", "30d", "all"].indexOf(params.range) >= 0 ? params.range : "30d";
  const cacheKey = "xpoint-stats-v1-" + range;
  const cache = CacheService.getScriptCache();
  const cached = cache.get(cacheKey);
  if (cached) return jsonOutput_(JSON.parse(cached), callback);

  const sheet = analyticsSheet_();
  const rows = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 15).getValues() : [];
  const threshold = analyticsThreshold_(range);
  const summary = { visits: 0, sessions: 0, productViews: 0, searches: 0, engagementRate: 0 };
  const sessions = {}, engagedSessions = {};
  const products = {}, sections = {}, groups = {}, categories = {}, categoryPaths = {}, sources = {}, devices = {}, searches = {}, dailyActivity = {};
  const recentActivity = [];

  rows.forEach(function(row) {
    const time = row[0] instanceof Date ? row[0] : new Date(row[0]);
    if (threshold && (!time || isNaN(time.getTime()) || time < threshold)) return;
    const eventName = String(row[1] || "");
    const session = String(row[2] || "");
    const group = String(row[5] || "").trim();
    const category = String(row[6] || "").trim();
    const meaningfulEvent = ["product_view", "category_select", "search", "festival_click"].indexOf(eventName) >= 0;
    if (session) sessions[session] = true;
    if (session && meaningfulEvent) engagedSessions[session] = true;
    if (meaningfulEvent && time && !isNaN(time.getTime())) {
      const dayKey = Utilities.formatDate(time, Session.getScriptTimeZone() || "Asia/Tehran", "yyyy-MM-dd");
      increment_(dailyActivity, dayKey);
      recentActivity.push(recentActivityItem_(eventName, row, time, group, category));
    }
    if (eventName === "page_view") {
      summary.visits++;
      increment_(sources, String(row[10] || row[9] || "مستقیم"));
      increment_(devices, String(row[13] || "نامشخص"));
    } else if (eventName === "product_view") {
      summary.productViews++;
      increment_(products, String(row[3] || row[4] || "بدون نام"));
      if (group && group !== "همه") increment_(groups, group);
      if (category) increment_(categories, category);
      if (group && group !== "همه" && category && group !== category) increment_(categoryPaths, group + " / " + category);
    } else if (eventName === "section_view") {
      increment_(sections, String(row[7] || "سایر"));
    } else if (eventName === "category_select") {
      if (group && group !== "همه") increment_(groups, group);
      if (category) increment_(categories, category);
      if (group && group !== "همه" && category && group !== category) increment_(categoryPaths, group + " / " + category);
    } else if (eventName === "search") {
      summary.searches++;
      increment_(searches, String(row[8] || "بدون عبارت"));
    } else if (eventName === "festival_click") {
      increment_(sections, "جشنواره: " + String(row[7] || "بدون عنوان"));
    }
  });

  summary.sessions = Object.keys(sessions).length;
  summary.engagementRate = summary.sessions ? Math.round(Object.keys(engagedSessions).length / summary.sessions * 100) : 0;
  const result = {
    ok: true,
    range: range,
    summary: summary,
    products: ranked_(products),
    sections: ranked_(sections),
    groups: ranked_(groups),
    categories: ranked_(categories),
    categoryPaths: ranked_(categoryPaths),
    sources: ranked_(sources),
    devices: ranked_(devices),
    searches: ranked_(searches),
    dailyActivity: Object.keys(dailyActivity).sort().map(function(label) { return { label: label.slice(5).replace("-", "/"), value: dailyActivity[label] }; }),
    recentActivity: recentActivity.sort(function(a, b) { return b.sortTime - a.sortTime; }).slice(0, 12).map(function(item) { delete item.sortTime; return item; }),
    generatedAt: new Date().toISOString()
  };
  cache.put(cacheKey, JSON.stringify(result), 60);
  return jsonOutput_(result, callback);
}

function recentActivityItem_(eventName, row, time, group, category) {
  const actions = { product_view: "مشاهده محصول", category_select: "انتخاب دسته", search: "جستجو", festival_click: "جشنواره" };
  let title = "فعالیت در کاتالوگ";
  if (eventName === "product_view") title = String(row[3] || row[4] || "محصول بدون نام");
  else if (eventName === "category_select") title = category || group || "دسته‌بندی";
  else if (eventName === "search") title = String(row[8] || "عبارت بدون نام");
  else if (eventName === "festival_click") title = String(row[7] || "جشنواره");
  return { action: actions[eventName] || "فعالیت", title: title, detail: [group, category].filter(Boolean).filter(function(value, index, list) { return list.indexOf(value) === index; }).join(" / "), time: time.toISOString(), sortTime: time.getTime() };
}

function festivalOutput_(callback) {
  const cache = CacheService.getScriptCache();
  const cached = cache.get("xpoint-festival-v1");
  if (cached) return jsonOutput_(JSON.parse(cached), callback);
  const values = analyticsSheet_().getRange("Q3:X3").getValues()[0];
  const now = new Date();
  const start = values[5] instanceof Date ? values[5] : (values[5] ? new Date(values[5]) : null);
  const end = values[6] instanceof Date ? values[6] : (values[6] ? new Date(values[6]) : null);
  const active = String(values[0] || "").trim() === "فعال" && (!start || isNaN(start.getTime()) || now >= start) && (!end || isNaN(end.getTime()) || now <= end);
  const result = {
    ok: true,
    festival: {
      active: active,
      title: safeCell_(values[1], 120),
      description: safeCell_(values[2], 240),
      buttonText: safeCell_(values[3], 60) || "مشاهده جشنواره",
      url: safeFestivalUrl_(values[4]),
      placement: safeCell_(values[7], 60) || "صفحه اصلی"
    },
    generatedAt: now.toISOString()
  };
  cache.put("xpoint-festival-v1", JSON.stringify(result), 60);
  return jsonOutput_(result, callback);
}

function safeFestivalUrl_(value) {
  const url = String(value || "").trim();
  return /^(https?:\/\/|#)/i.test(url) ? url.slice(0, 500) : "#products";
}

function analyticsSheet_() {
  const sheet = SpreadsheetApp.openById(XPOINT_ANALYTICS_SPREADSHEET_ID).getSheetByName(XPOINT_ANALYTICS_SHEET_NAME);
  if (!sheet) throw new Error("برگه آمار سایت پیدا نشد.");
  return sheet;
}

function nextAnalyticsRow_(sheet) {
  const lastUsedRow = Math.max(1, sheet.getLastRow());
  const values = sheet.getRange(1, 1, lastUsedRow, 1).getDisplayValues();
  for (let index = values.length - 1; index >= 1; index--) {
    if (String(values[index][0] || "").trim()) return index + 2;
  }
  return 2;
}

function analyticsThreshold_(range) {
  const now = new Date();
  if (range === "all") return null;
  if (range === "today") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return start;
  }
  const days = range === "7d" ? 7 : 30;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

function increment_(bucket, label) {
  const key = label.trim() || "نامشخص";
  bucket[key] = (bucket[key] || 0) + 1;
}

function ranked_(bucket) {
  return Object.keys(bucket).map(function(label) {
    return { label: label, value: bucket[label] };
  }).sort(function(a, b) {
    return b.value - a.value || a.label.localeCompare(b.label);
  }).slice(0, 10);
}

function safeCell_(value, maxLength) {
  let text = String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength || 200);
  if (/^[=+\-@]/.test(text)) text = "'" + text;
  return text;
}

function clearBannerFeedCache() {
  CacheService.getScriptCache().remove("xpoint-banners-v1");
}

function testBannerFolder() {
  const folder = DriveApp.getFolderById(XPOINT_BANNER_FOLDER_ID);
  Logger.log("Banner folder connected: " + folder.getName());
}

function testAnalyticsSheet() {
  Logger.log("Analytics sheet connected: " + analyticsSheet_().getName());
}

function cleanName_(name) {
  return String(name || "بنر X.Point").replace(/\.[^.]+$/, "").trim();
}

function jsonOutput_(data, callback) {
  const safeCallback = /^[A-Za-z_$][0-9A-Za-z_$]*$/.test(callback || "") ? callback : "";
  const body = safeCallback ? safeCallback + "(" + JSON.stringify(data) + ");" : JSON.stringify(data);
  return ContentService
    .createTextOutput(body)
    .setMimeType(safeCallback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
}
