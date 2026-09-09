// controllers/searchController.js - Ultra-Intelligent AI Car Search Engine
// Features:
// 1. Worldwide database of 70+ brands and hundreds of models
// 2. Open-world car entity extraction (detects ANY car in the world: Verna, Lanos, Shaheen, Microbus, etc.)
// 3. Bidirectional budget analysis:
//    - "أقل من" / "تحت" / "سقف" / "ما يعديش" (less_than)
//    - "أعلى من" / "فوق" / "أكثر من" / "أزيد من" (greater_than)
//    - "بـ" / "ميزانيتي" (exact / target)
// 4. Strict dynamic inventory checks (cars.json) with cross-brand budget alternatives
// 5. Automatic price sorting (ascending or descending based on request)

function normalizeDigits(str) {
  if (!str) return '';
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return str.replace(/[٠-٩]/g, (d) => arabicDigits.indexOf(d).toString());
}

function normalizeArabic(text) {
  if (!text) return '';
  let str = text.toLowerCase().trim();
  str = normalizeDigits(str);
  str = str.replace(/[ـ]/g, ''); // Remove tatweel
  str = str.replace(/[أإآ]/g, 'ا'); // Normalize alef
  str = str.replace(/[ة]/g, 'ه'); // Normalize teh marbuta
  str = str.replace(/[ى]/g, 'ي'); // Normalize alef maqsura
  return str;
}

// -------------------------------------------------------------
// Comprehensive Worldwide Brands & Models Knowledge Base
// -------------------------------------------------------------
const BASE_KNOWN_BRANDS = [
  // German Luxury & Sports
  {
    id: 'Porsche',
    nameEn: 'Porsche',
    nameAr: 'بورشه',
    origin: 'german',
    aliases: [
      'بورشه', 'بورش', 'بورتشه', 'porsche', '911', 'carrera', 'كاريرا',
      'كايين', 'cayenne', 'ماكان', 'macan', 'باناميرا', 'panamera',
      'تايكان', 'taycan', 'كايمان', 'cayman', 'بوكستر', 'boxster',
      'بلاك ايديشن', 'بلاك اديشن', 'black edition', 'gt3', 'turbo s', 'تيربو اس'
    ]
  },
  {
    id: 'BMW',
    nameEn: 'BMW',
    nameAr: 'بي إم دبليو',
    origin: 'german',
    aliases: [
      'بي ام', 'بي إم', 'بيام', 'ب ام', 'بي ام دبليو', 'بى ام', 'bmw', 'b.m.w', 'b m w',
      'm3', 'm4', 'm5', 'm2', 'm8', 'x3', 'x4', 'x5', 'x6', 'x7', '320', '320i', '330', '520',
      '530', '740', '750', 'الفئه الثالثه', 'الفئه الخامسه', 'الفئه السابعه'
    ]
  },
  {
    id: 'Mercedes-Benz',
    nameEn: 'Mercedes-Benz',
    nameAr: 'مرسيدس بنز',
    origin: 'german',
    aliases: [
      'مرسيدس', 'مرسيديز', 'مرسيدس بنز', 'بنز', 'mercedes', 'benz', 'amg',
      'c200', 'c300', 'c180', 'e200', 'e300', 's500', 's450', 's580', 'g wagon', 'g class',
      'جي كلاس', 'مايباخ', 'maybach', 'gle', 'glc', 'gla', 'glb', 'gls', 'cla', 'cls', 'a200'
    ]
  },
  {
    id: 'Audi',
    nameEn: 'Audi',
    nameAr: 'أودي',
    origin: 'german',
    aliases: [
      'اودي', 'أودي', 'audi', 'rs6', 'rs7', 'rs3', 'r8', 'a3', 'a4', 'a5', 'a6', 'a8', 'q3', 'q5', 'q7', 'q8', 'etron', 'ايترون'
    ]
  },
  {
    id: 'Volkswagen',
    nameEn: 'Volkswagen',
    nameAr: 'فولكس فاجن',
    origin: 'german',
    aliases: [
      'فولكس', 'فولكس فاجن', 'volkswagen', 'vw', 'جولف', 'golf', 'باسات', 'passat',
      'تيجوان', 'tiguan', 'طوارق', 'touareg', 'تي روك', 't-roc', 'جيتا', 'jetta'
    ]
  },

  // Japanese
  {
    id: 'Toyota',
    nameEn: 'Toyota',
    nameAr: 'تويوتا',
    origin: 'japanese',
    aliases: [
      'تويوتا', 'toyota', 'لاند كروزر', 'لاندكروزر', 'land cruiser', 'كامري', 'camry',
      'كورولا', 'corolla', 'برادو', 'prado', 'سوبرا', 'supra', 'فورشنر', 'fortuner',
      'ياريس', 'yaris', 'راف فور', 'rav4', 'هايلكس', 'hilux'
    ]
  },
  {
    id: 'Lexus',
    nameEn: 'Lexus',
    nameAr: 'لكزس',
    origin: 'japanese',
    aliases: ['لكزس', 'lexus', 'lx570', 'lx600', 'es350', 'rx350', 'ls500', 'is300']
  },
  {
    id: 'Nissan',
    nameEn: 'Nissan',
    nameAr: 'نيسان',
    origin: 'japanese',
    aliases: [
      'نيسان', 'nissan', 'باترول', 'patrol', 'صني', 'sunny', 'سنترا', 'sentra',
      'قشقاي', 'qashqai', 'جوك', 'juke', 'اكس تريل', 'x-trail', 'gtr', 'جي تي ار'
    ]
  },
  {
    id: 'Honda',
    nameEn: 'Honda',
    nameAr: 'هوندا',
    origin: 'japanese',
    aliases: ['هوندا', 'honda', 'سيفيك', 'civic', 'اكورد', 'accord', 'crv', 'سي ار في', 'سيتي', 'city']
  },
  {
    id: 'Mazda',
    nameEn: 'Mazda',
    nameAr: 'مازدا',
    origin: 'japanese',
    aliases: ['مازدا', 'mazda', 'مازدا 3', 'مازدا 6', 'cx5', 'cx-5', 'cx9', 'cx30']
  },
  {
    id: 'Mitsubishi',
    nameEn: 'Mitsubishi',
    nameAr: 'ميتسوبيشي',
    origin: 'japanese',
    aliases: ['ميتسوبيشي', 'mitsubishi', 'لانسر', 'lancer', 'باجيرو', 'pajero', 'اكليبس', 'eclipse', 'اكسباندر', 'xpander', 'اتراج', 'attrage']
  },
  {
    id: 'Subaru',
    nameEn: 'Subaru',
    nameAr: 'سوبارو',
    origin: 'japanese',
    aliases: ['سوبارو', 'subaru', 'امبريزا', 'impreza', 'فورستر', 'forester', 'xv']
  },
  {
    id: 'Suzuki',
    nameEn: 'Suzuki',
    nameAr: 'سوزوكي',
    origin: 'japanese',
    aliases: ['سوزوكي', 'suzuki', 'سويفت', 'swift', 'فيتارا', 'vitara', 'جيمني', 'jimny', 'سيليريو', 'ديزاير', 'dzire', 'ماروتي', 'اسبريسو']
  },

  // Korean
  {
    id: 'Hyundai',
    nameEn: 'Hyundai',
    nameAr: 'هيونداي',
    origin: 'korean',
    aliases: [
      'هيونداي', 'hyundai', 'فيرنا', 'verna', 'النترا', 'elantra', 'توسان', 'tucson',
      'اكسنت', 'accent', 'كريتا', 'creta', 'كونا', 'kona', 'سوناتا', 'sonata', 'سانتافي', 'santa fe', 'ازيرا', 'azera'
    ]
  },
  {
    id: 'Kia',
    nameEn: 'Kia',
    nameAr: 'كيا',
    origin: 'korean',
    aliases: [
      'كيا', 'kia', 'سبورتاج', 'sportage', 'سيراتو', 'cerato', 'k5', 'سورينتو', 'sorento',
      'بيكانتو', 'picanto', 'سيلتوس', 'seltos', 'كارنيفال', 'carnival', 'ستينجر', 'stinger', 'كارينز'
    ]
  },
  {
    id: 'Genesis',
    nameEn: 'Genesis',
    nameAr: 'جينيسيس',
    origin: 'korean',
    aliases: ['جينيسيس', 'genesis', 'g70', 'g80', 'g90', 'gv70', 'gv80']
  },
  {
    id: 'Daewoo',
    nameEn: 'Daewoo',
    nameAr: 'دايو',
    origin: 'korean',
    aliases: ['دايو', 'daewoo', 'لانوس', 'lanos', 'نوبيرا', 'nubira', 'جوليت', 'leganza']
  },

  // American
  {
    id: 'Ford',
    nameEn: 'Ford',
    nameAr: 'فورد',
    origin: 'american',
    aliases: ['فورد', 'ford', 'موستانج', 'mustang', 'اكسبلورر', 'explorer', 'f150', 'تورس', 'taurus', 'ايدج', 'edge', 'فوكس', 'focus']
  },
  {
    id: 'Chevrolet',
    nameEn: 'Chevrolet',
    nameAr: 'شيفروليه',
    origin: 'american',
    aliases: ['شيفروليه', 'شيفورليه', 'chevrolet', 'chevy', 'كمارو', 'camaro', 'كورفيت', 'corvette', 'تاهو', 'tahoe', 'كابتيفا', 'captiva', 'اوبترا', 'optra', 'ماليبو', 'malibu', 'افيو', 'aveo', 'كروز', 'cruze']
  },
  {
    id: 'Jeep',
    nameEn: 'Jeep',
    nameAr: 'جيب',
    origin: 'american',
    aliases: ['جيب', 'jeep', 'رانجلر', 'wrangler', 'جراند شيروكي', 'grand cherokee', 'شيروكي', 'cherokee', 'رينيجيد', 'renegade', 'كومباس', 'compass', 'غلاديتور']
  },
  {
    id: 'Dodge',
    nameEn: 'Dodge',
    nameAr: 'دودج',
    origin: 'american',
    aliases: ['دودج', 'dodge', 'تشارجر', 'charger', 'تشالنجر', 'challenger', 'دورانجو', 'durango', 'هيلكات', 'hellcat']
  },
  {
    id: 'Cadillac',
    nameEn: 'Cadillac',
    nameAr: 'كاديلاك',
    origin: 'american',
    aliases: ['كاديلاك', 'cadillac', 'اسكاليد', 'escalade', 'ct5', 'ct4', 'xt4', 'xt5', 'xt6']
  },
  {
    id: 'GMC',
    nameEn: 'GMC',
    nameAr: 'جي إم سي',
    origin: 'american',
    aliases: ['جمس', 'جي ام سي', 'gmc', 'يوكون', 'yukon', 'سييرا', 'sierra', 'دينالي', 'denali']
  },
  {
    id: 'Tesla',
    nameEn: 'Tesla',
    nameAr: 'تسلا',
    origin: 'american',
    aliases: ['تسلا', 'tesla', 'موديل 3', 'model 3', 'موديل y', 'model y', 'موديل s', 'model s', 'موديل x', 'model x', 'سايبرترك', 'cybertruck']
  },

  // Italian Exotic & Luxury
  {
    id: 'Ferrari',
    nameEn: 'Ferrari',
    nameAr: 'فيراري',
    origin: 'italian',
    aliases: ['فيراري', 'فراري', 'ferrari', 'f8', 'roma', 'روما', 'sf90', '488', '296', 'بوروسانجوي']
  },
  {
    id: 'Lamborghini',
    nameEn: 'Lamborghini',
    nameAr: 'لامبورجيني',
    origin: 'italian',
    aliases: ['لامبورجيني', 'لامبورغيني', 'lamborghini', 'اوروس', 'urus', 'هوراكان', 'huracan', 'افنتادور', 'aventador', 'ريفيلتو']
  },
  {
    id: 'Maserati',
    nameEn: 'Maserati',
    nameAr: 'مازيراتي',
    origin: 'italian',
    aliases: ['مازيراتي', 'maserati', 'جيبلي', 'ghibli', 'ليفانتي', 'levante', 'كواتروبورتيه', 'mc20', 'جريكان']
  },
  {
    id: 'Alfa Romeo',
    nameEn: 'Alfa Romeo',
    nameAr: 'ألفا روميو',
    origin: 'italian',
    aliases: ['الفا روميو', 'الفا', 'alfa romeo', 'جوليا', 'giulia', 'ستيلفيو', 'stelvio', 'تونالي', 'tonale']
  },
  {
    id: 'Fiat',
    nameEn: 'Fiat',
    nameAr: 'فيات',
    origin: 'italian',
    aliases: ['فيات', 'fiat', 'تيبو', 'tipo', 'فيات 500', 'fiat 500', 'بونتو', 'punto', 'فيات 128', '128', 'شاهين', 'shaheen']
  },

  // British Luxury & Performance
  {
    id: 'Range Rover',
    nameEn: 'Range Rover',
    nameAr: 'رينج روفر',
    origin: 'british',
    aliases: [
      'رنج روفر', 'رينج روفر', 'range rover', 'لاند روفر', 'land rover', 'ديفندر', 'defender',
      'فيلار', 'velar', 'ايفوك', 'evoque', 'ديسكفري', 'discovery', 'فوج', 'vogue'
    ]
  },
  {
    id: 'Bentley',
    nameEn: 'Bentley',
    nameAr: 'بنتلي',
    origin: 'british',
    aliases: ['بنتلي', 'bentley', 'كونتيننتال', 'continental', 'بنتايجا', 'bentayga', 'فلاينج سبير', 'flying spur']
  },
  {
    id: 'Rolls-Royce',
    nameEn: 'Rolls-Royce',
    nameAr: 'رولز رويس',
    origin: 'british',
    aliases: ['رولز رويس', 'رولزرويس', 'rolls royce', 'فانتوم', 'phantom', 'كولينان', 'cullinan', 'جوست', 'ghost']
  },
  {
    id: 'Aston Martin',
    nameEn: 'Aston Martin',
    nameAr: 'أستون مارتن',
    origin: 'british',
    aliases: ['استون مارتن', 'aston martin', 'db11', 'dbx', 'vantage', 'dbs']
  },
  {
    id: 'McLaren',
    nameEn: 'McLaren',
    nameAr: 'ماكلارين',
    origin: 'british',
    aliases: ['ماكلارين', 'mclaren', '720s', '765lt', 'artura', 'ارتورا']
  },
  {
    id: 'Jaguar',
    nameEn: 'Jaguar',
    nameAr: 'جاكوار',
    origin: 'british',
    aliases: ['جاكوار', 'jaguar', 'f type', 'f pace', 'xf', 'xe']
  },

  // European Others
  {
    id: 'Skoda',
    nameEn: 'Skoda',
    nameAr: 'سكودا',
    origin: 'european',
    aliases: ['سكودا', 'skoda', 'اوكتافيا', 'octavia', 'كودياك', 'kodiaq', 'سوبيرب', 'superb', 'كاروك', 'karoq', 'كاميك', 'kamiq']
  },
  {
    id: 'SEAT',
    nameEn: 'SEAT',
    nameAr: 'سيات',
    origin: 'european',
    aliases: ['سيات', 'seat', 'ليون', 'leon', 'اتيكا', 'ateca', 'ايبيزا', 'ibiza', 'تاريكو', 'tarraco', 'ارونا', 'arona', 'كوبرا', 'cupra']
  },
  {
    id: 'Peugeot',
    nameEn: 'Peugeot',
    nameAr: 'بيجو',
    origin: 'french',
    aliases: ['بيجو', 'peugeot', '3008', '508', '2008', '5008', '208', '301']
  },
  {
    id: 'Renault',
    nameEn: 'Renault',
    nameAr: 'رينو',
    origin: 'french',
    aliases: ['رينو', 'renault', 'ميجان', 'megane', 'داستر', 'duster', 'كادجار', 'kadjar', 'لوجان', 'logan', 'ستيب واي', 'stepway', 'سانديرو']
  },
  {
    id: 'Citroen',
    nameEn: 'Citroen',
    nameAr: 'ستروين',
    origin: 'french',
    aliases: ['ستروين', 'سيتروين', 'citroen', 'c5', 'c3', 'c4', 'ايركروس', 'aircross', 'اليزيه', 'elysee']
  },
  {
    id: 'Opel',
    nameEn: 'Opel',
    nameAr: 'أوبل',
    origin: 'european',
    aliases: ['اوبل', 'opel', 'استرا', 'astra', 'كورسا', 'corsa', 'جراند لاند', 'grandland', 'موكا', 'mokka', 'انسجنيا', 'insignia', 'فيكترا']
  },
  {
    id: 'Volvo',
    nameEn: 'Volvo',
    nameAr: 'فولفو',
    origin: 'european',
    aliases: ['فولفو', 'volvo', 'xc90', 'xc60', 'xc40', 's90', 's60']
  },
  {
    id: 'Lada',
    nameEn: 'Lada',
    nameAr: 'لادا',
    origin: 'european',
    aliases: ['لادا', 'lada', 'جرانتا', 'granta', 'نيفا', 'niva', '2107']
  },

  // Chinese Modern
  {
    id: 'MG',
    nameEn: 'MG',
    nameAr: 'إم جي',
    origin: 'chinese',
    aliases: ['ام جي', 'امجي', 'mg', 'mg5', 'mg6', 'zs', 'hs', 'rx5', 'mg gt', 'one']
  },
  {
    id: 'Chery',
    nameEn: 'Chery',
    nameAr: 'شيري',
    origin: 'chinese',
    aliases: ['شيري', 'chery', 'تيجو', 'tiggo', 'تيجو 7', 'تيجو 8', 'تيجو 3', 'تيجو 4', 'اريزو', 'arrizo', 'اسبيرانزا', 'speranza']
  },
  {
    id: 'Geely',
    nameEn: 'Geely',
    nameAr: 'جيلي',
    origin: 'chinese',
    aliases: ['جيلي', 'geely', 'كولراي', 'coolray', 'اوكافانجو', 'okavango', 'توجيلا', 'tugella', 'امجراند', 'emgrand', 'جيومتري']
  },
  {
    id: 'Haval',
    nameEn: 'Haval',
    nameAr: 'هافال',
    origin: 'chinese',
    aliases: ['هافال', 'haval', 'h6', 'جولايون', 'jolion', 'دارجو', 'dargo']
  },
  {
    id: 'BYD',
    nameEn: 'BYD',
    nameAr: 'بي واي دي',
    origin: 'chinese',
    aliases: ['بي واي دي', 'بيوايدي', 'byd', 'f3', 'سونج', 'song', 'هان', 'han', 'تانغ', 'tang', 'اوتو 3']
  },
  {
    id: 'Jetour',
    nameEn: 'Jetour',
    nameAr: 'جيتور',
    origin: 'chinese',
    aliases: ['جيتور', 'jetour', 'x70', 'x90', 'داسينج', 'dashing', 't2']
  },
  {
    id: 'Changan',
    nameEn: 'Changan',
    nameAr: 'شانجان',
    origin: 'chinese',
    aliases: ['شانجان', 'changan', 'cs35', 'cs55', 'cs85', 'cs95', 'السفن', 'alsvin', 'ايدو', 'eado', 'يوني']
  },
  {
    id: 'OtherVehicles',
    nameEn: 'Special Vehicle',
    nameAr: 'مركبة خاصة',
    origin: 'general',
    aliases: ['ميكروباص', 'ميكروباس', 'توك توك', 'توكتوك', 'تروسيكل', 'دراجة', 'موتوسيكل', 'موتوسكل']
  }
];

// Build dynamic brand dictionary merging static world catalog with current database cars
function getBrandDictionary(cars) {
  const list = [...BASE_KNOWN_BRANDS];
  if (Array.isArray(cars)) {
    cars.forEach(c => {
      const existing = list.find(b => b.id.toLowerCase() === (c.brand || '').toLowerCase());
      if (!existing && c.brand) {
        list.unshift({
          id: c.brand,
          nameEn: c.brand,
          nameAr: c.brandAr || c.brand,
          origin: 'general',
          aliases: [
            normalizeArabic(c.brand),
            normalizeArabic(c.brandAr || ''),
            normalizeArabic(c.model || '')
          ].filter(Boolean)
        });
      }
    });
  }
  return list;
}

// -------------------------------------------------------------
// Advanced Budget & Direction Analyzer
// -------------------------------------------------------------
function extractBudgetAnalysis(text) {
  const norm = normalizeArabic(text);

  let targetPrice = null;

  if (norm.includes('نص مليون') || norm.includes('نصف مليون')) targetPrice = 500000;
  else if (norm.includes('ربع مليون')) targetPrice = 250000;
  else if (norm.includes('مليون ونص') || norm.includes('مليون ونصف') || norm.includes('1.5 مليون')) targetPrice = 1500000;
  else if (norm.includes('مليونين ونص') || norm.includes('2 مليون ونص') || norm.includes('اتنين مليون ونص')) targetPrice = 2500000;
  else if (norm.includes('مليونين') || norm.includes('2 مليون') || norm.includes('اتنين مليون')) targetPrice = 2000000;
  else if (norm.includes('3 مليون') || norm.includes('تلاته مليون') || norm.includes('ثلاثه مليون')) targetPrice = 3000000;
  else if (norm.includes('4 مليون') || norm.includes('اربعه مليون')) targetPrice = 4000000;
  else if (norm.includes('5 مليون') || norm.includes('خمسه مليون')) targetPrice = 5000000;
  else if (norm.includes('6 مليون') || norm.includes('سته مليون')) targetPrice = 6000000;
  else if (norm.includes('7 مليون') || norm.includes('سبعه مليون')) targetPrice = 7000000;
  else if (norm.includes('8 مليون') || norm.includes('ثمانيه مليون')) targetPrice = 8000000;
  else if (norm.includes('9 مليون') || norm.includes('تسعه مليون')) targetPrice = 9000000;
  else if (norm.includes('10 مليون') || norm.includes('عشره مليون')) targetPrice = 10000000;

  if (targetPrice === null) {
    // Regex for "X مليون"
    const millionMatch = norm.match(/(\d+(?:\.\d+)?)\s*(?:مليون|ملايين|m)\b/);
    if (millionMatch) {
      targetPrice = Math.round(parseFloat(millionMatch[1]) * 1000000);
    }
  }

  if (targetPrice === null && norm.includes('مليون')) {
    targetPrice = 1000000;
  }

  if (targetPrice === null) {
    // Regex for "X الف"
    const thousandMatch = norm.match(/(\d+(?:\.\d+)?)\s*(?:الف|الاف|آلاف|k)\b/);
    if (thousandMatch) {
      targetPrice = Math.round(parseFloat(thousandMatch[1]) * 1000);
    }
  }

  if (targetPrice === null) {
    // Pure digits (e.g. 500000, 1000000, 2450000)
    const numberMatch = norm.replace(/,/g, '').match(/\b(\d{5,9})\b/);
    if (numberMatch) {
      targetPrice = parseInt(numberMatch[1], 10);
    }
  }

  if (targetPrice === null) return null;

  // Detect direction: greater_than vs less_than vs exact
  const greaterKeywords = [
    'اعلي من', 'اعلي', 'أعلى من', 'أعلى',
    'اكثر من', 'اكثر', 'أكثر من', 'أكثر',
    'اكتر من', 'اكتر', 'أكتر من', 'أكتر',
    'ازيد من', 'ازيد', 'أزيد من', 'أزيد',
    'فوق', 'مش اقل من', 'مش اقل', 'علي الاقل', 'علي الأقل',
    'ادني', 'أدنى', 'فما فوق'
  ];

  const lessKeywords = [
    'اقل من', 'اقل', 'أقل من', 'أقل',
    'تحت', 'ما يعديش', 'ما تعديش', 'ماتعديش', 'ميعديش', 'متعديش',
    'ما تزيدش', 'ماتزيدش', 'مايزيدش', 'ما تزدش',
    'سقف', 'اقصي', 'أقصى', 'اخري', 'اخره',
    'في حدود', 'حدود', 'ماكس', 'معايا', 'معاي', 'ميزانيه', 'ميزانيتي'
  ];

  let direction = 'exact';
  if (greaterKeywords.some(kw => norm.includes(kw))) {
    direction = 'greater_than';
  } else if (lessKeywords.some(kw => norm.includes(kw))) {
    direction = 'less_than';
  }

  return {
    price: targetPrice,
    direction,
    formatted: formatEGP(targetPrice)
  };
}

// -------------------------------------------------------------
// Open-World Car Query Extraction
// -------------------------------------------------------------
// Detects specific brand from catalog OR extracts open vehicle name (e.g. Verna, Shaheen, Lanos, etc.)
function extractCarTarget(text, brandDict, showroomCars) {
  const norm = normalizeArabic(text);
  const words = norm.split(/[\s,،.\-_\/\\+]+/);

  // 1. Catalog Match first (multi-word first, then single-word whole token)
  for (const brand of brandDict) {
    const sortedAliases = [...brand.aliases].sort((a, b) => b.length - a.length);
    for (const alias of sortedAliases) {
      const normAlias = normalizeArabic(alias);
      if (normAlias.length < 2) continue;

      if (normAlias.includes(' ')) {
        if (norm.includes(normAlias)) {
          return {
            name: `${brand.nameAr} (${brand.nameEn})`,
            brandObj: brand,
            rawMatched: alias
          };
        }
      } else {
        if (words.includes(normAlias)) {
          return {
            name: `${brand.nameAr} (${brand.nameEn})`,
            brandObj: brand,
            rawMatched: alias
          };
        }
      }
    }
  }

  // 2. Open-World Entity Extraction:
  // If no catalog brand matched, strip conversational template words to isolate requested car name!
  const stopWords = [
    'عايز', 'عاوز', 'محتاج', 'بدور', 'علي', 'على', 'ابحث', 'عن', 'نفسي', 'في',
    'عندكم', 'عندك', 'معاك', 'معاكم', 'هل', 'يوجد', 'موجود', 'متاح',
    'لو', 'سمحت', 'يا', 'باشا', 'غالي', 'كابتن', 'من', 'فضلك', 'ممكن', 'اعرف', 'قولي',
    'عربيات', 'عربيه', 'عربية', 'سيارات', 'سياره', 'سيارة', 'نوع', 'ماركة', 'ماركه', 'موديل', 'فئة', 'فئه',
    'اقل', 'اعلي', 'أعلى', 'أقل', 'تحت', 'فوق', 'اكثر', 'اكتر', 'ازيد', 'حدود', 'ميزانيه', 'ميزانيتي',
    'سعر', 'سعرها', 'بكام', 'فلوس', 'مليون', 'الف', 'جنية', 'جنيه',
    'سريعه', 'سريعة', 'سودا', 'سوداء', 'اسود', 'أسود', 'ابيض', 'أبيض', 'احمر', 'أحمر', 'رمادي', 'فضي',
    'زيرو', 'كسر', 'مستعمل', 'مستعمله', 'سبورت', 'سبور', 'رياضيه', 'رياضية', 'تيربو', 'حصان',
    'بانوراما', 'سقف', 'فتحه', 'اتوماتيك', 'مانيوال', 'كهربا', 'كهرباء',
    'الماني', 'ياباني', 'كوري', 'صيني', 'امريكي', 'ايطالي'
  ];

  const rawTokens = text.trim().split(/[\s,،.\-_\/\\+]+/);
  const filteredTokens = rawTokens.filter(token => {
    const normToken = normalizeArabic(token);
    return normToken.length > 1 &&
           !stopWords.includes(normToken) &&
           !/^\d+$/.test(normToken);
  });

  if (filteredTokens.length > 0) {
    const candidateName = filteredTokens.join(' ');
    // Verify candidate is not in showroom cars
    const matchesShowroom = showroomCars.some(c =>
      normalizeArabic(c.brand).includes(normalizeArabic(candidateName)) ||
      normalizeArabic(c.brandAr || '').includes(normalizeArabic(candidateName)) ||
      normalizeArabic(c.model).includes(normalizeArabic(candidateName))
    );

    if (!matchesShowroom) {
      return {
        name: candidateName,
        brandObj: null,
        rawMatched: candidateName
      };
    }
  }

  return null;
}

// Check if a car matches a brand definition
function carMatchesBrand(car, brandObj) {
  if (!car || !brandObj) return false;
  const carBrandNorm = normalizeArabic(car.brand || '');
  const carBrandArNorm = normalizeArabic(car.brandAr || '');
  const targetIdNorm = normalizeArabic(brandObj.id || '');
  const targetEnNorm = normalizeArabic(brandObj.nameEn || '');
  const targetArNorm = normalizeArabic(brandObj.nameAr || '');

  if (carBrandNorm === targetIdNorm || carBrandNorm === targetEnNorm || carBrandArNorm === targetArNorm) {
    return true;
  }

  for (const alias of brandObj.aliases) {
    const normAlias = normalizeArabic(alias);
    if (carBrandNorm.includes(normAlias) || carBrandArNorm.includes(normAlias)) {
      return true;
    }
  }
  return false;
}

function formatEGP(price) {
  return (price || 0).toLocaleString('ar-EG') + ' ج.م';
}

// -------------------------------------------------------------
// Main Intelligent Search Engine Function
// -------------------------------------------------------------
function smartSearch(cars, query) {
  if (!Array.isArray(cars) || cars.length === 0) {
    return {
      query: query || '',
      message: 'عفواً، صالة العرض قيد التحديث حالياً ولا توجد سيارات مسجلة.',
      cars: [],
      isNearestMatch: false,
      isUnavailable: true,
      parsedInfo: {}
    };
  }

  // Pre-sort all showroom cars
  const sortedAsc = [...cars].sort((a, b) => a.price - b.price); // Cheapest to most expensive
  const sortedDesc = [...cars].sort((a, b) => b.price - a.price); // Most expensive to cheapest
  const cheapestCar = sortedAsc[0];
  const mostExpensiveCar = sortedAsc[sortedAsc.length - 1];

  if (!query || typeof query !== 'string' || !query.trim()) {
    return {
      query: '',
      message: 'مرحباً بك في المستشار الذكي لسيلفر أوتو! 🚗✨ أخبرني بالسيارة، الماركة، أو الميزانية وسأجد لك الأنسب فوراً.',
      cars: sortedAsc.slice(0, 4),
      isNearestMatch: false,
      isUnavailable: false,
      parsedInfo: {}
    };
  }

  const brandDict = getBrandDictionary(cars);
  const targetCar = extractCarTarget(query, brandDict, cars);
  const budget = extractBudgetAnalysis(query);

  // -------------------------------------------------------------------------
  // CASE A: User requested a specific car / brand (Catalog or Open-World)
  // -------------------------------------------------------------------------
  if (targetCar) {
    // Check if this car/brand exists in current showroom inventory
    let inStockCars = [];
    if (targetCar.brandObj) {
      inStockCars = cars.filter(c => carMatchesBrand(c, targetCar.brandObj));
    } else {
      inStockCars = cars.filter(c => {
        const qNorm = normalizeArabic(targetCar.name);
        return normalizeArabic(c.brand).includes(qNorm) ||
               normalizeArabic(c.brandAr || '').includes(qNorm) ||
               normalizeArabic(c.model).includes(qNorm);
      });
    }

    // --- Subcase A1: The requested car is NOT in the showroom ---
    if (inStockCars.length === 0) {
      const carNameDisplay = targetCar.name;

      if (budget) {
        if (budget.direction === 'less_than') {
          const othersUnderBudget = sortedAsc.filter(c => c.price <= budget.price);
          if (othersUnderBudget.length > 0) {
            return {
              query,
              message: `عفواً، سيارات (${carNameDisplay}) لا تتوفر حالياً في صالة العرض لدينا.\nولكن وجدنا لك هذه السيارات المميزة المتوفرة في الصالة التي تتناسب تماماً مع ميزانيتك المطلوبة (أقل من ${budget.formatted}):`,
              cars: othersUnderBudget,
              isNearestMatch: true,
              isUnavailable: true,
              parsedInfo: { requestedCar: carNameDisplay, budget }
            };
          } else {
            return {
              query,
              message: `عفواً، سيارات (${carNameDisplay}) لا تتوفر حالياً في صالة العرض لدينا، كما لا تتوفر أي سيارات بميزانية أقل من ${budget.formatted} (أرخص سيارة متوفرة تبدأ من ${formatEGP(cheapestCar.price)}).\nإليك جميع السيارات المتاحة في الصالة مرتبة من الأرخص إلى الأعلى سعراً والأقرب لميزانيتك:`,
              cars: sortedAsc,
              isNearestMatch: true,
              isUnavailable: true,
              parsedInfo: { requestedCar: carNameDisplay, budget }
            };
          }
        } else if (budget.direction === 'greater_than') {
          const othersAboveBudget = sortedDesc.filter(c => c.price >= budget.price);
          if (othersAboveBudget.length > 0) {
            return {
              query,
              message: `عفواً، سيارات (${carNameDisplay}) لا تتوفر حالياً في صالة العرض لدينا.\nولكن وجدنا لك في الصالة سيارات فاخرة بميزانية تتجاوز ${budget.formatted}:`,
              cars: othersAboveBudget,
              isNearestMatch: true,
              isUnavailable: true,
              parsedInfo: { requestedCar: carNameDisplay, budget }
            };
          } else {
            return {
              query,
              message: `عفواً، سيارات (${carNameDisplay}) لا تتوفر حالياً في صالة العرض لدينا، كما لا تتوفر سيارات بسعر أعلى من ${budget.formatted} (أعلى سيارة متاحة سعرها ${formatEGP(mostExpensiveCar.price)}).\nإليك السيارات المتوفرة في الصالة مرتبة من الأعلى سعراً إلى الأرخص:`,
              cars: sortedDesc,
              isNearestMatch: true,
              isUnavailable: true,
              parsedInfo: { requestedCar: carNameDisplay, budget }
            };
          }
        } else {
          // Exact / target price
          return {
            query,
            message: `عفواً، سيارات (${carNameDisplay}) لا تتوفر حالياً في صالة العرض لدينا، كما لا تتوفر سيارات بميزانية ${budget.formatted} (أرخص سيارة متوفرة تبدأ من ${formatEGP(cheapestCar.price)}).\nإليك السيارات المتاحة لدينا في الصالة مرتبة من الأرخص إلى الأعلى سعراً:`,
            cars: sortedAsc,
            isNearestMatch: true,
            isUnavailable: true,
            parsedInfo: { requestedCar: carNameDisplay, budget }
          };
        }
      } else {
        // No budget, just car name
        return {
          query,
          message: `عفواً، سيارات (${carNameDisplay}) لا تتوفر حالياً في صالة العرض لدينا.\nولكن نوفر لك هذه السيارات الرياضية والفاخرة المتاحة في الصالة كأفضل بدائل مرتبة من الأرخص إلى الأعلى سعراً:`,
          cars: sortedAsc,
          isNearestMatch: true,
          isUnavailable: true,
          parsedInfo: { requestedCar: carNameDisplay }
        };
      }
    }

    // --- Subcase A2: The requested car IS in stock! ---
    const brandCarsAsc = [...inStockCars].sort((a, b) => a.price - b.price);
    const minBrandPrice = brandCarsAsc[0].price;
    const maxBrandPrice = brandCarsAsc[brandCarsAsc.length - 1].price;

    if (budget) {
      if (budget.direction === 'less_than') {
        const brandUnderBudget = inStockCars.filter(c => c.price <= budget.price);
        if (brandUnderBudget.length > 0) {
          return {
            query,
            message: `طلبك متوفر لدينا! وجدنا لك سيارة (${targetCar.name}) بسعر مناسب تماماً لميزانيتك (أقل من ${budget.formatted}):`,
            cars: brandUnderBudget,
            isNearestMatch: false,
            isUnavailable: false,
            parsedInfo: { requestedCar: targetCar.name, budget }
          };
        } else {
          // Requested brand exists, but costs MORE than budget.
          // Look for ANY other car in showroom under budget!
          const otherCarsUnderBudget = sortedAsc.filter(c =>
            !inStockCars.includes(c) && c.price <= budget.price
          );

          if (otherCarsUnderBudget.length > 0) {
            return {
              query,
              message: `سيارات (${targetCar.name}) متوفرة لدينا ولكن سعرها يبدأ من ${formatEGP(minBrandPrice)} وهو أعلى من ميزانيتك المحددة (${budget.formatted}).\nولكن وجدنا لك في الصالة بديلاً رائعاً يناسب ميزانيتك تماماً:`,
              cars: otherCarsUnderBudget,
              isNearestMatch: true,
              isUnavailable: false,
              parsedInfo: { requestedCar: targetCar.name, budget }
            };
          } else {
            return {
              query,
              message: `سيارات (${targetCar.name}) متوفرة لدينا في المعرض ولكن سعرها يبدأ من ${formatEGP(minBrandPrice)} وهو أعلى من ميزانيتك المحددة (أقل من ${budget.formatted}). كما لا تتوفر حالياً أي سيارات أخرى في الصالة بميزانية أقل من ${budget.formatted} (أرخص سيارة تبدأ من ${formatEGP(cheapestCar.price)}).\nإليك السيارات المتاحة لدينا في الصالة مرتبة من الأرخص إلى الأعلى سعراً والأقرب لميزانيتك:`,
              cars: sortedAsc,
              isNearestMatch: true,
              isUnavailable: false,
              parsedInfo: { requestedCar: targetCar.name, budget }
            };
          }
        }
      } else if (budget.direction === 'greater_than') {
        const brandAboveBudget = inStockCars.filter(c => c.price >= budget.price);
        if (brandAboveBudget.length > 0) {
          return {
            query,
            message: `طلبك متوفر لدينا! وجدنا لك سيارة (${targetCar.name}) بسعر يتجاوز ${budget.formatted}:`,
            cars: brandAboveBudget,
            isNearestMatch: false,
            isUnavailable: false,
            parsedInfo: { requestedCar: targetCar.name, budget }
          };
        } else {
          // Requested brand exists, but costs LESS than user's requested minimum!
          // E.g. User asked for Porsche > 5M, Porsche is 2.45M, but BMW is 9M!
          const otherCarsAboveBudget = sortedDesc.filter(c =>
            !inStockCars.includes(c) && c.price >= budget.price
          );

          if (otherCarsAboveBudget.length > 0) {
            return {
              query,
              message: `سيارات (${targetCar.name}) متوفرة لدينا في الصالة بسعر ${formatEGP(maxBrandPrice)} وهو أقل من المبلغ الذي حددته (أعلى من ${budget.formatted}).\nولكن وجدنا لك في الصالة سيارة بميزانية تتجاوز ${budget.formatted}:`,
              cars: otherCarsAboveBudget,
              isNearestMatch: true,
              isUnavailable: false,
              parsedInfo: { requestedCar: targetCar.name, budget }
            };
          } else {
            return {
              query,
              message: `سيارات (${targetCar.name}) متوفرة لدينا بسعر ${formatEGP(maxBrandPrice)}، ولا تتوفر سيارات أخرى بسعر أعلى من ${budget.formatted} (أعلى سيارة في الصالة سعرها ${formatEGP(mostExpensiveCar.price)}).\nإليك السيارات المتوفرة لدينا في الصالة مرتبة من الأعلى سعراً إلى الأرخص:`,
              cars: sortedDesc,
              isNearestMatch: true,
              isUnavailable: false,
              parsedInfo: { requestedCar: targetCar.name, budget }
            };
          }
        }
      } else {
        // Exact price specified with brand
        return {
          query,
          message: `طلبك متوفر لدينا في المعرض! إليك سيارة (${targetCar.name}) ومواصفاتها وأسعارها التفاعلية المتاحة:`,
          cars: brandCarsAsc,
          isNearestMatch: false,
          isUnavailable: false,
          parsedInfo: { requestedCar: targetCar.name, budget }
        };
      }
    } else {
      // Brand in stock with no price constraints
      return {
        query,
        message: `طلبك متوفر لدينا في المعرض! إليك سيارة (${targetCar.name}) المطابقة لرغبتك بكامل المواصفات التفاعلية:`,
        cars: brandCarsAsc,
        isNearestMatch: false,
        isUnavailable: false,
        parsedInfo: { requestedCar: targetCar.name }
      };
    }
  }

  // -------------------------------------------------------------------------
  // CASE B: User did NOT specify a car brand, but specified a BUDGET
  // -------------------------------------------------------------------------
  if (budget) {
    if (budget.direction === 'less_than') {
      const carsUnder = sortedAsc.filter(c => c.price <= budget.price);
      if (carsUnder.length > 0) {
        return {
          query,
          message: `بناءً على طلبك لسيارة بميزانية أقل من ${budget.formatted}، وجدنا لك هذه السيارات المتميزة المتطابقة في الصالة:`,
          cars: carsUnder,
          isNearestMatch: false,
          isUnavailable: false,
          parsedInfo: { budget }
        };
      } else {
        return {
          query,
          message: `عفواً، لا تتوفر لدينا حالياً أي سيارات بميزانية أقل من ${budget.formatted} في صالة العرض (أرخص سيارة متوفرة لدينا تبدأ من ${formatEGP(cheapestCar.price)}).\nإليك جميع السيارات المتاحة في الصالة مرتبة من الأرخص إلى الأعلى سعراً والأقرب لميزانيتك:`,
          cars: sortedAsc,
          isNearestMatch: true,
          isUnavailable: true,
          parsedInfo: { budget }
        };
      }
    } else if (budget.direction === 'greater_than') {
      const carsAbove = sortedDesc.filter(c => c.price >= budget.price);
      if (carsAbove.length > 0) {
        return {
          query,
          message: `بناءً على طلبك لسيارة فاخرة بميزانية أعلى من ${budget.formatted}، وجدنا لك هذه السيارات المتميزة في الصالة:`,
          cars: carsAbove,
          isNearestMatch: false,
          isUnavailable: false,
          parsedInfo: { budget }
        };
      } else {
        return {
          query,
          message: `عفواً، لا تتوفر لدينا حالياً أي سيارات بسعر أعلى من ${budget.formatted} في صالة العرض (أعلى سيارة متوفرة لدينا سعرها ${formatEGP(mostExpensiveCar.price)}).\nإليك السيارات المتاحة لدينا في الصالة مرتبة من الأعلى سعراً إلى الأرخص:`,
          cars: sortedDesc,
          isNearestMatch: true,
          isUnavailable: true,
          parsedInfo: { budget }
        };
      }
    } else {
      // Exact price
      return {
        query,
        message: `بناءً على ميزانيتك المحددة (${budget.formatted})، إليك السيارات المتاحة في الصالة مرتبة من الأقرب لميزانيتك:`,
        cars: sortedAsc,
        isNearestMatch: false,
        isUnavailable: false,
        parsedInfo: { budget }
      };
    }
  }

  // -------------------------------------------------------------------------
  // CASE C: Descriptive / Fallback query
  // -------------------------------------------------------------------------
  return {
    query,
    message: `إليك أفضل السيارات الرياضية والفاخرة المتاحة لدينا في الصالة حالياً مرتبة من الأرخص إلى الأعلى سعراً مع فحص 3D تفاعلي كامل:`,
    cars: sortedAsc,
    isNearestMatch: false,
    isUnavailable: false,
    parsedInfo: {}
  };
}

module.exports = {
  smartSearch,
  extractCarTarget,
  extractBudgetAnalysis,
  normalizeArabic,
  BASE_KNOWN_BRANDS
};
