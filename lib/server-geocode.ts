export async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'YourApp/1.0' } });
  if (!res.ok) return null;
  const data = await res.json();
  return data.display_name || null;
} 