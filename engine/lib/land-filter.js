// Shared land-listing filter + normalization helpers
// Centralizes James's product spec: land only, with configurable size bands.

const DEFAULTS = {
  propertyType: 'land',
  minLandSize: 0,
  maxLandSize: 2000,
  minPrice: 20000,
  maxPrice: 5000000,
};

function parseNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function getLandFilterConfig(overrides = {}) {
  return {
    propertyType: String(overrides.propertyType || process.env.RLP_PROPERTY_TYPE || DEFAULTS.propertyType).toLowerCase(),
    minLandSize: parseNumber(overrides.minLandSize ?? process.env.RLP_MIN_LAND_SIZE, DEFAULTS.minLandSize),
    maxLandSize: parseNumber(overrides.maxLandSize ?? process.env.RLP_MAX_LAND_SIZE, DEFAULTS.maxLandSize),
    minPrice: parseNumber(overrides.minPrice ?? process.env.RLP_MIN_PRICE, DEFAULTS.minPrice),
    maxPrice: parseNumber(overrides.maxPrice ?? process.env.RLP_MAX_PRICE, DEFAULTS.maxPrice),
  };
}

function normalizePropertyType(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z]+/g, ' ')
    .trim();
}

function isLandLike(value) {
  const t = normalizePropertyType(value);
  return !!t && (
    t.includes('land') ||
    t.includes('vacant') ||
    t.includes('residential land') ||
    t.includes('section') ||
    t.includes('lot')
  );
}

function normalizeLot(lot, overrides = {}) {
  const cfg = getLandFilterConfig(overrides);
  const price = parseNumber(lot.price, 0);
  const lotSize = parseNumber(lot.lot_size ?? lot.lotSize, 0);
  const propertyType = normalizePropertyType(lot.property_type || lot.propertyType || cfg.propertyType);

  return {
    ...lot,
    price,
    lot_size: lotSize,
    lotSize,
    property_type: propertyType,
    propertyType,
    price_per_sqm: price > 0 && lotSize > 0 ? Math.round((price / lotSize) * 100) / 100 : 0,
  };
}

function matchesLandFilter(lot, overrides = {}) {
  const cfg = getLandFilterConfig(overrides);
  const normalized = normalizeLot(lot, cfg);

  // Bug 4: Allow lots with null/0 price through IF they have a valid lot_size
  // or if they are under_contract / contact_agent (always include those)
  const isStatusListing = normalized.status === 'under_contract' || normalized.status === 'contact_agent';
  if (normalized.price && (normalized.price < cfg.minPrice || normalized.price > cfg.maxPrice)) return false;
  if (!normalized.price && !normalized.lot_size && !isStatusListing) return false;
  if (normalized.lot_size && (normalized.lot_size < cfg.minLandSize || normalized.lot_size > cfg.maxLandSize)) return false;
  if (!normalized.suburb) return false;
  if (!isLandLike(normalized.propertyType || cfg.propertyType)) return false;

  return true;
}

module.exports = {
  DEFAULTS,
  getLandFilterConfig,
  normalizePropertyType,
  isLandLike,
  normalizeLot,
  matchesLandFilter,
};
