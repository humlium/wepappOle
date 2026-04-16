let chart = null;
let locations = [];
let activeLocation = null;
let leafletMap = null;
let markers = [];

const AQI_LEVELS = [
  { max: 12.0,  label: 'Good',                  cls: 'aqi-good',          color: '#4ade80' },
  { max: 35.4,  label: 'Moderate',              cls: 'aqi-moderate',      color: '#fbbf24' },
  { max: 55.4,  label: 'Unhealthy (Sensitive)', cls: 'aqi-sensitive',     color: '#fb923c' },
  { max: 150.4, label: 'Unhealthy',             cls: 'aqi-unhealthy',     color: '#f87171' },
  { max: Infinity, label: 'Very Unhealthy',     cls: 'aqi-very-unhealthy',color: '#c084fc' }
];

function getAqi(pm25) {
  return AQI_LEVELS.find(l => pm25 <= l.max) || AQI_LEVELS[AQI_LEVELS.length - 1];
}

function getBatteryClass(pct) {
  if (pct >= 50) return 'battery-good';
  if (pct >= 20) return 'battery-mid';
  return 'battery-low';
}

function formatDateTime(ts) {
  if (!ts) return '';
  const parts = ts.split(' ');
  if (parts.length === 2) return { date: parts[0], time: parts[1] };
  return { date: ts, time: '' };
}

// ---- CARDS ----
function renderCards(data) {
  const grid = document.getElementById('cards-grid');
  const noData = document.getElementById('no-data');

  if (!data || data.length === 0) {
    grid.innerHTML = '';
    noData.classList.remove('hidden');
    return;
  }
  noData.classList.add('hidden');
  locations = data.map(d => d.location);
  updateExportLocations();

  grid.innerHTML = data.map(row => {
    const aqi = getAqi(row.pm25);
    const dt = formatDateTime(row.timestamp);

    const batteryHtml = row.battery !== null && row.battery !== undefined
      ? `<span class="battery-badge ${getBatteryClass(row.battery)}">🔋 ${row.battery}%</span>`
      : '';

    const deviceHtml = row.device_name
      ? `<div class="card-device">🔧 ${row.device_name}</div>`
      : '';

    const tempHtml = row.temperature !== null && row.temperature !== undefined
      ? `<div class="metric"><span>🌡</span><span>อุณหภูมิ: <strong>${row.temperature.toFixed(1)}°C</strong></span></div>`
      : '';

    const humHtml = row.humidity !== null && row.humidity !== undefined
      ? `<div class="metric"><span>💧</span><span>ความชื้น: <strong>${row.humidity.toFixed(1)}%</strong></span></div>`
      : '';

    const dateHtml = dt.date
      ? `<div class="metric"><span>📅</span><span>${dt.date}</span></div>`
      : '';

    const timeHtml = dt.time
      ? `<div class="metric"><span>🕐</span><span>${dt.time}</span></div>`
      : '';

    return `
      <div class="card">
        <div class="card-header">
          <span class="card-location">📍 ${row.location}</span>
          ${batteryHtml}
        </div>
        ${deviceHtml}
        <div class="pm25-value" style="color:${aqi.color}">${row.pm25.toFixed(1)}</div>
        <div class="pm25-unit">µg/m³</div>
        <div class="aqi-badge ${aqi.cls}">${aqi.label}</div>
        <hr class="card-divider">
        <div class="card-metrics">
          ${tempHtml}
          ${humHtml}
          ${dateHtml}
          ${timeHtml}
        </div>
      </div>
    `;
  }).join('');
}

// ---- MAP ----
function makeMarkerIcon(color) {
  return L.divIcon({
    className: '',
    html: `<svg width="28" height="36" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 0C6.268 0 0 6.268 0 14c0 9.625 14 22 14 22S28 23.625 28 14C28 6.268 21.732 0 14 0z"
            fill="${color}" stroke="#fff" stroke-width="2"/>
      <circle cx="14" cy="14" r="5" fill="#fff" opacity="0.9"/>
    </svg>`,
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -36]
  });
}

function initMap() {
  if (leafletMap) return;
  leafletMap = L.map('map').setView([13.7563, 100.5018], 6);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
    maxZoom: 19
  }).addTo(leafletMap);
}

function updateMarkers(data) {
  if (!leafletMap) initMap();

  // Remove old markers
  markers.forEach(m => leafletMap.removeLayer(m));
  markers = [];

  const bounds = [];
  data.forEach(row => {
    if (row.latitude == null || row.longitude == null) return;

    const aqi = getAqi(row.pm25);
    const dt = formatDateTime(row.timestamp);

    const deviceLine = row.device_name
      ? `<div class="popup-device">🔧 ${row.device_name}</div>`
      : '';

    const batteryLine = row.battery != null
      ? `🔋 ${row.battery}%&nbsp;&nbsp;` : '';

    const tempLine = row.temperature != null
      ? `🌡 ${row.temperature.toFixed(1)}°C&nbsp;&nbsp;` : '';

    const humLine = row.humidity != null
      ? `💧 ${row.humidity.toFixed(1)}%` : '';

    const popup = `
      <div class="popup-title">📍 ${row.location}</div>
      ${deviceLine}
      <div class="popup-pm25" style="color:${aqi.color}">${row.pm25.toFixed(1)} µg/m³</div>
      <div><span class="aqi-badge ${aqi.cls}" style="font-size:0.7rem;padding:2px 8px">${aqi.label}</span></div>
      <div style="margin-top:6px">${tempLine}${humLine}</div>
      <div>${batteryLine}</div>
      <div style="color:#64748b;font-size:0.78rem;margin-top:4px">📅 ${dt.date} &nbsp;🕐 ${dt.time}</div>
    `;

    const marker = L.marker([row.latitude, row.longitude], { icon: makeMarkerIcon(aqi.color) })
      .addTo(leafletMap)
      .bindPopup(popup);

    markers.push(marker);
    bounds.push([row.latitude, row.longitude]);
  });

  if (bounds.length > 0) {
    leafletMap.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }
}

// ---- CHART ----
function renderTabs() {
  const container = document.getElementById('location-tabs');
  if (locations.length === 0) { container.innerHTML = ''; return; }
  if (!activeLocation || !locations.includes(activeLocation)) activeLocation = locations[0];
  container.innerHTML = locations.map(loc =>
    `<button class="tab-btn ${loc === activeLocation ? 'active' : ''}"
             onclick="selectTab('${loc}')">${loc}</button>`
  ).join('');
}

function selectTab(loc) {
  activeLocation = loc;
  renderTabs();
  loadHistory(loc);
}

async function loadHistory(location) {
  try {
    const res = await fetch(`/api/history?location=${encodeURIComponent(location)}&hours=24`);
    const data = await res.json();
    renderChart(location, data);
  } catch (e) {
    console.error('History fetch error', e);
  }
}

function renderChart(location, data) {
  const labels = data.map(d => {
    const dt = formatDateTime(d.timestamp);
    return dt.time || dt.date;
  });
  const pm25Values = data.map(d => d.pm25);
  const aqi = getAqi(data.length ? data[data.length - 1].pm25 : 0);

  const ctx = document.getElementById('pm25-chart').getContext('2d');
  if (chart) chart.destroy();

  chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: `PM2.5 (${location})`,
        data: pm25Values,
        borderColor: aqi.color,
        backgroundColor: aqi.color + '22',
        borderWidth: 2,
        pointRadius: data.length > 60 ? 0 : 3,
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#94a3b8' } } },
      scales: {
        x: { ticks: { color: '#64748b', maxTicksLimit: 12 }, grid: { color: '#1e2235' } },
        y: { ticks: { color: '#64748b' }, grid: { color: '#1e2235' },
             title: { display: true, text: 'µg/m³', color: '#64748b' } }
      }
    }
  });
}

// ---- MAIN FETCH ----
async function fetchLatest() {
  try {
    const res = await fetch('/api/latest');
    const data = await res.json();
    renderCards(data);
    updateMarkers(data);
    renderTabs();
    if (activeLocation) loadHistory(activeLocation);

    const now = new Date().toLocaleString('th-TH');
    document.getElementById('last-updated').textContent = `อัปเดตล่าสุด: ${now}`;
  } catch (e) {
    document.getElementById('last-updated').textContent = 'เชื่อมต่อไม่ได้';
    console.error('Fetch error', e);
  }
}

// ---- EXPORT ----
function initExportDates() {
  const today = new Date();
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 7);

  const fmt = d => d.toISOString().slice(0, 10);
  document.getElementById('export-start').value = fmt(sevenDaysAgo);
  document.getElementById('export-end').value   = fmt(today);
}

function updateExportLocations() {
  const sel = document.getElementById('export-location');
  const prev = sel.value;
  sel.innerHTML = '<option value="">ทุก Station</option>' +
    locations.map(loc => `<option value="${loc}">${loc}</option>`).join('');
  if (prev && locations.includes(prev)) sel.value = prev;
}

function exportCSV() {
  const location = document.getElementById('export-location').value;
  const start    = document.getElementById('export-start').value;
  const end      = document.getElementById('export-end').value;

  if (!start || !end) { alert('กรุณาเลือกช่วงวันที่'); return; }
  if (start > end) { alert('วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด'); return; }

  let url = `/api/export?start=${start}&end=${end}`;
  if (location) url += `&location=${encodeURIComponent(location)}`;
  window.location.href = url;
}

initMap();
initExportDates();
fetchLatest();
setInterval(fetchLatest, 10000);
