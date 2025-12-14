const https = require('https');
const { URL } = require('url');

const DEFAULTS = {
  apiUrl: process.env.PWS_API_URL || 'https://api.weather.com/v2/pws/observations/current',
  apiKey: process.env.PWS_API_KEY || 'f1994ef8630f4028994ef8630fd02897',
  stationId: process.env.PWS_STATION_ID || 'IVILNI74',
  units: process.env.PWS_UNITS || 'm',
};

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`Unexpected status code ${res.statusCode}`));
        }

        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error.message}`));
        }
      });
    });

    req.on('error', reject);
  });
}

function buildUrl(config = {}) {
  const { apiUrl = DEFAULTS.apiUrl, apiKey = DEFAULTS.apiKey, stationId = DEFAULTS.stationId, units = DEFAULTS.units } = config;
  const url = new URL(apiUrl);
  url.searchParams.set('stationId', stationId);
  url.searchParams.set('format', 'json');
  url.searchParams.set('units', units);
  url.searchParams.set('apiKey', apiKey);
  return url.toString();
}

async function fetchWeatherSnapshot(config = {}) {
  const target = buildUrl(config);
  const payload = await httpGet(target);
  if (!payload || typeof payload !== 'object') {
    throw new Error('Weather payload was not an object');
  }

  const observation = payload.observations?.[0] || payload.data?.[0] || payload.readings?.[0] || payload;
  const metrics = observation.metric || observation;
  return {
    outsideTemperature: metrics.temp ?? metrics.temperature ?? metrics.outsideTemperature,
    windSpeed: metrics.windSpeed ?? metrics.wind_speed ?? metrics.wind,
    pressure: metrics.pressure ?? metrics.pressure_hpa ?? metrics.hpa,
    precipitation: metrics.precipRate ?? metrics.precipitation ?? metrics.rainRate ?? metrics.rain,
    solarRadiation: metrics.solarRadiation ?? metrics.solar_radiation ?? metrics.solar,
  };
}

module.exports = {
  fetchWeatherSnapshot,
  buildUrl,
};
