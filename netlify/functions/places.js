// TERRA · ricerca attività su Google Places (New Text Search)
// Function indipendente — usa GOOGLE_PLACES_KEY del progetto TERRA.
// Nessun legame con il backend di Pagine Sì!.

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: cors(), body: '' };
  }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: cors(), body: 'Method Not Allowed' };

  try {
    const { query, pageToken } = JSON.parse(event.body);
    if (!query) return { statusCode: 400, headers: cors(), body: JSON.stringify({ error: 'query mancante' }) };

    const body = {
      textQuery: query,
      languageCode: 'it',
      regionCode: 'IT',
      maxResultCount: 20,
    };
    if (pageToken) body.pageToken = pageToken;

    const resp = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': process.env.GOOGLE_PLACES_KEY,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.businessStatus,places.priceLevel,places.types,places.editorialSummary,nextPageToken'
      },
      body: JSON.stringify(body)
    });

    const data = await resp.json();
    if (!resp.ok) {
      return { statusCode: resp.status, headers: cors(), body: JSON.stringify({ error: data.error?.message || 'Errore Google Places' }) };
    }
    return { statusCode: 200, headers: cors(), body: JSON.stringify(data) };

  } catch (e) {
    return { statusCode: 500, headers: cors(), body: JSON.stringify({ error: e.message }) };
  }
};

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };
}
