export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  // IP detrás de proxy/CDN en Vercel
  const xfwd = req.headers['x-forwarded-for'];
  const ip = (Array.isArray(xfwd) ? xfwd[0] : (xfwd || '')).split(',')[0].trim()
           || req.socket?.remoteAddress
           || 'desconocida';

  // Geo por cabeceras de Vercel (si están disponibles)
  const h = req.headers;
  const geo = {
    country: h['x-vercel-ip-country'] || '',
    region:  h['x-vercel-ip-country-region'] || '',
    city:    h['x-vercel-ip-city'] || '',
    tz:      h['x-vercel-ip-timezone'] || ''
  };

  // (OPCIONAL) Completar geo con un servicio externo SOLO si lo activas
  // En Vercel añade: GEO_PROVIDER=ipapi  (si no, se omite)
  if ((!geo.country || !geo.city) && process.env.GEO_PROVIDER === 'ipapi' && ip && ip !== 'desconocida') {
    try {
      const r = await fetch(`https://ipapi.co/${ip}/json/`, { headers: { 'User-Agent': 'vercel-fn' } });
      if (r.ok) {
        const g = await r.json();
        geo.country ||= g.country_name || g.country || '';
        geo.region  ||= g.region || g.region_code || '';
        geo.city    ||= g.city || '';
        geo.tz      ||= g.timezone || '';
      }
    } catch { /* silencioso */ }
  }

  const token = process.env.TELEGRAM_TOKEN;
  const chat  = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return res.status(500).send('Missing TELEGRAM_TOKEN or TELEGRAM_CHAT_ID');

  const lines = [
    'ENTRANDO ECUADOR 🏆',
    `📍IP: ${ip}`,
    geo.country && `🌎País: ${geo.country}`,
    geo.region  && `🌎Región: ${geo.region}`,
    geo.city    && `🌎Ciudad: ${geo.city}`,
    geo.tz      && `🕣TZ: ${geo.tz}`,
  ].filter(Boolean);

  const message = lines.join('\n');

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text: message })
    });
    return res.status(204).end();
  } catch (e) {
    console.error('Telegram error:', e);
    return res.status(502).send('Telegram error');
  }
}
