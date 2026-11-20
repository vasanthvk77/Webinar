import { defaultCountries, parseCountry } from 'react-international-phone';
import countries from 'world-countries';
import getSymbolFromCurrency from 'currency-symbol-map';

/**
 * Converts a 2-letter ISO country code into Unicode flag emoji
 * e.g. 'in' -> 🇮🇳, 'us' -> 🇺🇸, 'gb' -> 🇬🇧
 */
export const getFlagEmoji = (iso2) => {
  if (!iso2 || typeof iso2 !== 'string' || iso2.length !== 2) return '🌐';
  try {
    const codePoints = iso2
      .toUpperCase()
      .split('')
      .map((char) => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  } catch {
    return '🌐';
  }
};

/**
 * Complete list of world countries derived from international library dataset.
 * Sorted alphabetically by country name.
 */
export const WORLD_COUNTRIES = defaultCountries
  .map((c) => {
    const parsed = parseCountry(c);
    const cleanDial = parsed.dialCode.startsWith('+') ? parsed.dialCode : `+${parsed.dialCode}`;
    return {
      name: parsed.name,
      iso2: parsed.iso2,
      dialCode: cleanDial,
      numericDial: parsed.dialCode.replace(/[^\d]/g, ''),
      flag: getFlagEmoji(parsed.iso2),
      label: `${parsed.name} (${cleanDial})`,
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

/**
 * Dynamically resolves Country Name from a stored dial code string or number
 * e.g. '+91' -> 'India', '+1' -> 'United States', '+44' -> 'United Kingdom'
 */
export const getCountryNameFromCode = (code) => {
  if (!code) return 'Not Specified';
  const clean = code.toString().replace(/[^\d]/g, '');
  if (!clean) return 'Not Specified';

  // Handle common single/shared dial codes like +1 (US / Canada)
  if (clean === '1') return 'United States';
  if (clean === '7') return 'Russia';

  const match = WORLD_COUNTRIES.find((c) => c.numericDial === clean);
  return match ? match.name : `International (+${clean})`;
};

/**
 * Finds country metadata by dial code
 */
export const getCountryFromCode = (code) => {
  if (!code) return null;
  const clean = code.toString().replace(/[^\d]/g, '');
  if (!clean) return null;

  if (clean === '1') {
    return WORLD_COUNTRIES.find((c) => c.iso2 === 'us') || null;
  }

  return WORLD_COUNTRIES.find((c) => c.numericDial === clean) || null;
};

/**
 * Finds country metadata by Country Name
 */
export const getCountryFromName = (name) => {
  if (!name) return null;
  const lower = name.trim().toLowerCase();
  return WORLD_COUNTRIES.find((c) => c.name.toLowerCase() === lower) || null;
};

/**
 * Resolves currency symbol from a country dial code, country name, or ISO2 code.
 * e.g. '+91' -> '₹', '+1' -> '$', '+44' -> '£', '+66' -> '฿'
 */
export const getCurrencySymbolFromCountryCode = (code) => {
  if (!code) return '$';

  const clean = code.toString().replace(/[^\d]/g, '');

  // 1. Try matching using react-international-phone's exact dial codes
  if (clean) {
    const matchedCountry = WORLD_COUNTRIES.find(
      (c) => c.numericDial === clean || clean.startsWith(c.numericDial)
    );

    if (matchedCountry) {
      const matchInWorld = countries.find(
        (c) => c.cca2.toLowerCase() === matchedCountry.iso2.toLowerCase()
      );
      if (matchInWorld && matchInWorld.currencies) {
        const currCode = Object.keys(matchInWorld.currencies)[0];
        const sym = getSymbolFromCurrency(currCode) || matchInWorld.currencies[currCode]?.symbol;
        if (sym) return sym;
      }
    }

    // Fallback: match against world-countries idd.root + suffixes strictly (no partial root mismatch)
    for (let len = Math.min(clean.length, 3); len >= 1; len--) {
      const sub = '+' + clean.slice(0, len);
      const match = countries.find(
        (c) =>
          c.idd &&
          c.idd.root &&
          (c.idd.suffixes || []).some((s) => c.idd.root + s === sub)
      );
      if (match && match.currencies) {
        const currCode = Object.keys(match.currencies)[0];
        const sym = getSymbolFromCurrency(currCode) || match.currencies[currCode]?.symbol;
        if (sym) return sym;
      }
    }
  }

  // 2. Direct ISO2 lookup (e.g., 'IN', 'US')
  const strCode = code.toString().trim().toLowerCase();
  const matchIso = countries.find((c) => c.cca2.toLowerCase() === strCode);
  if (matchIso && matchIso.currencies) {
    const currCode = Object.keys(matchIso.currencies)[0];
    const sym = getSymbolFromCurrency(currCode) || matchIso.currencies[currCode]?.symbol;
    if (sym) return sym;
  }

  return '$';
};

/**
 * Format price according to user's country currency symbol
 * Polymorphic: handles formatWebinarPrice(isPaid, price, countryCode)
 *         and: formatWebinarPrice(webinarObject, countryCode)
 * e.g. formatWebinarPrice(true, 200, '+91') => '₹200'
 */
export const formatWebinarPrice = (isPaidOrWebinar, priceOrCountryCode, countryCode) => {
  // Case 1: First argument is a webinar object: formatWebinarPrice(webinar, countryCode)
  if (isPaidOrWebinar && typeof isPaidOrWebinar === 'object') {
    const webinar = isPaidOrWebinar;
    const userCountry = priceOrCountryCode || countryCode || '+91';
    if (!webinar.isPaid) return 'Free';

    let resolvedPrice = webinar.price;
    let resolvedCurrency = getCurrencySymbolFromCountryCode(userCountry);

    // If webinar has country-specific pricing configured
    if (Array.isArray(webinar.countryPrices) && webinar.countryPrices.length > 0) {
      const cleanUser = (userCountry || '').toString().replace(/[^\d]/g, '');
      const match = webinar.countryPrices.find((cp) => {
        const cleanCp = (cp.countryCode || '').toString().replace(/[^\d]/g, '');
        return cleanCp === cleanUser;
      });
      if (match && match.amount != null && match.amount > 0) {
        resolvedPrice = match.amount;
        if (match.currencySymbol) resolvedCurrency = match.currencySymbol;
      }
    }

    if (resolvedPrice == null || Number(resolvedPrice) <= 0) return 'Free';
    return `${resolvedCurrency}${Number(resolvedPrice).toLocaleString()}`;
  }

  // Case 2: Classic 3-argument signature: formatWebinarPrice(isPaid, price, countryCode)
  const isPaid = isPaidOrWebinar;
  const price = priceOrCountryCode;
  if (!isPaid || price == null || Number(price) <= 0) return 'Free';

  const symbol = getCurrencySymbolFromCountryCode(countryCode || '+91');
  return `${symbol}${Number(price).toLocaleString()}`;
};
