const express = require('express');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const authRoutes = require('./modules/auth/authRoutes');
const adminRoutes = require('./modules/admin/adminRoutes');
const tambayanRoutes = require('./modules/tambayan/tambayanRoutes');
const lostFoundRoutes = require('./modules/lostFound/lostFoundRoutes');
const marketplaceRoutes = require('./modules/marketplace/marketplaceRoutes');
const { ensureMarketplaceTables } = require('./modules/marketplace/marketplaceController');

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://findr.dcism.org",
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());
app.use('/api/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/tambayan', tambayanRoutes);
app.use('/api/lost-found', lostFoundRoutes);
app.use('/api/marketplace', marketplaceRoutes);

app.get('/', (req, res) => {
  res.send('Findr API Server is running.');
});

app.listen(PORT, () => {
  console.log(`Findr backend server listening on port ${PORT}`);
  ensureMarketplaceTables();
});