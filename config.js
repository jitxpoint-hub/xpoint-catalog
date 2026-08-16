/**
 * منبع داده محصولات
 * آدرس CSV منتشرشده Google Sheets را بین کوتیشن‌ها قرار دهید.
 * اگر خالی باشد، سایت از products.sample.json استفاده می‌کند.
 */
window.XPOINT_CONFIG = {
  googleSheetCsvUrl: "https://docs.google.com/spreadsheets/d/1H6eUwY7o-LLsIYYlN2yL3hf_MYG1mrp5wOjDpeXi6NA/export?format=csv&gid=0",
  // آدرس Web App ساخته‌شده با فایل google-apps-script/BannerFeed.gs
  bannerFeedUrl: "https://script.google.com/macros/s/AKfycbwSDnekEJneELVjWHgNL_R67y2wYbmu8JFiB3FXFqIdbyOY2_dtH6ypGruHbtGD9U4n/exec",
  bannerRotationMs: 5500,
  bannerRefreshMs: 14400000,
  fallbackDataUrl: "products.sample.json",
  currencyLabel: "تومان"
};
