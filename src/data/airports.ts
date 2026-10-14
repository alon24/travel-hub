/** Airports the hub knows by city: enough to name a destination, center a map and pin the airport. [lng, lat] like GeoJSON. */
export interface Airport {
  code: string
  city: string
  country: string
  location: [number, number]
  /** On an island: a whole-country flight search leaves it out unless the trip goes there */
  island?: boolean
}

export const AIRPORTS: Airport[] = [
  { code: 'TLV', city: 'Tel Aviv', country: 'IL', location: [34.8854, 32.0055] },
  { code: 'ETM', city: 'Eilat', country: 'IL', location: [35.0117, 29.7239] },
  { code: 'LIS', city: 'Lisbon', country: 'PT', location: [-9.1354, 38.7742] },
  { code: 'OPO', city: 'Porto', country: 'PT', location: [-8.6814, 41.2481] },
  { code: 'FAO', city: 'Faro', country: 'PT', location: [-7.9659, 37.0144] },
  { code: 'FNC', city: 'Madeira', country: 'PT', location: [-16.7745, 32.6979], island: true },
  { code: 'MAD', city: 'Madrid', country: 'ES', location: [-3.5676, 40.4983] },
  { code: 'BCN', city: 'Barcelona', country: 'ES', location: [2.0785, 41.2974] },
  { code: 'AGP', city: 'Malaga', country: 'ES', location: [-4.4991, 36.6749] },
  { code: 'SVQ', city: 'Seville', country: 'ES', location: [-5.8931, 37.418] },
  { code: 'PMI', city: 'Palma de Mallorca', country: 'ES', location: [2.7388, 39.5517], island: true },
  { code: 'CDG', city: 'Paris', country: 'FR', location: [2.5479, 49.0097] },
  { code: 'NCE', city: 'Nice', country: 'FR', location: [7.2159, 43.6584] },
  { code: 'LHR', city: 'London', country: 'GB', location: [-0.4543, 51.47] },
  { code: 'LTN', city: 'London Luton', country: 'GB', location: [-0.3683, 51.8763] },
  { code: 'AMS', city: 'Amsterdam', country: 'NL', location: [4.7683, 52.3105] },
  { code: 'BRU', city: 'Brussels', country: 'BE', location: [4.4844, 50.9014] },
  { code: 'FCO', city: 'Rome', country: 'IT', location: [12.2389, 41.8003] },
  { code: 'MXP', city: 'Milan', country: 'IT', location: [8.7231, 45.6306] },
  { code: 'VCE', city: 'Venice', country: 'IT', location: [12.3519, 45.5053] },
  { code: 'FLR', city: 'Florence', country: 'IT', location: [11.2051, 43.81] },
  { code: 'NAP', city: 'Naples', country: 'IT', location: [14.2908, 40.886] },
  { code: 'BER', city: 'Berlin', country: 'DE', location: [13.5033, 52.3667] },
  { code: 'MUC', city: 'Munich', country: 'DE', location: [11.7861, 48.3538] },
  { code: 'FRA', city: 'Frankfurt', country: 'DE', location: [8.5622, 50.0379] },
  { code: 'VIE', city: 'Vienna', country: 'AT', location: [16.5697, 48.1103] },
  { code: 'ZRH', city: 'Zurich', country: 'CH', location: [8.5492, 47.4582] },
  { code: 'GVA', city: 'Geneva', country: 'CH', location: [6.109, 46.2381] },
  { code: 'PRG', city: 'Prague', country: 'CZ', location: [14.26, 50.1008] },
  { code: 'BUD', city: 'Budapest', country: 'HU', location: [19.2556, 47.4298] },
  { code: 'WAW', city: 'Warsaw', country: 'PL', location: [20.9671, 52.1657] },
  { code: 'KRK', city: 'Krakow', country: 'PL', location: [19.7848, 50.0777] },
  { code: 'ATH', city: 'Athens', country: 'GR', location: [23.9445, 37.9364] },
  { code: 'SKG', city: 'Thessaloniki', country: 'GR', location: [22.9709, 40.5197] },
  { code: 'HER', city: 'Heraklion', country: 'GR', location: [25.1803, 35.3397], island: true },
  { code: 'RHO', city: 'Rhodes', country: 'GR', location: [28.0862, 36.4054], island: true },
  { code: 'LCA', city: 'Larnaca', country: 'CY', location: [33.6249, 34.8751] },
  { code: 'PFO', city: 'Paphos', country: 'CY', location: [32.4857, 34.718] },
  { code: 'IST', city: 'Istanbul', country: 'TR', location: [28.7519, 41.2753] },
  { code: 'TBS', city: 'Tbilisi', country: 'GE', location: [44.9547, 41.6692] },
  { code: 'BTS', city: 'Bratislava', country: 'SK', location: [17.2127, 48.17] },
  { code: 'OTP', city: 'Bucharest', country: 'RO', location: [26.0852, 44.5711] },
  { code: 'SOF', city: 'Sofia', country: 'BG', location: [23.4114, 42.6967] },
  { code: 'DBV', city: 'Dubrovnik', country: 'HR', location: [18.2682, 42.5614] },
  { code: 'TIV', city: 'Tivat', country: 'ME', location: [18.7233, 42.4047] },
  { code: 'CPH', city: 'Copenhagen', country: 'DK', location: [12.6508, 55.618] },
  { code: 'DXB', city: 'Dubai', country: 'AE', location: [55.3644, 25.2532] },
  { code: 'BKK', city: 'Bangkok', country: 'TH', location: [100.7501, 13.69] },
  { code: 'JFK', city: 'New York', country: 'US', location: [-73.7781, 40.6413] },
]

const BY_CODE = new Map(AIRPORTS.map((a) => [a.code, a]))
export const airport = (code: string): Airport | undefined => BY_CODE.get(code.toUpperCase())

/** "lisbon", "LIS", "Lisbon (LIS)" → the airport, or undefined. */
export function findAirport(text: string): Airport | undefined {
  const q = text.trim().toLowerCase()
  if (!q) return undefined
  const code = q.match(/\(([a-z]{3})\)$/)?.[1] ?? (q.length === 3 ? q : '')
  return (code && BY_CODE.get(code.toUpperCase())) || AIRPORTS.find((a) => a.city.toLowerCase() === q)
}

const COUNTRY_NAMES = new Intl.DisplayNames('en', { type: 'region' })
const COUNTRY_ALIASES: Record<string, string> = { usa: 'US', america: 'US', uk: 'GB', england: 'GB', holland: 'NL' }

export interface Country {
  code: string
  name: string
  airports: Airport[]
}

/** Countries that have at least one known airport, by name ("Portugal"), in the picker's alphabetical order. */
export const COUNTRIES: Country[] = [...new Set(AIRPORTS.map((a) => a.country))]
  .map((code) => ({ code, name: COUNTRY_NAMES.of(code) ?? code, airports: AIRPORTS.filter((a) => a.country === code) }))
  .sort((a, b) => a.name.localeCompare(b.name))

/** The text of a country's entry in the destination list */
export const countryLabel = (c: Country) => `${c.name} (${c.airports.length === 1 ? '1 airport' : `all ${c.airports.length} airports`})`

/** "portugal", "Portugal (all 4 airports)", "uk" → the country, or undefined. Not the airport codes: "PT" alone isn't offered. */
export function findCountry(text: string): Country | undefined {
  const q = text.trim().toLowerCase().replace(/\s*\(.*\)$/, '')
  if (!q) return undefined
  const alias = COUNTRY_ALIASES[q]
  return COUNTRIES.find((c) => c.code === alias || c.name.toLowerCase() === q)
}

/** A country's airports for "fly anywhere in it": the mainland ones (islands only when it has nothing else). */
export function mainlandAirports(country: string): string[] {
  const all = AIRPORTS.filter((a) => a.country === country)
  const main = all.filter((a) => !a.island)
  return (main.length ? main : all).map((a) => a.code)
}
