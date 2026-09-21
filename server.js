const express = require('express');
const cors    = require('cors');
const fs      = require('fs');
const path    = require('path');
const mongoose = require('mongoose');
const { smartSearch } = require('./controllers/searchController');

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '2mb' }));

// ── MongoDB ───────────────────────────────────────────────────────────────────
const MONGODB_URI = process.env.MONGODB_URI ||
  'mongodb+srv://sadposts72005_db_user:6b9-nZ9R_uk.rE4@cluster0.sovvyjz.mongodb.net/silver_showroom?retryWrites=true&w=majority&appName=Cluster0';

let isConnected = false;

async function connectToDatabase() {
  if (isConnected || mongoose.connection.readyState === 1) {
    isConnected = true;
    return;
  }
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 3000, // reduced from 6000
      connectTimeoutMS:        3000,
      maxPoolSize:             5,
    });
    isConnected = true;
    console.log('✅ MongoDB Atlas connected');
  } catch (err) {
    console.error('⚠️  MongoDB error:', err.message);
    isConnected = false;
  }
}
connectToDatabase();

// ── Mongoose Schemas ──────────────────────────────────────────────────────────
const CarSchema = new mongoose.Schema({
  id:            { type: String, required: true, unique: true },
  brand:         { type: String, default: 'غير محدد' },
  brandAr:       { type: String, default: 'غير محدد' },
  model:         { type: String, default: 'موديل غير محدد' },
  year:          { type: Number, default: () => new Date().getFullYear() },
  price:         { type: Number, default: 0 },
  originalPrice: { type: Number, default: 0 },
  discount:      { type: Number, default: 0 },
  isOffer:       { type: Boolean, default: false },
  offerBadge:    { type: String, default: null },
  color:         { type: String, default: 'أسود' },
  mileage:       { type: String, default: '0' },
  transmission:  { type: String, default: 'أوتوماتيك' },
  fuelType:      { type: String, default: 'بنزين' },
  horsepower:    { type: String, default: '200' },
  acceleration:  { type: String, default: '6.5' },
  topSpeed:      { type: String, default: '240 كم/س' },
  engine:        { type: String, default: '2.0L Turbo' },
  videoUrl:      { type: String, default: null },
  loopVideoUrl:  { type: String, default: null },
  images:        { type: [String], default: [] },
  description:   { type: String, default: '' },
  hotspots:      { type: Array, default: [] },
}, { timestamps: true });

const BookingSchema = new mongoose.Schema({
  id:            { type: String, required: true, unique: true },
  customerName:  { type: String, required: true },
  customerPhone: { type: String, required: true },
  preferredDate: { type: String, default: null },
  notes:         { type: String, default: '' },
  carId:         { type: String, default: null },
  carBrand:      { type: String, default: 'غير محددة' },
  carModel:      { type: String, default: '' },
  carPrice:      { type: Number, default: 0 },
  status:        { type: String, default: 'جديد' },
  createdAt:     { type: String, default: () => new Date().toISOString() },
});

const CarModel     = mongoose.models.Car     || mongoose.model('Car',     CarSchema);
const BookingModel = mongoose.models.Booking || mongoose.model('Booking', BookingSchema);

// ── Local File Fallback ───────────────────────────────────────────────────────
const DATA_CARS_PATH     = path.join(__dirname, 'data', 'cars.json');
const DATA_BOOKINGS_PATH = path.join(__dirname, 'data', 'bookings.json');

let _carsCache     = null;
let _bookingsCache = null;

function readLocalCars() {
  if (_carsCache !== null) return _carsCache;
  try { _carsCache = JSON.parse(fs.readFileSync(DATA_CARS_PATH, 'utf8')); }
  catch (_) { _carsCache = []; }
  return _carsCache;
}
function writeLocalCars(cars) {
  _carsCache = cars;
  try { fs.writeFileSync(DATA_CARS_PATH, JSON.stringify(cars, null, 2)); } catch (_) {}
}
function readLocalBookings() {
  if (_bookingsCache !== null) return _bookingsCache;
  try { _bookingsCache = JSON.parse(fs.readFileSync(DATA_BOOKINGS_PATH, 'utf8')); }
  catch (_) { _bookingsCache = []; }
  return _bookingsCache;
}
function writeLocalBookings(bookings) {
  _bookingsCache = bookings;
  try { fs.writeFileSync(DATA_BOOKINGS_PATH, JSON.stringify(bookings, null, 2)); } catch (_) {}
}

// ── In-memory GET /api/cars response cache (30 sec) ──────────────────────────
let _getCarsCache     = null;
let _getCarsCacheTime = 0;
const CARS_CACHE_TTL  = 30_000; // ms

function cleanCar(doc) {
  if (!doc) return doc;
  const { _id, __v, ...rest } = doc;
  return rest;
}

// ── Connect middleware ────────────────────────────────────────────────────────
app.use(async (req, res, next) => {
  await connectToDatabase();
  next();
});

// ── Routes ────────────────────────────────────────────────────────────────────

// Health
app.get('/api/health', async (req, res) => {
  let count = 0;
  try { count = isConnected ? await CarModel.countDocuments() : readLocalCars().length; }
  catch (_) { count = readLocalCars().length; }
  res.json({ status: 'ok', database: isConnected ? 'MongoDB' : 'Local', totalCars: count });
});

// GET all cars (with 30-sec in-memory cache)
app.get('/api/cars', async (req, res) => {
  const { brand, offer, minPrice, maxPrice } = req.query;
  const hasFilters = brand || offer || minPrice || maxPrice;

  // Use cache only for unfiltered requests
  if (!hasFilters && _getCarsCache && (Date.now() - _getCarsCacheTime) < CARS_CACHE_TTL) {
    return res.json({ success: true, count: _getCarsCache.length, cars: _getCarsCache });
  }

  let cars = [];
  if (isConnected) {
    try {
      const query = {};
      if (brand && brand !== 'الكل') query.brand = new RegExp('^' + brand + '$', 'i');
      if (offer === 'true')           query.isOffer = true;
      if (minPrice) query.price = { ...query.price, $gte: Number(minPrice) };
      if (maxPrice) query.price = { ...query.price, $lte: Number(maxPrice) };

      const docs = await CarModel.find(query).sort({ createdAt: -1 }).lean();
      cars = docs.map(cleanCar);
    } catch (_) { cars = readLocalCars(); }
  } else {
    cars = readLocalCars();
    if (brand && brand !== 'الكل') cars = cars.filter(c => c.brand.toLowerCase() === brand.toLowerCase());
    if (offer === 'true')           cars = cars.filter(c => c.isOffer === true);
    if (minPrice) cars = cars.filter(c => c.price >= Number(minPrice));
    if (maxPrice) cars = cars.filter(c => c.price <= Number(maxPrice));
  }

  if (!hasFilters) { _getCarsCache = cars; _getCarsCacheTime = Date.now(); }
  res.json({ success: true, count: cars.length, cars });
});

// GET single car
app.get('/api/cars/:id', async (req, res) => {
  let car = null;
  if (isConnected) {
    try { car = cleanCar(await CarModel.findOne({ id: req.params.id }).lean()); } catch (_) {}
  }
  if (!car) car = readLocalCars().find(c => c.id === req.params.id);
  if (!car) return res.status(404).json({ success: false, message: 'السيارة غير موجودة' });
  res.json({ success: true, car });
});

// Smart AI Search
app.post('/api/search/smart', async (req, res) => {
  const { query } = req.body;
  let cars = [];
  if (isConnected) {
    try { cars = (await CarModel.find().lean()).map(cleanCar); }
    catch (_) { cars = readLocalCars(); }
  } else { cars = readLocalCars(); }
  res.json({ success: true, ...smartSearch(cars, query) });
});

// Admin Login
app.post('/api/admin/login', (req, res) => {
  const { email, password } = req.body;
  const isValid =
    (email === 'admin@silverauto.com'  && password === 'Silver#Admin@2026!VIP') ||
    (email === 'admin@gtrcars.com'     && password === 'GTR#Admin@2026!VIP')    ||
    (email === 'admin@carshowroom.com' && password === 'Silver#Admin@2026!VIP');

  if (isValid) {
    return res.json({
      success: true,
      token: 'admin-token-' + Date.now(),
      admin: { name: 'مدير عام المعرض', email, role: 'SUPER_ADMIN' },
    });
  }
  res.status(401).json({ success: false, message: 'بيانات الدخول غير صحيحة' });
});

// POST add car
app.post('/api/cars', async (req, res) => {
  const d = req.body;
  const car = {
    id:            d.id || ('car-' + Date.now()),
    brand:         d.brand         || 'غير محدد',
    brandAr:       d.brandAr       || d.brand,
    model:         d.model         || 'موديل غير محدد',
    year:          parseInt(d.year, 10) || new Date().getFullYear(),
    price:         parseFloat(d.price)         || 0,
    originalPrice: parseFloat(d.originalPrice) || parseFloat(d.price) || 0,
    discount:      parseFloat(d.discount)      || 0,
    isOffer:       !!d.isOffer,
    offerBadge:    d.offerBadge || (d.isOffer ? 'عرض خاص' : null),
    color:         d.color        || 'أسود',
    mileage:       d.mileage      || '0',
    transmission:  d.transmission || 'أوتوماتيك',
    fuelType:      d.fuelType     || 'بنزين',
    horsepower:    d.horsepower   || '200',
    acceleration:  d.acceleration || '6.5',
    topSpeed:      d.topSpeed     || '240 كم/س',
    engine:        d.engine       || '2.0L Turbo',
    videoUrl:      d.videoUrl     || null,
    loopVideoUrl:  d.loopVideoUrl || null,
    images:        Array.isArray(d.images) && d.images.length > 0
      ? d.images
      : ['https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=1200&q=80'],
    description:   d.description  || 'سيارة فاخرة بحالة ممتازة.',
    hotspots:      Array.isArray(d.hotspots) && d.hotspots.length > 0
      ? d.hotspots
      : [
          { id: 'engine-default',   title: 'المحرك والأداء',   subtitle: d.horsepower || 'أداء قوي',     description: 'محرك متطور يجمع بين القوة والاقتصادية.', x: 0.22, y: 0.55, category: 'performance', icon: 'speed'    },
          { id: 'lights-default',   title: 'المصابيح الذكية',  subtitle: 'Full LED',                     description: 'إضاءة أمامية ليزرية متكيفة.',              x: 0.15, y: 0.65, category: 'design',      icon: 'lightbulb'},
          { id: 'interior-default', title: 'المقصورة الفاخرة', subtitle: 'شاشة رقمية ذكية',               description: 'مقاعد جلد فاخر ونظام ترفيه متكامل.',       x: 0.52, y: 0.45, category: 'tech',        icon: 'desktop'  },
        ],
  };

  // Invalidate cache
  _getCarsCache = null;

  if (isConnected) {
    try { await CarModel.findOneAndUpdate({ id: car.id }, car, { upsert: true, new: true }); }
    catch (err) { console.error('Save car error:', err.message); }
  }
  const local = readLocalCars();
  const idx = local.findIndex(c => c.id === car.id);
  idx >= 0 ? local[idx] = car : local.unshift(car);
  writeLocalCars(local);

  res.status(201).json({ success: true, car });
});

// PUT update car
app.put('/api/cars/:id', async (req, res) => {
  const update = { ...req.body, id: req.params.id };
  _getCarsCache = null;
  let updated = null;

  if (isConnected) {
    try { updated = cleanCar(await CarModel.findOneAndUpdate({ id: req.params.id }, update, { new: true }).lean()); }
    catch (err) { console.error('Update car error:', err.message); }
  }
  const local = readLocalCars();
  const idx = local.findIndex(c => c.id === req.params.id);
  if (idx >= 0) { local[idx] = { ...local[idx], ...update }; writeLocalCars(local); updated = updated || local[idx]; }
  if (!updated && idx === -1) return res.status(404).json({ success: false, message: 'السيارة غير موجودة' });
  res.json({ success: true, car: updated });
});

// DELETE car
app.delete('/api/cars/:id', async (req, res) => {
  _getCarsCache = null;
  let deleted = null;

  if (isConnected) {
    try { deleted = cleanCar(await CarModel.findOneAndDelete({ id: req.params.id }).lean()); }
    catch (err) { console.error('Delete car error:', err.message); }
  }
  const local = readLocalCars();
  const idx = local.findIndex(c => c.id === req.params.id);
  if (idx >= 0) { const [d] = local.splice(idx, 1); writeLocalCars(local); deleted = deleted || d; }
  if (!deleted && idx === -1) return res.status(404).json({ success: false, message: 'السيارة غير موجودة' });
  res.json({ success: true, message: 'تم الحذف', car: deleted });
});

// ── Bookings ──────────────────────────────────────────────────────────────────

app.post('/api/bookings', async (req, res) => {
  const { customerName, customerPhone, preferredDate, notes, carId, carBrand, carModel, carPrice } = req.body;
  if (!customerName || !customerPhone)
    return res.status(400).json({ success: false, message: 'الاسم ورقم الهاتف مطلوبان' });

  const clean = String(customerPhone).trim().replace(/\D/g, '');
  if (clean.length !== 11)
    return res.status(400).json({ success: false, message: `رقم الهاتف يجب أن يكون 11 رقماً` });

  const booking = {
    id:            req.body.id || ('booking-' + Date.now()),
    customerName:  customerName.trim(),
    customerPhone: clean,
    preferredDate: preferredDate ? preferredDate.trim() : null,
    notes:         notes         ? notes.trim()         : '',
    carId:         carId || null,
    carBrand:      carBrand || 'غير محددة',
    carModel:      carModel || '',
    carPrice:      carPrice  ? parseFloat(carPrice) : 0,
    status:        'جديد',
    createdAt:     new Date().toISOString(),
  };

  if (isConnected) {
    try { await BookingModel.findOneAndUpdate({ id: booking.id }, booking, { upsert: true, new: true }); }
    catch (err) { console.error('Save booking error:', err.message); }
  }
  const bks = readLocalBookings();
  const bi = bks.findIndex(b => b.id === booking.id);
  bi >= 0 ? bks[bi] = booking : bks.unshift(booking);
  writeLocalBookings(bks);
  _bookingsCache = bks;

  res.status(201).json({ success: true, message: 'تم استلام الحجز بنجاح', booking });
});

app.get('/api/bookings', async (req, res) => {
  let bookings = [];
  if (isConnected) {
    try { bookings = (await BookingModel.find().sort({ createdAt: -1 }).lean()).map(cleanCar); _bookingsCache = bookings; }
    catch (_) { bookings = readLocalBookings(); }
  } else { bookings = readLocalBookings(); }
  res.json({ success: true, count: bookings.length, bookings });
});

app.put('/api/bookings/:id', async (req, res) => {
  let updated = null;
  if (isConnected) {
    try { updated = cleanCar(await BookingModel.findOneAndUpdate({ id: req.params.id }, req.body, { new: true }).lean()); }
    catch (err) { console.error('Update booking error:', err.message); }
  }
  const bks = readLocalBookings();
  const idx = bks.findIndex(b => b.id === req.params.id);
  if (idx >= 0) { bks[idx] = { ...bks[idx], ...req.body }; writeLocalBookings(bks); updated = updated || bks[idx]; }
  if (!updated && idx === -1) return res.status(404).json({ success: false, message: 'الحجز غير موجود' });
  res.json({ success: true, message: 'تم التحديث', booking: updated });
});

app.delete('/api/bookings/:id', async (req, res) => {
  let deleted = null;
  if (isConnected) {
    try { deleted = cleanCar(await BookingModel.findOneAndDelete({ id: req.params.id }).lean()); }
    catch (err) { console.error('Delete booking error:', err.message); }
  }
  const bks = readLocalBookings();
  const idx = bks.findIndex(b => b.id === req.params.id);
  if (idx >= 0) { const [d] = bks.splice(idx, 1); writeLocalBookings(bks); deleted = deleted || d; }
  if (!deleted && idx === -1) return res.status(404).json({ success: false, message: 'الحجز غير موجود' });
  res.json({ success: true, message: 'تم الحذف', booking: deleted });
});

// Stats
app.get('/api/stats', async (req, res) => {
  let cars = [], bookings = [];
  if (isConnected) {
    try { cars = (await CarModel.find().lean()).map(cleanCar); bookings = (await BookingModel.find().lean()).map(cleanCar); }
    catch (_) { cars = readLocalCars(); bookings = readLocalBookings(); }
  } else { cars = readLocalCars(); bookings = readLocalBookings(); }

  const brands    = [...new Set(cars.map(c => c.brand))];
  const offersCount = cars.filter(c => c.isOffer).length;
  const totalValue  = cars.reduce((a, c) => a + (c.price || 0), 0);
  res.json({
    success: true,
    totalCars: cars.length, brandsCount: brands.length,
    offersCount, totalValue, brands,
    totalBookings: bookings.length,
    newBookingsCount: bookings.filter(b => b.status === 'جديد').length,
  });
});

// ── Start (local) / Export (Vercel) ──────────────────────────────────────────
if (!process.env.VERCEL) {
  app.listen(PORT, () => console.log(`🚗 Server on http://localhost:${PORT}`));
}
module.exports = app;
