/**
 * X.Point — Google Drive Banner Feed
 *
 * 1) شناسه پوشه عمومی Google Drive را جایگزین کنید.
 * 2) اسکریپت را به‌صورت Web app منتشر کنید.
 * 3) آدرس /exec را در config.js مقابل bannerFeedUrl قرار دهید.
 */

const XPOINT_BANNER_FOLDER_ID = "10z96SA3t1pFmb9jkj-ExfBInb6JUtrIz";
const XPOINT_MAX_BANNERS = 20;

function doGet(event) {
  const callback = event && event.parameter ? event.parameter.callback : "";
  try {
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

function clearBannerFeedCache() {
  CacheService.getScriptCache().remove("xpoint-banners-v1");
}

function testBannerFolder() {
  const folder = DriveApp.getFolderById(XPOINT_BANNER_FOLDER_ID);
  Logger.log("Banner folder connected: " + folder.getName());
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
