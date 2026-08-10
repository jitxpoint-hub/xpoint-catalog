# اتصال پوشه Google Drive به بنر سایت

## ۱. ساخت پوشه بنرها

1. در Google Drive یک پوشه با نام دلخواه، مثلاً `XPoint Website Banners` بسازید.
2. دسترسی پوشه را روی **Anyone with the link → Viewer** قرار دهید.
3. شناسه پوشه را از آدرس آن بردارید. در آدرس زیر، بخش `FOLDER_ID` همان شناسه است:

```text
https://drive.google.com/drive/folders/FOLDER_ID
```

## ۲. ساخت فید بنر با Google Apps Script

1. وارد [Google Apps Script](https://script.google.com) شوید و یک پروژه جدید بسازید.
2. محتوای فایل `google-apps-script/BannerFeed.gs` را داخل فایل `Code.gs` قرار دهید.
3. در ابتدای کد، مقدار زیر را با شناسه پوشه خود جایگزین کنید:

```js
const XPOINT_BANNER_FOLDER_ID = "PUT_GOOGLE_DRIVE_FOLDER_ID_HERE";
```

4. تابع `testBannerFolder` را یک بار اجرا و دسترسی Google Drive را تأیید کنید.
5. از مسیر **Deploy → New deployment → Web app** پروژه را منتشر کنید.
6. گزینه **Execute as** را روی `Me` و گزینه دسترسی را روی `Anyone` قرار دهید.
7. آدرس نهایی که به `/exec` ختم می‌شود را کپی کنید.

## ۳. اتصال فید به سایت

در فایل `config.js`، آدرس Web app را وارد کنید:

```js
window.XPOINT_CONFIG = {
  googleSheetCsvUrl: "YOUR_PRODUCTS_CSV_URL",
  bannerFeedUrl: "https://script.google.com/macros/s/DEPLOYMENT_ID/exec",
  bannerRotationMs: 5500,
  bannerRefreshMs: 300000,
  fallbackDataUrl: "products.sample.json",
  currencyLabel: "تومان"
};
```

## روش استفاده روزانه

- هر تصویر JPG، PNG یا WebP که داخل پوشه قرار بگیرد، در اسلایدر بالای سایت ظاهر می‌شود.
- جدیدترین فایل، اولین بنر خواهد بود.
- با حذف فایل از پوشه، پس از تازه‌سازی فید از اسلایدر حذف می‌شود.
- سایت هنگام بازشدن و سپس هر ۵ دقیقه فهرست بنرها را دوباره می‌خواند.
- فید Apps Script برای یک دقیقه کش می‌شود.

ابعاد پیشنهادی بنر دسکتاپ `1800×600` پیکسل است. سوژه و نوشته‌های مهم را نزدیک مرکز نگه دارید تا برش موبایل مشکلی ایجاد نکند.
