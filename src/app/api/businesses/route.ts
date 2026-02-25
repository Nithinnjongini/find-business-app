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
      // Using Google Places API (New) Text Search
      const url = `https://places.googleapis.com/v1/places:searchNearby`;
      const requestBody = {
        includedTypes: ['restaurant', 'plumber', 'electrician', 'hair_care', 'local_government_office', 'store', 'health'],
        maxResultCount: 20,
        locationRestriction: {
          circle: {
            center: {
              latitude: parseFloat(lat),
              longitude: parseFloat(lng),
            },
            radius: radiusInMeters,
          }
        }
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.websiteUri,places.nationalPhoneNumber,places.primaryType',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`Google API responded with ${response.status}`);
      }

      const data = await response.json();
      
      const formattedBusinesses = (data.places || []).map((place: any, idx: number) => ({
        id: `google-${idx}`,
        name: place.displayName?.text || 'Unknown Business',
        address: place.formattedAddress || 'No Address Provided',
        phone: place.nationalPhoneNumber || 'No Phone',
        website: place.websiteUri || null,
        category: place.primaryType || 'Business',
      }));

      return NextResponse.json({ businesses: formattedBusinesses });

    } catch (error) {
      console.error('Error fetching places:', error);
      return NextResponse.json({ error: 'Failed to fetch external businesses' }, { status: 500 });
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
