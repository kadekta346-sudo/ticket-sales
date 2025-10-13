README - Ticketing App (Local)

Struktur project:
ticketing-app/
├─ backend/
│  ├─ package.json
│  ├─ server.js
│  └─ ticketing.db (akan dibuat otomatis)
├─ frontend/
│  ├─ index.html
│  ├─ tiket.html
│  └─ admin.html

Cara jalankan:

1. Backend:
   - Buka terminal di folder backend
   - Jalankan:
     npm install
     npm start
   - Server berjalan di http://localhost:3000

2. Frontend:
   - Jalankan Live Server (VSCode) pada folder 'frontend' atau gunakan static server.
   - Live Server biasanya membuka: http://127.0.0.1:5500/frontend/index.html
   - Buka index.html via HTTP (bukan file://).

Catatan:
- Jika ingin backend juga melayani frontend, uncomment baris static serve di server.js
  dan akses frontend melalui http://localhost:3000/frontend/index.html
- Pastikan port 3000 dan 5500 tidak bentrok dengan layanan lain.
