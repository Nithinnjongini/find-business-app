/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextResponse } from 'next/server';

const CHAIN_BUSINESSES = [
  'starbucks', 'mcdonald', 'subway', 'burger king', 'wendy', 'taco bell',
  'kfc', 'pizza hut', 'domino', 'dunkin', 'fedex', 'ups', 'costco',
  'walmart', 'target', 'chipotle', 'panera', 'papa john', 'cvs',
  'walgreens', 'home depot', 'lowes', 'best buy', 'applebee', "chili's",
  'olive garden', 'red lobster', 'dairy queen', 'arby', 'sonic', 'tim hortons'
];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');
  const radius = searchParams.get('radius'); // in miles
  const pageToken = searchParams.get('pageToken');

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  if (!apiKey) {
    return NextResponse.json({
      businesses: [],
      _notice: "Running in mock mode. Add GOOGLE_PLACES_API_KEY to .env to fetch real data."
    });
  }

  try {
    let searchUrl = '';

    if (pageToken) {
      searchUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?pagetoken=${pageToken}&key=${apiKey}`;
    } else {
      if (!lat || !lng || !radius) {
        return NextResponse.json({ error: 'Missing required parameters (lat, lng, radius)' }, { status: 400 });
      }
      const radiusInMeters = parseFloat(radius) * 1609.34;
      // Search for local businesses and restaurants
      searchUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radiusInMeters}&keyword=restaurant+OR+local+business&key=${apiKey}`;
    }

    // Google Places API sometimes needs a short delay before a pageToken is valid
    // If we get INVALID_REQUEST right after a token, we could retry, but usually the client waits enough time
    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json();

    if (searchData.status !== 'OK' && searchData.status !== 'ZERO_RESULTS') {
      throw new Error(`Google API search responded with status: ${searchData.status}. Error: ${searchData.error_message || ''}`);
    }

    const rawPlaces = searchData.results || [];

    // Process places, ignoring chains
    const detailedPlacesPromises = rawPlaces.map(async (place: any) => {
      if (!place.place_id) return null;

      const nameLower = (place.name || '').toLowerCase();
      const isChain = CHAIN_BUSINESSES.some(chain => nameLower.includes(chain));
      if (isChain) return null; // Skip chain businesses immediately

      try {
        const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,formatted_address,website,formatted_phone_number,types&key=${apiKey}`;
        const detailsRes = await fetch(detailsUrl);
        const detailsData = await detailsRes.json();
        if (detailsData.status === 'OK') {
          return { ...place, ...detailsData.result };
        }
        return place;
      } catch (err) {
        return place;
      }
    });

    const detailedPlaces = await Promise.all(detailedPlacesPromises);
    const validPlaces = detailedPlaces.filter(Boolean); // Remove nulls (chains)

    const formattedBusinesses = validPlaces.map((place: any, idx: number) => ({
      id: `google-${place.place_id || idx}`,
      name: place.name || 'Unknown Business',
      address: place.formatted_address || place.vicinity || 'No Address Provided',
      phone: place.formatted_phone_number || place.international_phone_number || 'No Phone',
      website: place.website || null,
      category: (place.types && place.types.length > 0) ? place.types.filter((t: string) => t !== 'establishment' && t !== 'point_of_interest')[0] || place.types[0] : 'Business',
    }));

    return NextResponse.json({
      businesses: formattedBusinesses,
      nextPageToken: searchData.next_page_token || null
    });

  } catch (error: any) {
    console.error('Error fetching places:', error);
    return NextResponse.json({
      error: error.message || 'Failed to fetch external businesses from Google API'
    }, { status: 400 });
  }
}
