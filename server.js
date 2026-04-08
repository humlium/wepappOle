const express = require('express');
const cors = require('cors');
const path = require('path');
const { insertReading, getLatest, getHistory } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

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

  const ts = timestamp || new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ');

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

app.listen(PORT, () => {
  console.log(`PM2.5 Dashboard running at http://localhost:${PORT}`);
});
