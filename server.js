const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const mongoose = require('mongoose');
const { smartSearch } = require('./controllers/searchController');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS and JSON parsing
app.use(cors({ origin: '*' }));
app.use(express.json());

// Static uploads folder
const uploadsDir = path.join(__dirname, 'uploads');
try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
} catch (_) {}
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

// ---------------- MongoDB Atlas Setup ----------------
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://sadposts72005_db_user:6b9-nZ9R_uk.rE4@cluster0.sovvyjz.mongodb.net/silver_showroom?retryWrites=true&w=majority&appName=Cluster0';

let isConnected = false;
async function connectToDatabase() {
  if (isConnected || mongoose.connection.readyState === 1) {
    isConnected = true;
    return;
  }
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 6000,
    });
    isConnected = true;
    console.log('✅ Connected to MongoDB Atlas Cloud Database');
  } catch (err) {
    console.error('⚠️ MongoDB connection error:', err.message);
    isConnected = false;
  }
}

// Auto-connect on startup
connectToDatabase();

// MongoDB Schemas
const CarSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  brand: { type: String, default: 'غير محدد' },
  brandAr: { type: String, default: 'غير محدد' },
  model: { type: String, default: 'موديل غير محدد' },
  year: { type: Number, default: () => new Date().getFullYear() },
  price: { type: Number, default: 0 },
  originalPrice: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  isOffer: { type: Boolean, default: false },
  offerBadge: { type: String, default: null },
  color: { type: String, default: 'أسود ميتاليك' },
  mileage: { type: String, default: '0 كم (زيرو)' },
  transmission: { type: String, default: 'أوتوماتيك' },
  fuelType: { type: String, default: 'بنزين' },
  horsepower: { type: String, default: '200 حصان' },
  acceleration: { type: String, default: '6.5 ثانية (0-100 كم/س)' },
  topSpeed: { type: String, default: '240 كم/س' },
  engine: { type: String, default: '2.0L Turbo' },
  videoUrl: { type: String, default: null },
  images: { type: [String], default: [] },
  description: { type: String, default: '' },
  hotspots: { type: Array, default: [] }
}, { timestamps: true });

const BookingSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  customerName: { type: String, required: true },
  customerPhone: { type: String, required: true },
  preferredDate: { type: String, default: null },
  notes: { type: String, default: '' },
  carId: { type: String, default: null },
  carBrand: { type: String, default: 'سيارة غير محددة' },
  carModel: { type: String, default: '' },
  carPrice: { type: Number, default: 0 },
  status: { type: String, default: 'جديد' },
  createdAt: { type: String, default: () => new Date().toISOString() }
}, { timestamps: true });

const CarModel = mongoose.models.Car || mongoose.model('Car', CarSchema);
const BookingModel = mongoose.models.Booking || mongoose.model('Booking', BookingSchema);

// ---- Local File Storage Fallback & Mirror ----
let _carsCache = null;
let _bookingsCache = null;

function getLocalCars() {
  if (_carsCache !== null) return _carsCache;
  try {
    const dataFilePath = path.join(__dirname, 'data', 'cars.json');
    if (fs.existsSync(dataFilePath)) {
      const raw = fs.readFileSync(dataFilePath, 'utf8');
      _carsCache = JSON.parse(raw);
    } else {
      _carsCache = [];
    }
  } catch (err) {
    _carsCache = [];
  }
  return _carsCache;
}

function saveLocalCars(cars) {
  _carsCache = cars;
  try {
    const dataFilePath = path.join(__dirname, 'data', 'cars.json');
    fs.writeFileSync(dataFilePath, JSON.stringify(cars, null, 2), 'utf8');
  } catch (_) {}
}

function getLocalBookings() {
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
    _bookingsCache = [];
  }
  return _bookingsCache;
}

function saveLocalBookings(bookings) {
  _bookingsCache = bookings;
  try {
    const bookingsFilePath = path.join(__dirname, 'data', 'bookings.json');
    fs.writeFileSync(bookingsFilePath, JSON.stringify(bookings, null, 2), 'utf8');
  } catch (_) {}
}

// Middleware to ensure DB connection
app.use(async (req, res, next) => {
  await connectToDatabase();
  next();
});

// ---------------- API Routes ----------------

// Health check
app.get('/api/health', async (req, res) => {
  let count = 0;
  if (isConnected) {
    try {
      count = await CarModel.countDocuments();
    } catch (_) {
      count = getLocalCars().length;
    }
  } else {
    count = getLocalCars().length;
  }
  res.json({
    status: 'ok',
    database: isConnected ? 'MongoDB Atlas (Connected)' : 'Local File (Fallback)',
    time: new Date().toISOString(),
    totalCars: count
  });
});

// Get all cars with optional filters (?brand=BMW, ?offer=true)
app.get('/api/cars', async (req, res) => {
  const { brand, offer, minPrice, maxPrice } = req.query;
  let cars = [];

  if (isConnected) {
    try {
      const query = {};
      if (brand && brand !== 'الكل') {
        query.brand = new RegExp('^' + brand + '$', 'i');
      }
      if (offer === 'true') {
        query.isOffer = true;
      }
      if (minPrice || maxPrice) {
        query.price = {};
        if (minPrice) query.price.$gte = Number(minPrice);
        if (maxPrice) query.price.$lte = Number(maxPrice);
      }
      cars = await CarModel.find(query).sort({ createdAt: -1 }).lean();
      // Remove MongoDB internal _id and __v
      cars = cars.map(c => {
        const { _id, __v, ...rest } = c;
        return rest;
      });
      // Also update local cache
      _carsCache = cars;
    } catch (err) {
      console.error('Error fetching cars from MongoDB:', err);
      cars = getLocalCars();
    }
  } else {
    cars = getLocalCars();
    if (brand && brand !== 'الكل') {
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
  }

  res.json({ success: true, count: cars.length, cars });
});

// Get single car details
app.get('/api/cars/:id', async (req, res) => {
  let car = null;
  if (isConnected) {
    try {
      car = await CarModel.findOne({ id: req.params.id }).lean();
      if (car) {
        delete car._id;
        delete car.__v;
      }
    } catch (_) {}
  }
  if (!car) {
    const cars = getLocalCars();
    car = cars.find(c => c.id === req.params.id);
  }

  if (!car) {
    return res.status(404).json({ success: false, message: 'السيارة غير موجودة' });
  }
  res.json({ success: true, car });
});

// Smart AI Search (ChatGPT style)
app.post('/api/search/smart', async (req, res) => {
  const { query } = req.body;
  let cars = [];
  if (isConnected) {
    try {
      cars = await CarModel.find().lean();
      cars = cars.map(c => {
        const { _id, __v, ...rest } = c;
        return rest;
      });
    } catch (_) {
      cars = getLocalCars();
    }
  } else {
    cars = getLocalCars();
  }
  const result = smartSearch(cars, query);
  res.json({ success: true, ...result });
});

// Admin Login
app.post('/api/admin/login', (req, res) => {
  const { email, password } = req.body;

  // Strong Admin Credentials
  const isValidAdmin =
    (email === 'admin@silverauto.com' && password === 'Silver#Admin@2026!VIP') ||
    (email === 'admin@gtrcars.com' && password === 'GTR#Admin@2026!VIP') ||
    (email === 'admin@carshowroom.com' && password === 'Silver#Admin@2026!VIP');

  if (isValidAdmin) {
    return res.json({
      success: true,
      token: 'admin-token-' + Date.now(),
      admin: {
        name: 'مدير عام المعرض',
        email: email,
        role: 'SUPER_ADMIN'
      }
    });
  }

  return res.status(401).json({
    success: false,
    message: 'بيانات الدخول غير صحيحة. يرجى التحقق من البريد الإلكتروني وكلمة المرور المشفرة.'
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
app.post('/api/cars', async (req, res) => {
  const newCarData = req.body;

  const newCar = {
    id: newCarData.id || ('car-' + Date.now()),
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

  // 1. Save to MongoDB Atlas (Permanent Cloud Database)
  if (isConnected) {
    try {
      await CarModel.findOneAndUpdate(
        { id: newCar.id },
        newCar,
        { upsert: true, new: true }
      );
      console.log('✅ Car saved permanently to MongoDB Atlas:', newCar.id);
    } catch (err) {
      console.error('Error saving car to MongoDB:', err);
    }
  }

  // 2. Also save to local file mirror
  const cars = getLocalCars();
  const existingIdx = cars.findIndex(c => c.id === newCar.id);
  if (existingIdx >= 0) {
    cars[existingIdx] = newCar;
  } else {
    cars.unshift(newCar);
  }
  saveLocalCars(cars);

  res.status(201).json({ success: true, car: newCar });
});

// Update car (Admin)
app.put('/api/cars/:id', async (req, res) => {
  const updateData = { ...req.body, id: req.params.id };

  // 1. Update in MongoDB
  let updatedCar = null;
  if (isConnected) {
    try {
      updatedCar = await CarModel.findOneAndUpdate(
        { id: req.params.id },
        updateData,
        { new: true }
      ).lean();
      if (updatedCar) {
        delete updatedCar._id;
        delete updatedCar.__v;
      }
    } catch (err) {
      console.error('Error updating car in MongoDB:', err);
    }
  }

  // 2. Update local file mirror
  const cars = getLocalCars();
  const index = cars.findIndex(c => c.id === req.params.id);
  if (index >= 0) {
    cars[index] = { ...cars[index], ...updateData };
    saveLocalCars(cars);
    if (!updatedCar) updatedCar = cars[index];
  }

  if (!updatedCar && index === -1) {
    return res.status(404).json({ success: false, message: 'السيارة غير موجودة' });
  }

  res.json({ success: true, car: updatedCar });
});

// Delete car (Admin)
app.delete('/api/cars/:id', async (req, res) => {
  let deletedCar = null;

  // 1. Delete from MongoDB
  if (isConnected) {
    try {
      deletedCar = await CarModel.findOneAndDelete({ id: req.params.id }).lean();
      if (deletedCar) {
        delete deletedCar._id;
        delete deletedCar.__v;
      }
    } catch (err) {
      console.error('Error deleting car from MongoDB:', err);
    }
  }

  // 2. Delete from local file mirror
  const cars = getLocalCars();
  const index = cars.findIndex(c => c.id === req.params.id);
  if (index >= 0) {
    const localDel = cars.splice(index, 1)[0];
    saveLocalCars(cars);
    if (!deletedCar) deletedCar = localDel;
  }

  if (!deletedCar && index === -1) {
    return res.status(404).json({ success: false, message: 'السيارة غير موجودة' });
  }

  res.json({ success: true, message: 'تم حذف السيارة بنجاح', car: deletedCar });
});

// ---------------- Booking Routes ----------------

// Create a new booking (Customer)
app.post('/api/bookings', async (req, res) => {
  const { customerName, customerPhone, preferredDate, notes, carId, carBrand, carModel, carPrice } = req.body;

  if (!customerName || !customerPhone) {
    return res.status(400).json({ success: false, message: 'الاسم ورقم الهاتف مطلوبان لإتمام الحجز' });
  }

  // Strict 11-digit numeric phone validation
  const cleanPhone = String(customerPhone).trim().replace(/\D/g, '');
  if (cleanPhone.length !== 11) {
    return res.status(400).json({ 
      success: false, 
      message: `رقم الهاتف يجب أن يتكون من 11 رقماً بالضبط (أنت كتبت ${customerPhone.length} أرقام)` 
    });
  }

  const newBooking = {
    id: req.body.id || ('booking-' + Date.now()),
    customerName: customerName.trim(),
    customerPhone: cleanPhone,
    preferredDate: preferredDate ? preferredDate.trim() : null,
    notes: notes ? notes.trim() : '',
    carId: carId || null,
    carBrand: carBrand || 'سيارة غير محددة',
    carModel: carModel || '',
    carPrice: carPrice ? parseFloat(carPrice) : 0,
    status: 'جديد',
    createdAt: new Date().toISOString()
  };

  // 1. Save to MongoDB Atlas (Permanent Cloud Database)
  if (isConnected) {
    try {
      await BookingModel.findOneAndUpdate(
        { id: newBooking.id },
        newBooking,
        { upsert: true, new: true }
      );
      console.log('✅ Booking saved permanently to MongoDB Atlas:', newBooking.id);
    } catch (err) {
      console.error('Error saving booking to MongoDB:', err);
    }
  }

  // 2. Save to local file mirror
  const bookings = getLocalBookings();
  const existingIdx = bookings.findIndex(b => b.id === newBooking.id);
  if (existingIdx >= 0) {
    bookings[existingIdx] = newBooking;
  } else {
    bookings.unshift(newBooking);
  }
  saveLocalBookings(bookings);

  res.status(201).json({ success: true, message: 'تم استلام طلب الحجز بنجاح', booking: newBooking });
});

// Get all bookings (Admin)
app.get('/api/bookings', async (req, res) => {
  let bookings = [];
  if (isConnected) {
    try {
      bookings = await BookingModel.find().sort({ createdAt: -1 }).lean();
      bookings = bookings.map(b => {
        const { _id, __v, ...rest } = b;
        return rest;
      });
      _bookingsCache = bookings;
    } catch (err) {
      console.error('Error getting bookings from MongoDB:', err);
      bookings = getLocalBookings();
    }
  } else {
    bookings = getLocalBookings();
  }
  res.json({ success: true, count: bookings.length, bookings });
});

// Update booking status (Admin)
app.put('/api/bookings/:id', async (req, res) => {
  let updated = null;

  if (isConnected) {
    try {
      updated = await BookingModel.findOneAndUpdate(
        { id: req.params.id },
        req.body,
        { new: true }
      ).lean();
      if (updated) {
        delete updated._id;
        delete updated.__v;
      }
    } catch (err) {
      console.error('Error updating booking in MongoDB:', err);
    }
  }

  const bookings = getLocalBookings();
  const index = bookings.findIndex(b => b.id === req.params.id);
  if (index >= 0) {
    bookings[index] = { ...bookings[index], ...req.body };
    saveLocalBookings(bookings);
    if (!updated) updated = bookings[index];
  }

  if (!updated && index === -1) {
    return res.status(404).json({ success: false, message: 'طلب الحجز غير موجود' });
  }

  res.json({ success: true, message: 'تم تحديث حالة الحجز', booking: updated });
});

// Delete booking (Admin)
app.delete('/api/bookings/:id', async (req, res) => {
  let deleted = null;

  if (isConnected) {
    try {
      deleted = await BookingModel.findOneAndDelete({ id: req.params.id }).lean();
      if (deleted) {
        delete deleted._id;
        delete deleted.__v;
      }
    } catch (err) {
      console.error('Error deleting booking from MongoDB:', err);
    }
  }

  const bookings = getLocalBookings();
  const index = bookings.findIndex(b => b.id === req.params.id);
  if (index >= 0) {
    const localDel = bookings.splice(index, 1)[0];
    saveLocalBookings(bookings);
    if (!deleted) deleted = localDel;
  }

  if (!deleted && index === -1) {
    return res.status(404).json({ success: false, message: 'طلب الحجز غير موجود' });
  }

  res.json({ success: true, message: 'تم حذف الحجز بنجاح', booking: deleted });
});

// Statistics (Admin)
app.get('/api/stats', async (req, res) => {
  let cars = [];
  let bookings = [];

  if (isConnected) {
    try {
      cars = await CarModel.find().lean();
      bookings = await BookingModel.find().lean();
    } catch (_) {
      cars = getLocalCars();
      bookings = getLocalBookings();
    }
  } else {
    cars = getLocalCars();
    bookings = getLocalBookings();
  }

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

// Start Server for local development, export app for Vercel
if (!process.env.VERCEL) {
  const server = app.listen(PORT, () => {
    console.log(`🚗 Car Showroom Backend running on http://localhost:${PORT}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`⚠️ المنفذ ${PORT} مستخدم بالفعل من قبل عملية أخرى!`);
    } else {
      console.error('Server error:', err);
    }
  });
}

module.exports = app;
