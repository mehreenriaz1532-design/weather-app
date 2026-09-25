const API_KEY = "81954f1c9b8c1a7b6fd0f3f6108d6bdb";

class WeatherAPI {
  // Search Autocomplete Suggestions
  static async fetchCitySuggestions(query) {
    if (!query || query.length < 2) return [];
    const url = `https://api.openweathermap.org/geo/1.0/direct?q=${query}&limit=5&appid=${API_KEY}`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      return data.map(item => ({
        name: item.name,
        country: item.country,
        state: item.state || ''
      }));
    } catch {
      return [];
    }
  }

  static async fetchCityData(city, units = 'metric') {
    const geoUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${city}&limit=1&appid=${API_KEY}`;
    const geoRes = await fetch(geoUrl);
    const geoData = await geoRes.json();
    if (!geoData || !geoData.length) throw new Error("City not found");

    const { lat, lon, name } = geoData[0];
    return this.fetchDataByCoords(lat, lon, name, units);
  }

  static async fetchDataByCoords(lat, lon, customName = null, units = 'metric') {
    const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=${units}&appid=${API_KEY}`;
    const airUrl = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`;
    const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=${units}&appid=${API_KEY}`;

    const [weatherRes, airRes, forecastRes] = await Promise.all([
      fetch(weatherUrl),
      fetch(airUrl),
      fetch(forecastUrl)
    ]);

    if (!weatherRes.ok || !airRes.ok || !forecastRes.ok) throw new Error("Weather fetch failed");

    const weather = await weatherRes.json();
    const air = await airRes.json();
    const forecast = await forecastRes.json();

    // 24-Hour Forecast (8 intervals of 3 hours)
    const hourlyForecast = forecast.list.slice(0, 8).map(h => ({
      time: new Date(h.dt * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      temp: Math.round(h.main.temp),
      pop: Math.round((h.pop || 0) * 100),
      icon: h.weather[0].icon,
      desc: h.weather[0].main
    }));

    // 5-Day Forecast
    const dailyForecast = forecast.list.filter(item => item.dt_txt.includes("12:00:00")).slice(0, 5).map(f => ({
      date: new Date(f.dt * 1000).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      temp: Math.round(f.main.temp),
      icon: f.weather[0].icon,
      desc: f.weather[0].main
    }));

    return {
      name: customName || weather.name,
      lat,
      lon,
      temp: Math.round(weather.main.temp),
      humidity: weather.main.humidity,
      wind: Math.round(weather.wind.speed * (units === 'metric' ? 3.6 : 1)),
      condition: weather.weather[0].main,
      desc: weather.weather[0].description,
      aqi: air.list[0]?.main?.aqi || 1,
      uv: 5,
      hourly: hourlyForecast,
      forecast: dailyForecast
    };
  }
}