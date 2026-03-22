import { NextResponse } from 'next/server';

// WMO Weather interpretation codes → emoji
const WMO_EMOJI: Record<number, string> = {
  0: '☀️',
  1: '🌤️', 2: '⛅', 3: '☁️',
  45: '🌫️', 48: '🌫️',
  51: '🌦️', 53: '🌦️', 55: '🌧️',
  56: '🌨️', 57: '🌨️',
  61: '🌧️', 63: '🌧️', 65: '🌧️',
  66: '🌨️', 67: '🌨️',
  71: '🌨️', 73: '🌨️', 75: '❄️',
  77: '❄️',
  80: '🌦️', 81: '🌧️', 82: '🌧️',
  85: '🌨️', 86: '❄️',
  95: '⛈️', 96: '⛈️', 99: '⛈️',
};

const WMO_DESC: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Rime fog',
  51: 'Light drizzle', 53: 'Drizzle', 55: 'Dense drizzle',
  56: 'Freezing drizzle', 57: 'Heavy freezing drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
  66: 'Freezing rain', 67: 'Heavy freezing rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Light showers', 81: 'Showers', 82: 'Heavy showers',
  85: 'Light snow showers', 86: 'Heavy snow showers',
  95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Heavy thunderstorm',
};

// Columbus, OH
const LAT = 39.96;
const LON = -82.99;

export async function GET() {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,weather_code,relative_humidity_2m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code&temperature_unit=celsius&timezone=America%2FNew_York&forecast_days=7`;

    const res = await fetch(url, { next: { revalidate: 3600 } });

    if (!res.ok) {
      return NextResponse.json({ error: 'Weather fetch failed' }, { status: 502 });
    }

    const data = await res.json();
    const current = data.current;
    const daily = data.daily;

    if (!current) {
      return NextResponse.json({ error: 'No weather data' }, { status: 502 });
    }

    const code = current.weather_code ?? 0;
    const emoji = WMO_EMOJI[code] || '🌡️';
    const temp = Math.round(current.temperature_2m);
    const description = WMO_DESC[code] || '';
    const high = daily?.temperature_2m_max?.[0] != null ? Math.round(daily.temperature_2m_max[0]) : '';
    const low = daily?.temperature_2m_min?.[0] != null ? Math.round(daily.temperature_2m_min[0]) : '';
    const rainChance = daily?.precipitation_probability_max?.[0] ?? '0';

    // Build daily forecast array (date → emoji + high)
    const forecast: { date: string; emoji: string; high: number; low: number }[] = [];
    if (daily?.time) {
      for (let i = 0; i < daily.time.length; i++) {
        const dc = daily.weather_code?.[i] ?? 0;
        forecast.push({
          date: daily.time[i],
          emoji: WMO_EMOJI[dc] || '🌡️',
          high: Math.round(daily.temperature_2m_max?.[i] ?? 0),
          low: Math.round(daily.temperature_2m_min?.[i] ?? 0),
        });
      }
    }

    return NextResponse.json({ emoji, temp, description, high, low, rainChance, forecast });
  } catch {
    return NextResponse.json({ error: 'Weather unavailable' }, { status: 502 });
  }
}
