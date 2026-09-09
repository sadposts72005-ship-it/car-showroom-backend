const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { smartSearch } = require('./controllers/searchController');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS and JSON parsing
app.use(cors({ origin: '*' }));
app.use(express.json());

// Static uploads folder
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, 'car-' + uniqueSuffix + ext);
  }
});
const upload = multer({ storage });

// ---- In-Memory Data Store (works on Vercel read-only filesystem) ----
// Seed from local JSON files at startup; all writes update in-memory cache only.

let _carsCache = null;
let _bookingsCache = null;

function getCars() {
  if (_carsCache !== null) return _carsCache;
  try {
    const dataFilePath = path.join(__dirname, 'data', 'cars.json');
    const raw = fs.readFileSync(dataFilePath, 'utf8');
    _carsCache = JSON.parse(raw);
  } catch (err) {
    console.error('Error reading cars.json seed:', err);
    _carsCache = [];
  }
  return _carsCache;
}

function saveCars(cars) {
  _carsCache = cars;
  // Try to persist locally (works in dev, silently skipped on Vercel read-only FS)
  try {
    const dataFilePath = path.join(__dirname, 'data', 'cars.json');
    fs.writeFileSync(dataFilePath, JSON.stringify(cars, null, 2), 'utf8');
  } catch (_) {}
  return true;
}

function getBookings() {
  if (_bookingsCache !== null) return _bookingsCache;
  try {
    const bookingsFilePath = path.join(__dirname, 'data', 'bookings.json');
    if (fs.existsSync(bookingsFilePath)) {
      const raw = fs.readFileSync(bookingsFilePath, 'utf8');
      _bookingsCache = JSON.parse(raw);
    } else {
      _bookingsCache = [];
    }
  } catch (err) {
    console.error('Error reading bookings.json seed:', err);
    _bookingsCache = [];
  }
  return _bookingsCache;
}

function saveBookings(bookings) {
  _bookingsCache = bookings;
  // Try to persist locally (works in dev, silently skipped on Vercel read-only FS)
  try {
    const bookingsFilePath = path.join(__dirname, 'data', 'bookings.json');
    fs.writeFileSync(bookingsFilePath, JSON.stringify(bookings, null, 2), 'utf8');
  } catch (_) {}
  return true;
}

// ---------------- API Routes ----------------

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), totalCars: getCars().length });
});

// Get all cars with optional filters (?brand=BMW, ?offer=true)
app.get('/api/cars', (req, res) => {
  let cars = getCars();
  const { brand, offer, minPrice, maxPrice } = req.query;

  if (brand) {
    cars = cars.filter(c => c.brand.toLowerCase() === brand.toLowerCase());
  }
  if (offer === 'true') {
    cars = cars.filter(c => c.isOffer === true);
  }
  if (minPrice) {
    cars = cars.filter(c => c.price >= Number(minPrice));
  }
  if (maxPrice) {
    cars = cars.filter(c => c.price <= Number(maxPrice));
  }

  res.json({ success: true, count: cars.length, cars });
});

// Get single car details
app.get('/api/cars/:id', (req, res) => {
  const cars = getCars();
  const car = cars.find(c => c.id === req.params.id);
  if (!car) {
    return res.status(404).json({ success: false, message: 'السيارة غير موجودة' });
  }
  res.json({ success: true, car });
});

// Smart AI Search (ChatGPT style)
app.post('/api/search/smart', (req, res) => {
  const { query } = req.body;
  const cars = getCars();
  const result = smartSearch(cars, query);
  res.json({ success: true, ...result });
});

// Admin Login
app.post('/api/admin/login', (req, res) => {
  const { email, password } = req.body;

  // Default admin credentials (can be customized by owner)
  if (email === 'admin@carshowroom.com' && password === 'admin123') {
    return res.json({
      success: true,
      token: 'admin-token-' + Date.now(),
      admin: {
        name: 'مدير المعرض',
        email: 'admin@carshowroom.com',
        role: 'SUPER_ADMIN'
      }
    });
  }

  // Also accept simple admin/admin for easy demo testing
  if ((email === 'admin' || email === 'admin@gmail.com') && password === 'admin') {
    return res.json({
      success: true,
      token: 'admin-token-' + Date.now(),
      admin: {
        name: 'مدير المعرض',
        email: 'admin@carshowroom.com',
        role: 'SUPER_ADMIN'
      }
    });
  }

  return res.status(401).json({
    success: false,
    message: 'بيانات الدخول غير صحيحة. البريد أو كلمة المرور خاطئة.'
  });
});

// Upload car image
app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'لم يتم إرسال أي صورة' });
  }
  const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  res.json({ success: true, url: fileUrl, filename: req.file.filename });
});

// Add new car (Admin)
app.post('/api/cars', (req, res) => {
  const cars = getCars();
  const newCarData = req.body;

  const newCar = {
    id: 'car-' + Date.now(),
    brand: newCarData.brand || 'غير محدد',
    brandAr: newCarData.brandAr || newCarData.brand,
    model: newCarData.model || 'موديل غير محدد',
    year: parseInt(newCarData.year, 10) || new Date().getFullYear(),
    price: parseFloat(newCarData.price) || 0,
    originalPrice: parseFloat(newCarData.originalPrice) || parseFloat(newCarData.price) || 0,
    discount: parseFloat(newCarData.discount) || 0,
    isOffer: !!newCarData.isOffer,
    offerBadge: newCarData.offerBadge || (newCarData.isOffer ? 'عرض خاص' : null),
    color: newCarData.color || 'أسود ميتاليك',
    mileage: newCarData.mileage || '0 كم (زيرو)',
    transmission: newCarData.transmission || 'أوتوماتيك',
    fuelType: newCarData.fuelType || 'بنزين',
    horsepower: newCarData.horsepower || '200 حصان',
    acceleration: newCarData.acceleration || '6.5 ثانية (0-100 كم/س)',
    topSpeed: newCarData.topSpeed || '240 كم/س',
    engine: newCarData.engine || '2.0L Turbo',
    videoUrl: newCarData.videoUrl || null,
    images: Array.isArray(newCarData.images) && newCarData.images.length > 0
      ? newCarData.images
      : ['https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=1200&q=80'],
    description: newCarData.description || 'سيارة فاخرة بحالة ممتازة مجهزة بأعلى وسائل الأمان والراحة.',
    hotspots: Array.isArray(newCarData.hotspots) && newCarData.hotspots.length > 0
      ? newCarData.hotspots
      : [
          {
            id: 'engine-default',
            title: 'المحرك والأداء',
            subtitle: newCarData.horsepower || 'أداء رياضي قوي',
            description: 'محرك متطور يجمع بين القوة واستهلاك الوقود الاقتصادي.',
            x: 0.22,
            y: 0.55,
            category: 'performance',
            icon: 'speed'
          },
          {
            id: 'lights-default',
            title: 'المصابيح الذكية',
            subtitle: 'إضاءة Full LED ديناميكية',
            description: 'إضاءة أمامية ليزرية متكيفة مع وضعية الطريق والسرعة.',
            x: 0.15,
            y: 0.65,
            category: 'design',
            icon: 'lightbulb'
          },
          {
            id: 'interior-default',
            title: 'المقصورة الفاخرة',
            subtitle: 'شاشة رقمية ذكية مع تحكم كامل',
            description: 'مقاعد مريحة مكسوة بالجلد الفاخر ونظام ترفيهي متكامل.',
            x: 0.52,
            y: 0.45,
            category: 'tech',
            icon: 'desktop'
          }
        ]
  };

  cars.unshift(newCar);
  saveCars(cars);

  res.status(201).json({ success: true, car: newCar });
});

// Update car (Admin)
app.put('/api/cars/:id', (req, res) => {
  const cars = getCars();
  const index = cars.findIndex(c => c.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'السيارة غير موجودة' });
  }

  cars[index] = { ...cars[index], ...req.body, id: cars[index].id };
  saveCars(cars);

  res.json({ success: true, car: cars[index] });
});

// Delete car (Admin)
app.delete('/api/cars/:id', (req, res) => {
  let cars = getCars();
  const index = cars.findIndex(c => c.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'السيارة غير موجودة' });
  }

  const deletedCar = cars.splice(index, 1)[0];
  saveCars(cars);

  res.json({ success: true, message: 'تم حذف السيارة بنجاح', car: deletedCar });
});

// ---------------- Booking Routes ----------------

// Create a new booking (Customer)
app.post('/api/bookings', (req, res) => {
  const { customerName, customerPhone, preferredDate, notes, carId, carBrand, carModel, carPrice } = req.body;

  if (!customerName || !customerPhone) {
    return res.status(400).json({ success: false, message: 'الاسم ورقم الهاتف مطلوبان لإتمام الحجز' });
  }

  const bookings = getBookings();
  const newBooking = {
    id: 'booking-' + Date.now(),
    customerName: customerName.trim(),
    customerPhone: customerPhone.trim(),
    preferredDate: preferredDate ? preferredDate.trim() : null,
    notes: notes ? notes.trim() : '',
    carId: carId || null,
    carBrand: carBrand || 'سيارة غير محددة',
    carModel: carModel || '',
    carPrice: carPrice ? parseFloat(carPrice) : 0,
    status: 'جديد', // جديد, تم التواصل, مؤكد, ملغي
    createdAt: new Date().toISOString()
  };

  bookings.unshift(newBooking);
  saveBookings(bookings);

  res.status(201).json({ success: true, message: 'تم استلام طلب الحجز بنجاح', booking: newBooking });
});

// Get all bookings (Admin)
app.get('/api/bookings', (req, res) => {
  const bookings = getBookings();
  res.json({ success: true, count: bookings.length, bookings });
});

// Update booking status (Admin)
app.put('/api/bookings/:id', (req, res) => {
  const bookings = getBookings();
  const index = bookings.findIndex(b => b.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'طلب الحجز غير موجود' });
  }

  bookings[index] = { ...bookings[index], ...req.body, id: bookings[index].id };
  saveBookings(bookings);

  res.json({ success: true, message: 'تم تحديث حالة الحجز', booking: bookings[index] });
});

// Delete booking (Admin)
app.delete('/api/bookings/:id', (req, res) => {
  let bookings = getBookings();
  const index = bookings.findIndex(b => b.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'طلب الحجز غير موجود' });
  }

  const deleted = bookings.splice(index, 1)[0];
  saveBookings(bookings);

  res.json({ success: true, message: 'تم حذف الحجز بنجاح', booking: deleted });
});

// Statistics (Admin)
app.get('/api/stats', (req, res) => {
  const cars = getCars();
  const bookings = getBookings();
  const brands = [...new Set(cars.map(c => c.brand))];
  const offersCount = cars.filter(c => c.isOffer).length;
  const totalValue = cars.reduce((acc, c) => acc + (c.price || 0), 0);
  const newBookingsCount = bookings.filter(b => b.status === 'جديد').length;

  res.json({
    success: true,
    totalCars: cars.length,
    brandsCount: brands.length,
    offersCount,
    totalValue,
    brands,
    totalBookings: bookings.length,
    newBookingsCount
  });
});

// Start Server
const server = app.listen(PORT, () => {
  console.log(`🚗 Car Showroom Backend running on http://localhost:${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`⚠️ المنفذ ${PORT} مستخدم بالفعل من قبل عملية أخرى! قم بإغلاق التطبيق السابق أولاً.`);
  } else {
    console.error('Server error:', err);
  }
});
