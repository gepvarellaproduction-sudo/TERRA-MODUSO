// TERRA · analisi AI adattiva dei lead.
// Riceve il profilo del cliente B2B + la lista attività da Google Places,
// restituisce per ogni attività: score, stima dimensione, e dossier per il venditore.
// Function indipendente — usa ANTHROPIC_API_KEY del progetto TERRA.

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors(), body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: cors(), body: 'Method Not Allowed' };

  try {
    const { profilo, attivita } = JSON.parse(event.body);
    if (!attivita || !attivita.length) {
      return { statusCode: 400, headers: cors(), body: JSON.stringify({ error: 'nessuna attività da analizzare' }) };
    }

    const system = `Sei un analista commerciale B2B esperto del mercato italiano. Aiuti un'azienda a qualificare potenziali clienti (lead) trovati su Google Maps.

L'AZIENDA CHE CERCA CLIENTI:
- Nome: ${profilo.nomeAzienda || 'N/D'}
- Cosa vende / offre: ${profilo.offerta || 'N/D'}
- Settore: ${profilo.settore || 'N/D'}
- Cliente ideale che cerca: ${profilo.clienteIdeale || 'attività compatibili'}
- Note aggiuntive: ${profilo.note || 'nessuna'}

IL TUO COMPITO: per ognuna delle attività qui sotto (trovate su Google Maps), valuta quanto è un buon LEAD per questa azienda specifica, ragionando sul suo business reale.

REGOLE DI VALUTAZIONE:
- Lo SCORE (0-100) misura quanto questa attività è un cliente potenziale interessante per CHI VENDE, considerando cosa vende. Non usare regole fisse: ragiona sul caso concreto. (Es: per un'azienda di depurazione acqua, un ristorante grande e affollato è un lead ottimo perché consuma molta acqua; un piccolo ufficio no.)
- La STIMA DIMENSIONE: dai una valutazione del volume/dimensione dell'attività basata SOLO sui segnali pubblici disponibili (numero recensioni, fascia di prezzo, rating, tipo). Esprimila come fascia indicativa (es. "piccola", "media", "grande", "molto grande / alto volume"). NON inventare numeri di fatturato: non li hai. Puoi indicare un ordine di grandezza ragionato ("probabile volume d'affari medio-alto") ma SEMPRE come stima dichiarata, mai come dato certo.
- Il DOSSIER: 2-3 frasi che diano al venditore un quadro immediato e azionabile: chi è questa attività, perché è (o non è) un buon lead per quello che vendiamo, e come approcciarla. Concreto, da commerciale, non generico.

Rispondi SOLO con JSON valido, nessun testo fuori, nessun backtick. Array nello stesso ordine ricevuto:
{"analisi":[{"score":75,"dimensione":"grande / alto volume","dossier":"..."}]}`;

    const lista = attivita.map((a, i) =>
      `${i}. ${a.nome} | rating ${a.rating || 'N/D'} (${a.nRating || 0} recensioni) | fascia prezzo: ${a.priceLevel || 'N/D'} | sito: ${a.web ? 'sì' : 'no'} | tipo: ${(a.tipi || []).slice(0,3).join(', ') || 'N/D'} | ${a.indirizzo || ''}`
    ).join('\n');

    const userMsg = `Attività da valutare:\n${lista}\n\nValuta tutte le ${attivita.length} attività secondo le regole. Rispondi con l'array JSON nello stesso ordine.`;

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        system,
        messages: [{ role: 'user', content: userMsg }]
      })
    });

    if (!resp.ok) {
      const err = await resp.text();
      return { statusCode: resp.status, headers: cors(), body: JSON.stringify({ error: err }) };
    }

    const data = await resp.json();
    let raw = '';
    for (const b of (data.content || [])) { if (b.type === 'text') raw += b.text; }
    let result;
    try {
      const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const m = clean.match(/\{[\s\S]*\}/);
      result = JSON.parse(m?.[0] || '{"analisi":[]}');
    } catch {
      result = { analisi: [] };
    }

    return { statusCode: 200, headers: cors(), body: JSON.stringify(result) };

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
