/* Category navigation is built from sheet data, without changing product rows. */
window.XPointCategoryTree = (() => {
  const clean = value => String(value || '').trim().replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/[\u200c\s_-]+/g, ' ').replace(/[۰-۹]/g, digit => '۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)).replace(/[٠-٩]/g, digit => '٠١٢٣٤٥٦٧٨٩'.indexOf(digit));
  const key = value => clean(value).replace(/\s/g, '').toLowerCase();
  const firstMatch = (text, rules, fallback = 'سایر مدل‌ها') => rules.find(([, pattern]) => pattern.test(clean(text)))?.[0] || fallback;
  const memory = product => {
    const found = clean(product.name).match(/\b(32|64|128|256|512)\s*GB\b|\b([124])\s*TB\b/i);
    return found ? (found[1] ? `${found[1]} گیگابایت` : `${found[2]} ترابایت`) : 'ظرفیت نامشخص';
  };
  const capacity = (product, unit) => {
    const match = clean(product.name).match(unit === 'نفره' ? /(\d+)\s*نفر/ : /(\d+(?:[.٫]\d+)?)\s*کیلو/);
    return match ? `${match[1]} ${unit}` : 'ظرفیت نامشخص';
  };
const fridgeRules = [
  ['دوقلو', /دو\s*قلو|twin/i], ['ساید‌بای‌ساید', /ساید|side\s*by\s*side/i],
  ['چهار درب', /چهار\s*درب|4\s*درب|four\s*door/i],
  ['فریزر بالا', /فریزر\s*بالا|top\s*freezer/i],
  ['فریزر پایین', /فریزر\s*پایین|bottom\s*freezer/i]
];
  const accessoryRules = [
    ['هدفون و هندزفری', /هدفون|هندزفری|headphone|earbud|airpod|buds/i],
    ['ساعت و مچ‌بند هوشمند', /ساعت|مچ بند|\bwatch\b|\bband\b/i], ['مودم و شبکه', /مودم|روتر|modem|router/i],
    ['حافظه و ذخیره‌سازی', /هارد|فلش|حافظه|\bssd\b/i], ['آرایشی و بهداشتی', /اصلاح|سشوار|برس|ماساژور|بهداشتی/],
    ['کابل و تبدیل', /کابل|تبدیل|\bcable\b/i]
  ];
  const homeTypes = [
    ['جارو رباتیک', /جارو\s*رباتیک|robot.*vacuum/i], ['جارو شارژی', /جارو\s*شارژی/], ['جارو برقی', /جارو\s*برقی/], ['بخارشوی', /بخارشوی/],
    ['هواپز و سرخ‌کن', /هوا\s*پز|سرخ\s*کن/], ['اسپرسوساز', /اسپرسو/], ['قهوه‌ساز', /قهوه/], ['کتری برقی', /کتری/],
    ['آبمیوه‌گیر', /آبمیوه/], ['مخلوط‌کن', /مخلوط/], ['غذاساز', /غذا\s*ساز/], ['چرخ گوشت', /چرخ\s*گوشت/],
    ['پاپ‌کورن‌ساز', /پاپ\s*کورن/], ['پلوپز', /پلوپز/], ['زودپز', /زودپز/], ['توستر', /توستر/], ['شیکر', /شیکر/],
    ['اجاق گاز', /اجاق/], ['فر توکار', /فر\s*توکار/], ['هود', /هود/], ['اتو بخار', /اتو/],
    ['تصفیه هوا', /تصفیه\s*هوا/], ['رطوبت‌ساز', /رطوبت/], ['پنکه', /پنکه/],
    ['پروژکتور', /پروژکتور|projector/i], ['ماساژور', /ماساژور/], ['ترازو', /ترازو/], ['متر لیزری', /متر\s*لیزری/], ['ماگ', /ماگ/]
  ];
  const homeSections = [
    ['نظافت خانه', ['جارو رباتیک', 'جارو شارژی', 'جارو برقی', 'بخارشوی', 'اتو بخار']],
    ['آشپزخانه و پخت‌وپز', ['هواپز و سرخ‌کن', 'آبمیوه‌گیر', 'مخلوط‌کن', 'غذاساز', 'چرخ گوشت', 'پاپ‌کورن‌ساز', 'پلوپز', 'زودپز', 'توستر', 'شیکر', 'اجاق گاز', 'فر توکار', 'هود']],
    ['قهوه و نوشیدنی', ['اسپرسوساز', 'قهوه‌ساز', 'کتری برقی', 'ماگ']],
    ['تهویه و هوای خانه', ['تصفیه هوا', 'رطوبت‌ساز', 'پنکه']],
    ['پروژکتور', ['پروژکتور']],
    ['سلامت', ['ماساژور', 'ترازو']],
    ['ابزارهای هوشمند', ['متر لیزری']]
  ];
  const presets = {
    'یخچال': [...fridgeRules.map(([label]) => label), 'سایر مدل‌ها'],
    'اکسسوری': [...accessoryRules.map(([label]) => label), 'سایر اکسسوری‌ها'],
    'شارژر': ['شارژر دیواری', 'شارژر خودرو', 'شارژر بی‌سیم', 'پاوربانک', 'سایر شارژرها'],
    'کنسول بازی': ['کنسول', 'دسته بازی', 'پایه شارژ', 'سایر لوازم بازی'],
    'اسپیکر': ['قابل حمل', 'پارتی‌باکس', 'ساندبار', 'سایر اسپیکرها'],
    'گجت': ['ساعت و مچ‌بند هوشمند', 'مودم و شبکه', 'حافظه و ذخیره‌سازی', 'سایر گجت‌ها'],
    'گجت خانگی': [...homeTypes.map(([label]) => label), 'سایر گجت‌های خانگی']
  };
  // A dedicated subtype column takes priority. Existing sheet group names are
  // used when meaningful; generic labels are refined only by explicit text.
  const classify = (base, product) => {
    if (product.subcategory) return clean(product.subcategory);
    const text = `${product.group || ''} ${product.name}`;
    switch (base) {
      case 'یخچال': return firstMatch(text, fridgeRules);
      case 'لباسشویی': return capacity(product, 'کیلوگرم');
      case 'ظرفشویی': return capacity(product, 'نفره');
      case 'موبایل': case 'تبلت': return memory(product);
      case 'لپ تاپ': return firstMatch(text, [
        ['Core Ultra', /core\s*ultra|ultra\s*[579]/i], ['Core i9', /\bi9\b/i], ['Core i7', /\bi7\b/i],
        ['Core i5', /\bi5\b/i], ['Core i3', /\bi3\b/i], ['AMD Ryzen', /ryzen/i], ['Apple Silicon', /\bM[1-9]\b/i]
      ]);
      case 'اکسسوری': return firstMatch(text, accessoryRules, 'سایر اکسسوری‌ها');
      case 'شارژر': return firstMatch(text, [['پاوربانک', /پاوربانک|power\s*bank/i], ['شارژر خودرو', /فندکی|خودرو/], ['شارژر بی‌سیم', /بی\s*سیم|wireless|magsafe/i], ['شارژر دیواری', /دیواری|wall/i]], 'سایر شارژرها');
      case 'کنسول بازی': return firstMatch(text, [['پایه شارژ', /پایه\s*شارژ|charging\s*station/i], ['دسته بازی', /دسته\s*بازی|dualsense|controller/i], ['کنسول', /کنسول|play\s*station|xbox|nintendo/i]], 'سایر لوازم بازی');
      case 'اسپیکر': return firstMatch(text, [['پارتی‌باکس', /پارتی|party\s*box/i], ['ساندبار', /ساندبار|soundbar/i], ['قابل حمل', /قابل\s*حمل|portable/i]], 'سایر اسپیکرها');
      case 'گجت خانگی': return firstMatch(text, homeTypes, 'سایر گجت‌های خانگی');
      case 'گجت': return firstMatch(text, accessoryRules, clean(product.group) || 'سایر گجت‌ها');
      case 'تلویزیون': {
        const size = clean(product.name).match(/\b(\d{2,3})\s*(?:اینچ|inch)/i);
        return size ? `${size[1]} اینچ` : 'سایر اندازه‌ها';
      }
      default: return clean(product.group) || 'سایر مدل‌ها';
    }
  };

  function build(groups, catalog, categoryProducts) {
    const nodes = new Map();
    const add = (id, label, parent, matches, icon) => {
      const node = { id, label, parent, matches, icon, children: [] };
      nodes.set(id, node); if (parent) nodes.get(parent).children.push(id); return node;
    };
    add('همه', 'همه', null, () => true, 'grid');
    for (const group of groups.filter(group => group.name !== 'همه')) {
      const members = new Set(categoryProducts(group.name, catalog));
      add(group.name, group.name, 'همه', p => members.has(p));
      const bases = group.children.length ? group.children : [group.name];
      for (const base of bases) {
        if (base !== group.name) add(base, base, group.name, p => members.has(p) && p.category === base);
        // These categories open their products directly; capacity is product detail,
        // not a useful navigation level for this catalog.
        if (['موبایل', 'لپ تاپ', 'تبلت', 'تلویزیون', 'ظرفشویی', 'لباسشویی'].includes(base)) continue;
        const parent = nodes.get(base);
        const products = catalog.filter(parent.matches);
        const labels = [...(presets[base] || [])];
        for (const product of products) {
          const label = classify(base, product);
          if (!labels.some(value => key(value) === key(label))) labels.push(label);
        }
        if (!labels.length && base !== 'یخچال') labels.push('سایر مدل‌ها');
        if (base === 'گجت خانگی') {
          const sectionIds = new Map();
          for (const [label, types] of homeSections) {
            const id = `${base}::${label}`;
            add(id, label, base, p => parent.matches(p) && types.some(type => key(type) === key(classify(base, p))));
            sectionIds.set(label, id);
          }
          for (const label of labels) {
            const section = homeSections.find(([, types]) => types.some(type => key(type) === key(label)));
            add(`${base}::نوع::${label}`, label, section ? sectionIds.get(section[0]) : base, p => parent.matches(p) && key(classify(base, p)) === key(label));
          }
        } else {
          labels.sort((a, b) => a.localeCompare(b, 'fa', { numeric: true }));
          for (const label of labels) add(`${base}::${label}`, label, base, p => parent.matches(p) && key(classify(base, p)) === key(label));
        }
      }
    }
    return nodes;
  }
  return { build, classify };
})();
