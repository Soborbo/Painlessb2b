import type { APIRoute } from 'astro';
import { getCfEnv } from '../../lib/cf-env';

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const address = url.searchParams.get('address');
  const placeId = url.searchParams.get('place_id');

  const env = await getCfEnv();
  const apiKey = env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Google Maps API key not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (placeId) {
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=geometry,formatted_address,name,formatted_phone_number,website&key=${apiKey}`
      );
      const data = await res.json();
      if (data.status === 'OK' && data.result) {
        const r = data.result;
        return new Response(JSON.stringify({
          lat: r.geometry?.location?.lat ?? null,
          lng: r.geometry?.location?.lng ?? null,
          address: r.formatted_address ?? null,
          name: r.name ?? null,
          phone: r.formatted_phone_number ?? null,
          website: r.website ?? null,
        }), { headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ error: 'Place not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {
      return new Response(JSON.stringify({ error: 'Google Places API request failed' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  if (address) {
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`
      );
      const data = await res.json();
      if (data.status === 'OK' && data.results?.[0]) {
        const loc = data.results[0].geometry.location;
        return new Response(JSON.stringify({
          lat: loc.lat,
          lng: loc.lng,
          formatted_address: data.results[0].formatted_address,
        }), { headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ error: 'Address not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {
      return new Response(JSON.stringify({ error: 'Geocoding API request failed' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  return new Response(JSON.stringify({ error: 'Provide address or place_id parameter' }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  });
};

// Places Autocomplete proxy
export const POST: APIRoute = async ({ request }) => {
  const env = await getCfEnv();
  const apiKey = env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Google Maps API key not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { input, types } = body;
  if (!input) {
    return new Response(JSON.stringify({ predictions: [] }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const typeParam = types ? `&types=${encodeURIComponent(types)}` : '';
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&components=country:gb${typeParam}&key=${apiKey}`
    );
    const data = await res.json();

    const predictions = (data.predictions || []).map((p: any) => ({
      place_id: p.place_id,
      description: p.description,
    }));

    return new Response(JSON.stringify({ predictions }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Autocomplete API request failed' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
