const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(bodyParser.json());
app.use(cors());

const dbPath = path.join(__dirname, 'ticketing.db');
const db = new sqlite3.Database('./data/ticketing.db');

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS pesanan (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nama TEXT NOT NULL,
      email TEXT NOT NULL,
      jumlah INTEGER NOT NULL,
      total REAL NOT NULL,
      tiket_code TEXT UNIQUE,
      tanggal DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS stok_tiket (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tersedia INTEGER DEFAULT 1000
    )
  `);

  db.run(`INSERT OR IGNORE INTO stok_tiket (id, tersedia) VALUES (1, 1000)`);
});

function generateTicketCode(id) {
  return `TKT-GRF-2025-${String(id).padStart(4, '0')}`;
}

app.post('/api/pesan-tiket', async (req, res) => {
  const { nama, email, jumlah } = req.body;
  const HARGA_TIKET = 50000;

  if (!nama || !email || !jumlah)
    return res.status(400).json({ success: false, error: 'Data tidak lengkap' });

  const qty = parseInt(jumlah);
  if (isNaN(qty) || qty <= 0)
    return res.status(400).json({ success: false, error: 'Jumlah tiket tidak valid' });

  try {
    const stokRow = await new Promise((resolve, reject) => {
      db.get('SELECT tersedia FROM stok_tiket WHERE id = 1', (err, row) =>
        err ? reject(err) : resolve(row)
      );
    });

    const tersedia = stokRow ? stokRow.tersedia : 0;
    if (tersedia < qty)
      return res.status(400).json({ success: false, error: `Stok tiket tidak cukup. Sisa: ${tersedia}` });

    await new Promise((resolve, reject) => {
      db.run('UPDATE stok_tiket SET tersedia = tersedia - ? WHERE id = 1', [qty], err =>
        err ? reject(err) : resolve()
      );
    });

    const tiketList = [];

    for (let i = 0; i < qty; i++) {
      const ticketId = await new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO pesanan (nama, email, jumlah, total) VALUES (?, ?, ?, ?)',
          [nama, email, 1, HARGA_TIKET],
          function (err) {
            if (err) reject(err);
            else resolve(this.lastID);
          }
        );
      });

      const tiketCode = generateTicketCode(ticketId);

      await new Promise((resolve, reject) => {
        db.run('UPDATE pesanan SET tiket_code = ? WHERE id = ?', [tiketCode, ticketId], err =>
          err ? reject(err) : resolve()
        );
      });

      tiketList.push({
        id: ticketId,
        nama,
        email,
        tiket_code: tiketCode,
        harga: HARGA_TIKET
      });
    }

    console.log(`✅ ${qty} tiket berhasil dibuat untuk ${nama}`);

    res.json({
      success: true,
      message: `Berhasil membeli ${qty} tiket untuk ${nama}`,
      total: qty * HARGA_TIKET,
      tiketList
    });
  } catch (err) {
    console.error('❌ Gagal memproses pemesanan:', err);
    res.status(500).json({ success: false, error: 'Terjadi kesalahan server' });
  }
});

app.get('/api/pesanan', (req, res) => {
  db.all('SELECT * FROM pesanan ORDER BY tanggal DESC', (err, rows) => {
    if (err)
      return res.status(500).json({ success: false, error: 'Error mengambil data' });
    res.json(rows);
  });
});

app.get('/api/stok', (req, res) => {
  db.get('SELECT tersedia FROM stok_tiket WHERE id = 1', (err, row) => {
    if (err)
      return res.status(500).json({ success: false, error: 'Error database' });
    res.json({ tersedia: row ? row.tersedia : 0 });
  });
});

app.get('/api/tiket/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id))
    return res.status(400).json({ success: false, error: 'ID tidak valid' });

  db.get('SELECT * FROM pesanan WHERE id = ?', [id], (err, row) => {
    if (err)
      return res.status(500).json({ success: false, error: 'Error database' });
    if (!row)
      return res.status(404).json({ success: false, error: 'Tiket tidak ditemukan' });

    if (row.tiket_code.startsWith('CANCELLED'))
      return res.json({ success: false, error: 'Tiket ini telah dibatalkan oleh admin.' });

    res.json({
      success: true,
      data: row,
      eventInfo: {
        namaEvent: 'GRF UKM Musik Undiksha 2025',
        tanggal: '20 Desember 2025',
        lokasi: 'Lap. Basket Kampus Tengah Undiksha',
        deskripsi: 'Konser musik Hardcore!'
      }
    });
  });
});

app.post('/api/reset', (req, res) => {
  db.serialize(() => {
    db.run('DELETE FROM pesanan');
    db.run("DELETE FROM sqlite_sequence WHERE name='pesanan'");
    db.run('UPDATE stok_tiket SET tersedia = 1000 WHERE id = 1');
    res.json({
      success: true,
      message: '✅ Semua data berhasil direset. ID tiket kembali ke 1 dan stok = 1000.'
    });
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server berjalan di http://10.10.10.127:${PORT}`);
});
