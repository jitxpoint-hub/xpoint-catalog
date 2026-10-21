import { readFile } from "node:fs/promises";

const requiredHeaders = [
  "نام محصول", "برند", "کد محصول", "قیمت نقد", "وضعیت موجودی",
  "گروه اصلی", "دسته‌بندی", "زیرمجموعه", "توضیحات", "عکس",
  "تصاویر بیشتر", "ویدیو", "مدل سه‌بعدی", "برچسب‌ها"
];
const allowedStatuses = new Set(["موجود", "ناموجود", "عدم نمایش"]);

function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index], next = text[index + 1];
    if (char === '"' && quoted && next === '"') { cell += '"'; index++; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index++;
      row.push(cell);
      if (row.some(value => value.trim())) rows.push(row);
      row = []; cell = "";
    } else cell += char;
  }
  row.push(cell);
  if (row.some(value => value.trim())) rows.push(row);
  return rows;
}

function fail(message) {
  console.error(`Catalog validation failed: ${message}`);
  process.exitCode = 1;
}

const csv = await readFile(new URL("../data/products.csv", import.meta.url), "utf8");
const [headers, ...rows] = parseCsv(csv);

if (headers.length !== requiredHeaders.length || requiredHeaders.some((name, index) => headers[index] !== name)) {
  fail("ستون‌های فایل پشتیبان با ساختار مورد انتظار هماهنگ نیستند.");
}

const column = Object.fromEntries(headers.map((name, index) => [name, index]));
const seenCodes = new Set();
let visibleCount = 0;

rows.forEach((row, index) => {
  const line = index + 2;
  const value = name => String(row[column[name]] ?? "").trim();
  const code = value("کد محصول");
  const status = value("وضعیت موجودی");

  for (const name of ["نام محصول", "برند", "کد محصول"]) {
    if (!value(name)) fail(`مقدار «${name}» در ردیف ${line} خالی است.`);
  }
  if (!allowedStatuses.has(status)) fail(`وضعیت موجودی نامعتبر در ردیف ${line}: ${status || "خالی"}`);
  if (seenCodes.has(code)) fail(`کد محصول تکراری در ردیف ${line}: ${code}`);
  seenCodes.add(code);

  if (status !== "عدم نمایش") {
    visibleCount++;
    for (const name of ["گروه اصلی", "دسته‌بندی", "عکس"]) {
      if (!value(name)) fail(`محصول قابل نمایش ${code} مقدار «${name}» ندارد.`);
    }
    if (!/^https?:\/\//i.test(value("عکس"))) fail(`لینک عکس محصول ${code} معتبر نیست.`);
  }
});

if (!rows.length) fail("فهرست محصولات خالی است.");
if (!visibleCount) fail("هیچ محصول قابل نمایشی وجود ندارد.");

const appSource = await readFile(new URL("../app.js", import.meta.url), "utf8");
const configSource = await readFile(new URL("../config.js", import.meta.url), "utf8");
const adminHtml = await readFile(new URL("../admin.html", import.meta.url), "utf8");
const adminJs = await readFile(new URL("../admin.js", import.meta.url), "utf8");
const adminCss = await readFile(new URL("../admin.css", import.meta.url), "utf8");
const analyticsScript = await readFile(new URL("../google-apps-script/BannerFeed.gs", import.meta.url), "utf8");
if (!appSource.includes('document.addEventListener("visibilitychange"')) fail("به‌روزرسانی هوشمند صفحه حذف شده است.");
if (!appSource.includes("!document.hidden")) fail("کنترل فعال‌بودن صفحه حذف شده است.");
if (!appSource.includes("RECENT_PRODUCTS_KEY")) fail("تاریخچه محصولات دیده‌شده حذف شده است.");
if (!appSource.includes("getSimilarProducts")) fail("بخش محصولات مشابه حذف شده است.");
if (!appSource.includes("برچسب‌های مدیریتی")) fail("خواندن برچسب‌های مدیریتی شیت حذف شده است.");
if (!appSource.includes("trackAnalyticsEvent")) fail("ثبت رویدادهای استفاده از سایت حذف شده است.");
if (!appSource.includes("loadFestival")) fail("خواندن جشنواره از شیت حذف شده است.");
if (!configSource.includes("analyticsEndpoint")) fail("آدرس سرویس گزارش‌گیری تنظیم نشده است.");
if (!adminHtml.includes("پنل گزارش") || !adminJs.includes("requestStats") || !adminCss.includes("dashboard-grid")) fail("صفحه مستقل گزارش ناقص است.");
if (!analyticsScript.includes("recordAnalyticsEvent_") || !analyticsScript.includes("analyticsStatsOutput_") || !analyticsScript.includes("festivalOutput_")) fail("بخش گزارش‌گیری و جشنواره Apps Script ناقص است.");

if (!process.exitCode) {
  console.log(`Catalog validation passed: ${rows.length} rows, ${visibleCount} visible products.`);
}
