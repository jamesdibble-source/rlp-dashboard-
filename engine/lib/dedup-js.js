// JS version of the cross-source dedup helper for the Node runtime scripts.

function normalizeAddress(address) {
  return String(address || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/lot\s*\d+[\s,]*/i, '')
    .replace(/[^\w\s]/g, '')
    .trim();
}

function dedupKey(lot) {
  const address = normalizeAddress(lot.address);
  const suburb = String(lot.suburb || '').toLowerCase().trim();
  const state = String(lot.state || '').toUpperCase().trim();
  const lotSize = Math.round((Number(lot.lot_size || lot.lotSize || 0) / 5)) * 5;
  return `${address}|${suburb}|${state}|${lotSize}`;
}

function mergeLots(lots) {
  if (!lots.length) return null;
  const sold = lots.find(l => l.status === 'sold');
  const primary = sold || lots[0];
  const lotSize = Math.max(...lots.map(l => Number(l.lot_size || l.lotSize || 0)).filter(Boolean), 0);
  const soldPrice = lots.map(l => l.sold_price).find(v => v && v > 0) || null;
  const listPrice = lots.map(l => l.list_price).find(v => v && v > 0) || null;
  const price = soldPrice || listPrice || primary.price || 0;
  const statuses = lots.map(l => l.status);
  const status = statuses.includes('sold') ? 'sold'
    : statuses.includes('under_contract') ? 'under_contract'
    : statuses.includes('withdrawn') ? 'withdrawn'
    : 'listing';
  const sources = [...new Set(lots.map(l => l.source).filter(Boolean))];
  const listDate = lots.map(l => l.list_date).filter(Boolean).sort()[0] || primary.list_date || null;
  const soldDates = lots.map(l => l.sold_date).filter(Boolean).sort();
  const soldDate = soldDates[soldDates.length - 1] || primary.sold_date || null;
  return {
    ...primary,
    lot_size: lotSize,
    sold_price: soldPrice,
    list_price: listPrice,
    price,
    status,
    list_date: listDate,
    sold_date: soldDate,
    price_per_sqm: lotSize > 0 && price > 0 ? Math.round((price / lotSize) * 100) / 100 : 0,
    source: sources.join(','),
    sources,
    dedup_key: dedupKey(primary),
    raw_json: JSON.stringify({
      observations: lots.map(l => ({
        source: l.source || null,
        source_id: l.source_id || null,
        source_url: l.source_url || null,
        payload: l.raw_json || null,
      })),
    }),
  };
}

function dedupLots(lots) {
  const groups = new Map();
  for (const lot of lots) {
    const key = lot.dedup_key || dedupKey(lot);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(lot);
  }
  return [...groups.values()].map(mergeLots).filter(Boolean);
}

module.exports = { dedupKey, dedupLots, mergeLots };
