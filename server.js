const express = require('express');
const cors = require('cors');
const path = require('path');
const { insertReading, getLatest, getHistory, getAllReadings } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
process.env.TZ = 'Asia/Bangkok';
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// POST /api/data — receive sensor data
app.post('/api/data', (req, res) => {
  const { device_name, location, pm25, temperature, humidity, battery, latitude, longitude, timestamp } = req.body;

  if (!location || pm25 === undefined || pm25 === null) {
    return res.status(400).json({ error: 'location and pm25 are required' });
  }
  if (typeof pm25 !== 'number') {
    return res.status(400).json({ error: 'pm25 must be a number' });
  }

  const ts = timestamp || new Date().toLocaleString('en-EN', { timeZone: 'Asia/Bangkok' }, { hour12: false }).replace('T', ' ');

  insertReading.run({
    device_name: device_name ? String(device_name) : null,
    location: String(location),
    pm25: Number(pm25),
    temperature: temperature !== undefined ? Number(temperature) : null,
    humidity: humidity !== undefined ? Number(humidity) : null,
    battery: battery !== undefined ? parseInt(battery) : null,
    latitude: latitude !== undefined ? Number(latitude) : null,
    longitude: longitude !== undefined ? Number(longitude) : null,
    timestamp: ts
  });

  res.json({ success: true, message: 'Data received' });
});

// GET /api/latest — latest reading per location
app.get('/api/latest', (req, res) => {
  const rows = getLatest.all();
  res.json(rows);
});

// GET /api/history?location=X&hours=24
app.get('/api/history', (req, res) => {
  const { location, hours = 24 } = req.query;
  if (!location) {
    return res.status(400).json({ error: 'location is required' });
  }
  const rows = getHistory.all({ location, hours: parseInt(hours) });
  res.json(rows);
});

// Parse any timestamp format stored in DB to milliseconds (local time)
function parseTimestampMs(ts) {
  if (!ts) return NaN;
  // ISO: 2026-03-28 14:44:40
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(ts)) {
    return new Date(ts.replace(' ', 'T')).getTime();
  }
  // Thai Buddhist Era: 15/4/2569 00:02:47  (D/M/BBBB HH:MM:SS)
  const thai = ts.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{2}:\d{2}:\d{2})$/);
  if (thai) {
    const ceYear = parseInt(thai[3]) - 543;
    return new Date(`${ceYear}-${thai[2].padStart(2,'0')}-${thai[1].padStart(2,'0')}T${thai[4]}`).getTime();
  }
  // US locale: 4/15/2026, 7:35:06 AM
  return new Date(ts).getTime();
}

// GET /api/export?start=YYYY-MM-DD&end=YYYY-MM-DD
app.get('/api/export', (req, res) => {
  const { start, end } = req.query;
  if (!start || !end) {
    return res.status(400).json({ error: 'start and end are required' });
  }

  const startMs = new Date(start + 'T00:00:00').getTime();
  const endMs   = new Date(end   + 'T23:59:59').getTime();

  const { location } = req.query;
  const all  = getAllReadings.all();
  const rows = all.filter(row => {
    const t = parseTimestampMs(row.timestamp);
    if (isNaN(t) || t < startMs || t > endMs) return false;
    if (location && row.location !== location) return false;
    return true;
  });

  const headers = ['timestamp', 'location', 'device_name', 'pm25', 'temperature', 'humidity', 'battery', 'latitude', 'longitude'];
  const csv = [
    headers.join(','),
    ...rows.map(row => headers.map(h => {
      const val = row[h] ?? '';
      return typeof val === 'string' && val.includes(',') ? `"${val}"` : val;
    }).join(','))
  ].join('\r\n');

  const safeLoc = location ? location.replace(/[^a-zA-Z0-9ก-๙_-]/g, '_') : 'all';
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="pm25_${safeLoc}_${start}_${end}.csv"`);
  res.send('\uFEFF' + csv); // BOM for Excel Thai support
});

app.listen(PORT, () => {
  console.log(`PM2.5 Dashboard running at http://localhost:${PORT}`);
});
