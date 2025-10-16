const express = require('express');
const { Pool } = require('pg');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(bodyParser.json());
app.use(cors());

// ========================
// Koneksi ke PostgreSQL (pakai environment variable)
// ========================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ========================
// Buat tabel kalau belum ada
// ========================
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pesanan (
      id SERIAL PRIMARY KEY,
      nama TEXT NOT NULL,
      email TEXT NOT NULL,
      jumlah INTEGER NOT NULL,
      total REAL NOT NULL,
      tiket_code TEXT UNIQUE,
      tanggal TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS stok_tiket (
      id SERIAL PRIMARY KEY,
      tersedia INTEGER DEFAULT 1000
    );
  `);

  await pool.query(`
    INSERT INTO stok_tiket (id, tersedia)
    VALUES (1, 1000)
    ON CONFLICT (id) DO NOTHING;
  `);
}

initDB();

function generateTicketCode(id) {
  return `TKT-GRF-2025-${String(id).padStart(4, '0')}`;
}

// ========================
// API Pemesanan Tiket
// ========================
app.post('/api/pesan-tiket', async (req, res) => {
  const { nama, email, jumlah } = req.body;
  const HARGA_TIKET = 50000;

  if (!nama || !email || !jumlah)
    return res.status(400).json({ success: false, error: 'Data tidak lengkap' });

  const qty = parseInt(jumlah);
  if (isNaN(qty) || qty <= 0)
    return res.status(400).json({ success: false, error: 'Jumlah tiket tidak valid' });

  try {
    const stokRes = await pool.query('SELECT tersedia FROM stok_tiket WHERE id = 1');
    const tersedia = stokRes.rows[0].tersedia;

    if (tersedia < qty)
      return res.status(400).json({ success: false, error: `Stok tiket tidak cukup. Sisa: ${tersedia}` });

    await pool.query('UPDATE stok_tiket SET tersedia = tersedia - $1 WHERE id = 1', [qty]);

    const tiketList = [];

    for (let i = 0; i < qty; i++) {
      const insertRes = await pool.query(
        'INSERT INTO pesanan (nama, email, jumlah, total) VALUES ($1, $2, $3, $4) RETURNING id',
        [nama, email, 1, HARGA_TIKET]
      );

      const ticketId = insertRes.rows[0].id;
      const tiketCode = generateTicketCode(ticketId);

      await pool.query('UPDATE pesanan SET tiket_code = $1 WHERE id = $2', [tiketCode, ticketId]);

      tiketList.push({
        id: ticketId,
        nama,
        email,
        tiket_code: tiketCode,
        harga: HARGA_TIKET,
      });
    }

    res.json({
      success: true,
      message: `Berhasil membeli ${qty} tiket untuk ${nama}`,
      total: qty * HARGA_TIKET,
      tiketList,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Terjadi kesalahan server' });
  }
});

// ========================
// API Lain
// ========================
app.get('/api/stok', async (req, res) => {
  const stokRes = await pool.query('SELECT tersedia FROM stok_tiket WHERE id = 1');
  res.json({ tersedia: stokRes.rows[0].tersedia });
});

app.get('/api/pesanan', async (req, res) => {
  const result = await pool.query('SELECT * FROM pesanan ORDER BY tanggal DESC');
  res.json(result.rows);
});

app.get('/', (req, res) => {
  res.json({ message: '✅ Backend Vercel + Neon berjalan!' });
});

module.exports = app;
