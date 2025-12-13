const https = require('https');
const { URL } = require('url');

const DEFAULTS = {
  apiUrl: process.env.PWS_API_URL || 'https://api.example.com/weather',
  apiKey: process.env.PWS_API_KEY || 'f1994ef8630f4028994ef8630fd02897',
  deviceId: process.env.PWS_DEVICE_ID || 'IVILNI74',
  deviceKey: process.env.PWS_DEVICE_KEY || 'lBadpl8H',
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
  const { apiUrl = DEFAULTS.apiUrl, apiKey = DEFAULTS.apiKey, deviceId = DEFAULTS.deviceId, deviceKey = DEFAULTS.deviceKey } = config;
  const url = new URL(apiUrl);
  url.searchParams.set('apiKey', apiKey);
  url.searchParams.set('deviceId', deviceId);
  url.searchParams.set('deviceKey', deviceKey);
  return url.toString();
}

async function fetchWeatherSnapshot(config = {}) {
  const target = buildUrl(config);
  const payload = await httpGet(target);
  if (!payload || typeof payload !== 'object') {
    throw new Error('Weather payload was not an object');
  }

  const readings = payload.data || payload.readings || payload;
  return {
    outsideTemperature: readings.outsideTemperature ?? readings.temperature ?? readings.temp,
    windSpeed: readings.windSpeed ?? readings.wind_speed ?? readings.wind,
    pressure: readings.pressure ?? readings.pressure_hpa ?? readings.hpa,
    precipitation: readings.precipitation ?? readings.rainRate ?? readings.rain,
    solarRadiation: readings.solarRadiation ?? readings.solar_radiation ?? readings.solar,
  };
}

module.exports = {
  fetchWeatherSnapshot,
  buildUrl,
};
