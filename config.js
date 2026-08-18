/**
 * منبع داده محصولات
 * آدرس CSV منتشرشده Google Sheets را بین کوتیشن‌ها قرار دهید.
 * اگر خالی باشد، سایت از products.sample.json استفاده می‌کند.
 */
window.XPOINT_CONFIG = {
  googleSheetCsvUrl: "https://docs.google.com/spreadsheets/d/1bVSa_MVZhf5hVa3KVeLkU3V4DgyXePsnsV1MupEJa7M/export?format=csv&gid=71366496",
  // آدرس Web App ساخته‌شده با فایل google-apps-script/BannerFeed.gs
  bannerFeedUrl: "https://script.google.com/macros/s/AKfycbyYNK_mgq0L3Zns1L5VNbIBgZaUn6enxxv-W2-uobJpsrxMRxgmTlXWhtyJh1qliua2IQ/exec",
  bannerRotationMs: 5500,
  bannerRefreshMs: 14400000,
  fallbackDataUrl: "products.sample.json",
  currencyLabel: "تومان"
};
