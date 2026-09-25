let currentData = null;
let map, tileLayer, currentMarker, weatherChart;
let bookmarks = JSON.parse(localStorage.getItem('weather_bookmarks')) || [];
let recentSearches = JSON.parse(localStorage.getItem('weather_recents')) || [];
let currentUnits = 'metric';

document.addEventListener('DOMContentLoaded', () => {
  initMap();
  loadCity("Bahawalpur");

  const searchInput = document.getElementById('cityInput');
  searchInput.addEventListener('input', handleAutocomplete);
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      hideAutocomplete();
      handleSearch();
    }
  });

  document.getElementById('searchBtn').addEventListener('click', () => {
    hideAutocomplete();
    handleSearch();
  });

  document.getElementById('locationBtn').addEventListener('click', getUserLocation);
  document.getElementById('bookmarkBtn').addEventListener('click', toggleBookmark);
  document.getElementById('notifyBtn').addEventListener('click', requestNotificationPermission);
  
  document.getElementById('unitC').addEventListener('click', () => switchUnit('metric'));
  document.getElementById('unitF').addEventListener('click', () => switchUnit('imperial'));

  document.querySelectorAll('.map-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.map-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      changeMapLayer(e.target.dataset.layer);
    });
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-wrapper')) hideAutocomplete();
  });
});

async function handleAutocomplete(e) {
  const query = e.target.value.trim();
  const dropdown = document.getElementById('autocompleteList');
  
  if (query.length < 2) {
    dropdown.classList.add('hidden');
    return;
  }

  const suggestions = await WeatherAPI.fetchCitySuggestions(query);
  if (!suggestions.length) {
    dropdown.classList.add('hidden');
    return;
  }

  dropdown.innerHTML = suggestions.map(s => `
    <div class="autocomplete-item" onclick="selectCity('${s.name}')">
      <i class="fa-solid fa-location-dot" style="color:#0284c7;"></i> ${s.name} <small style="color:#64748b;">${s.state ? s.state + ',' : ''} ${s.country}</small>
    </div>
  `).join('');
  dropdown.classList.remove('hidden');
}

function selectCity(city) {
  document.getElementById('cityInput').value = city;
  hideAutocomplete();
  loadCity(city);
}

function hideAutocomplete() {
  document.getElementById('autocompleteList').classList.add('hidden');
}

async function loadCity(city) {
  showLoading(true);
  try {
    currentData = await WeatherAPI.fetchCityData(city, currentUnits);
    saveRecentSearch(currentData.name);
    updateUI(currentData);
    updateMap(currentData.lat, currentData.lon);
    generateRecommendations(currentData);
    checkAlerts(currentData);
    updateChart(currentData.hourly);
    applyDynamicTheme(currentData.condition);
  } catch (err) {
    alert("Error: " + err.message);
  } finally {
    showLoading(false);
  }
}

function handleSearch() {
  const city = document.getElementById('cityInput').value.trim();
  if (city) loadCity(city);
}

function updateUI(data) {
  const unitSymbol = currentUnits === 'metric' ? '°C' : '°F';
  const windUnit = currentUnits === 'metric' ? 'km/h' : 'mph';

  document.getElementById('cityName').textContent = data.name;
  document.getElementById('weatherDesc').textContent = data.desc;
  document.getElementById('tempDisplay').textContent = `${data.temp}${unitSymbol}`;
  document.getElementById('humidityVal').textContent = data.humidity;
  document.getElementById('windVal').textContent = `${data.wind} ${windUnit}`;
  document.getElementById('uvVal').textContent = data.uv;
  document.getElementById('aqiVal').textContent = data.aqi;

  // Render 24-Hour Slider
  const hourlyContainer = document.getElementById('hourlyContainer');
  hourlyContainer.innerHTML = data.hourly.map(h => `
    <div class="hourly-item">
      <p class="h-time">${h.time}</p>
      <img src="https://openweathermap.org/img/wn/${h.icon}.png" alt="${h.desc}">
      <p class="h-temp">${h.temp}${unitSymbol}</p>
      <p class="h-pop"><i class="fa-solid fa-umbrella"></i> ${h.pop}%</p>
    </div>
  `).join('');

  // Render 5-Day Forecast
  const forecastGrid = document.getElementById('forecastContainer');
  forecastGrid.innerHTML = data.forecast.map(f => `
    <div class="forecast-item">
      <p class="fc-date">${f.date}</p>
      <img src="https://openweathermap.org/img/wn/${f.icon}.png" alt="${f.desc}" />
      <p class="fc-temp">${f.temp}${unitSymbol}</p>
      <p class="fc-desc">${f.desc}</p>
    </div>
  `).join('');

  const bookmarkIcon = document.querySelector('#bookmarkBtn i');
  bookmarkIcon.className = bookmarks.includes(data.name) ? 'fa-solid fa-bookmark' : 'fa-regular fa-bookmark';
  renderBookmarks();
  renderRecents();
}

// Chart.js Light Theme Configuration
function updateChart(hourlyData) {
  const ctx = document.getElementById('weatherChart').getContext('2d');
  const labels = hourlyData.map(h => h.time);
  const temps = hourlyData.map(h => h.temp);
  const rainPops = hourlyData.map(h => h.pop);

  if (weatherChart) weatherChart.destroy();

  weatherChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Temperature (' + (currentUnits === 'metric' ? '°C' : '°F') + ')',
          data: temps,
          borderColor: '#0284c7',
          backgroundColor: 'rgba(2, 132, 199, 0.12)',
          fill: true,
          tension: 0.4,
          borderWidth: 3,
          yAxisID: 'y'
        },
        {
          label: 'Rain Probability (%)',
          data: rainPops,
          borderColor: '#38bdf8',
          backgroundColor: 'rgba(56, 189, 248, 0.12)',
          fill: true,
          tension: 0.4,
          borderWidth: 2,
          borderDash: [4, 4],
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#0c4a6e', font: { family: 'Plus Jakarta Sans', weight: '700' } } }
      },
      scales: {
        x: { ticks: { color: '#64748b' }, grid: { color: 'rgba(2, 132, 199, 0.05)' } },
        y: { type: 'linear', position: 'left', ticks: { color: '#0284c7' }, grid: { color: 'rgba(2, 132, 199, 0.08)' } },
        y1: { type: 'linear', position: 'right', min: 0, max: 100, ticks: { color: '#38bdf8' }, grid: { drawOnChartArea: false } }
      }
    }
  });
}

function applyDynamicTheme(condition) {
  const body = document.body;
  body.className = '';
  const cond = condition.toLowerCase();
  
  if (cond.includes('rain') || cond.includes('drizzle')) body.classList.add('theme-rain');
  else if (cond.includes('clear')) body.classList.add('theme-clear');
  else if (cond.includes('cloud')) body.classList.add('theme-clouds');
  else body.classList.add('theme-default');
}

function saveRecentSearch(city) {
  if (!recentSearches.includes(city)) {
    recentSearches.unshift(city);
    if (recentSearches.length > 5) recentSearches.pop();
    localStorage.setItem('weather_recents', JSON.stringify(recentSearches));
  }
}

function renderRecents() {
  const container = document.getElementById('recentList');
  if (!container) return;
  if (!recentSearches.length) {
    container.innerHTML = `<p class="empty-msg">No recent searches.</p>`;
    return;
  }
  container.innerHTML = recentSearches.map(city => `
    <div class="recent-item" onclick="loadCity('${city}')">
      <span><i class="fa-solid fa-clock-rotate-left" style="color:#0284c7;"></i> ${city}</span>
    </div>
  `).join('');
}

function initMap() {
  map = L.map('map', { maxZoom: 18 }).setView([30.3753, 69.3451], 5);
  
  // Clean Esri Topo Base Map (No API Key, No 403 Block, High Quality)
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 18,
    attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ'
  }).addTo(map);

  changeMapLayer('clouds');
}

function updateMap(lat, lon) {
  map.setView([lat, lon], 8);
  if (currentMarker) map.removeLayer(currentMarker);
  currentMarker = L.marker([lat, lon]).addTo(map);
}

function changeMapLayer(layerType) {
  if (tileLayer) map.removeLayer(tileLayer);
  const layerMap = { 
    clouds: 'clouds_new', 
    precipitation: 'precipitation_new', 
    wind: 'wind_new', 
    temp: 'temp_new' 
  };
  tileLayer = L.tileLayer(`https://tile.openweathermap.org/map/${layerMap[layerType]}/{z}/{x}/{y}.png?appid=${API_KEY}`, {
    opacity: 0.65
  });
  tileLayer.addTo(map);
}

function generateRecommendations(data) {
  const list = document.getElementById('lifestyleList');
  list.innerHTML = '';
  const recs = [];
  
  if (data.uv > 5) recs.push({ icon: 'fa-sun', title: 'UV Protection', text: 'Wear Sunglasses & Sunscreen' });
  if (data.condition.toLowerCase().includes('rain')) recs.push({ icon: 'fa-umbrella', title: 'Rain Forecast', text: 'Carry an Umbrella' });
  if (data.aqi >= 4) recs.push({ icon: 'fa-mask-ventilator', title: 'AQI Alert', text: 'Wear a Mask outdoors' });
  
  recs.push({ icon: 'fa-person-running', title: 'Outdoor Activity', text: data.temp > 35 ? 'Extreme Heat. Limit outdoor activity.' : 'Good conditions for outdoor activities.' });

  recs.forEach(r => {
    list.innerHTML += `
      <div class="lifestyle-card">
        <h4><i class="fa-solid ${r.icon}" style="color:#0284c7;"></i> ${r.title}</h4>
        <p>${r.text}</p>
      </div>
    `;
  });
}

function checkAlerts(data) {
  const banner = document.getElementById('alertBanner');
  if (data.temp > 40 || data.wind > 50 || data.condition.toLowerCase().includes('thunderstorm')) {
    banner.classList.remove('hidden');
    document.getElementById('alertText').textContent = `Extreme Weather Alert for ${data.name}: ${data.desc.toUpperCase()}!`;
  } else {
    banner.classList.add('hidden');
  }
}

function toggleBookmark() {
  if (!currentData) return;
  const index = bookmarks.indexOf(currentData.name);
  if (index > -1) bookmarks.splice(index, 1);
  else bookmarks.push(currentData.name);
  
  localStorage.setItem('weather_bookmarks', JSON.stringify(bookmarks));
  updateUI(currentData);
}

function removeBookmark(cityName, event) {
  event.stopPropagation();
  bookmarks = bookmarks.filter(c => c !== cityName);
  localStorage.setItem('weather_bookmarks', JSON.stringify(bookmarks));
  if (currentData) updateUI(currentData);
  else renderBookmarks();
}

function renderBookmarks() {
  const container = document.getElementById('favoritesList');
  if (!bookmarks.length) {
    container.innerHTML = `<p class="empty-msg">No saved cities yet.</p>`;
    return;
  }
  container.innerHTML = bookmarks.map(city => `
    <div class="fav-item" onclick="loadCity('${city}')">
      <span><i class="fa-solid fa-location-dot" style="color:#0284c7;"></i> ${city}</span>
      <button class="delete-fav-btn" title="Remove" onclick="removeBookmark('${city}', event)">
        <i class="fa-solid fa-trash-can"></i>
      </button>
    </div>
  `).join('');
}

function getUserLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => loadCoords(pos.coords.latitude, pos.coords.longitude),
      () => alert("Location permission denied.")
    );
  }
}

async function loadCoords(lat, lon) {
  showLoading(true);
  try {
    currentData = await WeatherAPI.fetchDataByCoords(lat, lon, null, currentUnits);
    updateUI(currentData);
    updateMap(lat, lon);
    generateRecommendations(currentData);
    checkAlerts(currentData);
    updateChart(currentData.hourly);
    applyDynamicTheme(currentData.condition);
  } finally {
    showLoading(false);
  }
}

function switchUnit(unit) {
  if (currentUnits === unit) return;
  currentUnits = unit;
  document.getElementById('unitC').classList.toggle('active', unit === 'metric');
  document.getElementById('unitF').classList.toggle('active', unit === 'imperial');
  if (currentData) loadCity(currentData.name);
}

function showLoading(isLoading) {
  document.getElementById('loadingOverlay').classList.toggle('hidden', !isLoading);
}

function requestNotificationPermission() {
  if ('Notification' in window) Notification.requestPermission();
}