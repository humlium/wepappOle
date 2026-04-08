const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'pm25.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS readings (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    device_name TEXT,
    location    TEXT NOT NULL,
    pm25        REAL NOT NULL,
    temperature REAL,
    humidity    REAL,
    battery     INTEGER,
    latitude    REAL,
    longitude   REAL,
    timestamp   TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );
  CREATE INDEX IF NOT EXISTS idx_location_time ON readings(location, timestamp);
`);

// Migration: add new columns to existing DB (safe to run multiple times)
try { db.exec(`ALTER TABLE readings ADD COLUMN device_name TEXT`); } catch(e) {}
try { db.exec(`ALTER TABLE readings ADD COLUMN latitude REAL`); } catch(e) {}
try { db.exec(`ALTER TABLE readings ADD COLUMN longitude REAL`); } catch(e) {}

const insertReading = db.prepare(`
  INSERT INTO readings (device_name, location, pm25, temperature, humidity, battery, latitude, longitude, timestamp)
  VALUES (@device_name, @location, @pm25, @temperature, @humidity, @battery, @latitude, @longitude, @timestamp)
`);

const getLatest = db.prepare(`
  SELECT r.*
  FROM readings r
  INNER JOIN (
    SELECT location, MAX(timestamp) AS max_ts
    FROM readings
    GROUP BY location
  ) latest ON r.location = latest.location AND r.timestamp = latest.max_ts
  ORDER BY r.location
`);

const getHistory = db.prepare(`
  SELECT device_name, location, pm25, temperature, humidity, battery, latitude, longitude, timestamp
  FROM readings
  WHERE location = @location
    AND timestamp >= datetime('now', 'localtime', '-' || @hours || ' hours')
  ORDER BY timestamp ASC
`);

module.exports = { insertReading, getLatest, getHistory };
