import test from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import { AstrosphericAPI } from './AstrosphericAPI';

const logger = {
  info: () => undefined,
  verbose: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

test('AstrosphericAPI normalizes the V2 forecast schema', async () => {
  const originalPost = axios.post;

  try {
    axios.post = async (url: string, body: unknown) => {
      assert.equal(url, 'https://v2-api-public.astrospheric.com/api/GetForecastData');
      assert.deepEqual((body as any).Variables, ['Cloud', 'Seeing', 'Transparency']);

      return {
        status: 200,
        data: {
          TimeZone: 'UTC',
          Latitude: 42.0,
          Longitude: -71.0,
          HourlyForecast: [{
            UTCForecastHour: '2024-01-01T00:00:00Z',
            HourOffset: 0,
            Cloud: { ValueColor: '#123456', ActualValue: 12.5 },
            Seeing: { ValueColor: '#654321', ActualValue: 1.2 },
            Wind: { ValueColor: '#abcdef', ActualValue: 3.4 },
            Temperature: { ValueColor: '#fedcba', ActualValue: 9.8 },
            DewPoint: { ValueColor: '#ffffff', ActualValue: 2.1 },
            WindDirection: { ValueColor: '#bbbbbb', ActualValue: 180 },
            Transparency: { ValueColor: '#000000', ActualValue: 24 },
          }],
          APICreditCostOfCall: 15,
        }
      } as any;
    };

    const api = new AstrosphericAPI(logger as any, 'test-key');
    const forecast = await api.getForecast(42, -71);

    assert.equal(forecast.UTCStartTime, '2024-01-01T00:00:00Z');
    assert.equal(forecast.RDPS_CloudCover?.[0]?.Value?.ActualValue, 12.5);
    assert.equal(forecast.Astrospheric_Seeing?.[0]?.Value?.ActualValue, 1.2);
    assert.equal(forecast.RDPS_WindVelocity?.[0]?.Value?.ActualValue, 24);
    assert.equal(forecast.Astrospheric_Transparency?.[0]?.Value?.ActualValue, 24);
    assert.equal(forecast.RDPS_Temperature?.[0]?.Value?.ActualValue, 9.8);
    assert.equal(forecast.APICreditUsedToday, 15);
  } finally {
    axios.post = originalPost;
  }
});

test('AstrosphericAPI logs API credit values and warns when credits are low', async () => {
  const originalPost = axios.post;
  const calls: Array<{ level: 'info' | 'warn'; message: string }> = [];
  const testLogger = {
    info: (message: string) => calls.push({ level: 'info', message }),
    verbose: () => undefined,
    warn: (message: string) => calls.push({ level: 'warn', message }),
    error: () => undefined,
  };

  try {
    axios.post = async () => ({
      status: 200,
      data: {
        TimeZone: 'UTC',
        Latitude: 42.0,
        Longitude: -71.0,
        HourlyForecast: [{
          UTCForecastHour: '2024-01-01T00:00:00Z',
          HourOffset: 0,
          Cloud: { ValueColor: '#123456', ActualValue: 12.5 },
        }],
        APICreditCostOfCall: 465,
        APICreditsRemaining: 9000,
      },
    }) as any;

    const api = new AstrosphericAPI(testLogger as any, 'test-key');
    await api.getForecast(42, -71);

    assert.ok(calls.some((entry) => entry.level === 'info' && entry.message.includes('APICreditCostOfCall=465')));
    assert.ok(calls.some((entry) => entry.level === 'info' && entry.message.includes('APICreditsRemaining=9000')));
    assert.ok(calls.some((entry) => entry.level === 'warn' && entry.message.includes('APICreditsRemaining=9000') && entry.message.includes('below 10000')));
  } finally {
    axios.post = originalPost;
  }
});
