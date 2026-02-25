import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');
  const radius = searchParams.get('radius'); // in miles

  if (!lat || !lng || !radius) {
    return NextResponse.json({ error: 'Missing required parameters (lat, lng, radius)' }, { status: 400 });
  }

  const radiusInMeters = parseFloat(radius) * 1609.34;
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  if (apiKey) {
    try {
      // Legacy Google Places API - Nearby Search
      const searchUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radiusInMeters}&keyword=business&key=${apiKey}`;
      const searchResponse = await fetch(searchUrl);
      const searchData = await searchResponse.json();

      if (searchData.status !== 'OK' && searchData.status !== 'ZERO_RESULTS') {
        throw new Error(`Google API search responded with status: ${searchData.status}. Error: ${searchData.error_message || ''}`);
      }

      // The legacy API requires a separate Place Details call to fetch the `website` and `formatted_phone_number` for each place.
      // We will slice the results to 10 to limit concurrent API calls and respect rate limits.
      const rawPlaces = (searchData.results || []).slice(0, 10);

      const detailedPlacesPromises = rawPlaces.map(async (place: any) => {
        if (!place.place_id) return place;
        try {
          const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,formatted_address,website,formatted_phone_number,types&key=${apiKey}`;
          const detailsRes = await fetch(detailsUrl);
          const detailsData = await detailsRes.json();
          if (detailsData.status === 'OK') {
            return { ...place, ...detailsData.result }; // Merge details into place
          }
          return place;
        } catch (err) {
          return place;
        }
      });

      const detailedPlaces = await Promise.all(detailedPlacesPromises);

      const formattedBusinesses = detailedPlaces.map((place: any, idx: number) => ({
        id: `google-${idx}`,
        name: place.name || 'Unknown Business',
        address: place.formatted_address || place.vicinity || 'No Address Provided',
        phone: place.formatted_phone_number || place.international_phone_number || 'No Phone',
        website: place.website || null,
        category: (place.types && place.types.length > 0) ? place.types[0] : 'Business',
      }));

      return NextResponse.json({ businesses: formattedBusinesses });

    } catch (error: any) {
      console.error('Error fetching places:', error);
      return NextResponse.json({
        error: error.message || 'Failed to fetch external businesses from Google API'
      }, { status: 400 });
    }
  }

  // Fallback Mock Data if no API KEY is provided
  const mockBusinesses = [
    {
      id: "mock-1",
      name: "O'Reilly's Vintage Plumbing",
      address: "123 Main St, Near You",
      phone: "(555) 123-4567",
      website: "http://example.com", // Intentionally http for legacy testing
      category: "plumber",
    },
    {
      id: "mock-2",
      name: "Modern Web Bakery",
      address: "456 Tech Avenue",
      phone: "(555) 987-6543",
      website: "https://vercel.com", // Modern site proxy 
      category: "bakery",
    },
    {
      id: "mock-3",
      name: "Downtown Auto Repairs",
      address: "789 Garage Lane",
      phone: "(555) 555-0000",
      website: null, // No website case
      category: "auto_repair",
    }
  ];

  return NextResponse.json({
    businesses: mockBusinesses,
    _notice: "Running in mock mode. Add GOOGLE_PLACES_API_KEY to .env to fetch real data."
  });
}
