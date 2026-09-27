export interface JammuLocation {
  name: string
  region: 'Jammu' | 'Kashmir'
  pincode: string
  lat: number
  lng: number
  description: string
  aliases: string[]
}

export const JAMMU_AREAS: Record<string, JammuLocation> = {
  // ── JAMMU CITY & METRO ──────────────────────────────────────
  'Gandhi Nagar': {
    name: 'Gandhi Nagar',
    region: 'Jammu',
    pincode: '180004',
    lat: 32.7081,
    lng: 74.8711,
    description: 'Central Commercial & Residential Hub, Jammu',
    aliases: ['gandhi nagar', '180004', 'aquaf market', 'gole market'],
  },
  'Trikuta Nagar': {
    name: 'Trikuta Nagar',
    region: 'Jammu',
    pincode: '180012',
    lat: 32.7020,
    lng: 74.8780,
    description: 'South Jammu Residential Sector',
    aliases: ['trikuta nagar', '180012', 'easyday trikuta'],
  },
  'Satwari': {
    name: 'Satwari',
    region: 'Jammu',
    pincode: '180011',
    lat: 32.6890,
    lng: 74.8450,
    description: 'Jammu Airport & Cantonment Area',
    aliases: ['satwari', '180011', 'jammu airport', 'satwari chowk', 'cantt'],
  },
  'Bakshi Nagar': {
    name: 'Bakshi Nagar',
    region: 'Jammu',
    pincode: '180003',
    lat: 32.7380,
    lng: 74.8480,
    description: 'Medical College & West Jammu',
    aliases: ['bakshi nagar', '180003', 'gmc jammu', 'medical college'],
  },
  'Janipur': {
    name: 'Janipur',
    region: 'Jammu',
    pincode: '180007',
    lat: 32.7550,
    lng: 74.8490,
    description: 'North Jammu Court & High Density Area',
    aliases: ['janipur', '180007', 'high court', 'janipur colony'],
  },
  'Channi Himmat': {
    name: 'Channi Himmat',
    region: 'Jammu',
    pincode: '180015',
    lat: 32.6950,
    lng: 74.8900,
    description: 'East Jammu Upscale Housing Colony',
    aliases: ['channi himmat', '180015', 'channi', 'sec 1 channi'],
  },
  'Jewel Chowk': {
    name: 'Jewel Chowk',
    region: 'Jammu',
    pincode: '180001',
    lat: 32.7270,
    lng: 74.8570,
    description: 'Jammu Old City Center & Gumat',
    aliases: ['jewel chowk', '180001', 'jewel', 'gumat', 'bus stand jammu', 'raghunath bazaar'],
  },
  'Talab Tillo': {
    name: 'Talab Tillo',
    region: 'Jammu',
    pincode: '180002',
    lat: 32.7230,
    lng: 74.8320,
    description: 'West Jammu Commercial Belt',
    aliases: ['talab tillo', '180002', 'bohri', 'talab tillo main'],
  },
  'Digiana': {
    name: 'Digiana',
    region: 'Jammu',
    pincode: '180010',
    lat: 32.6850,
    lng: 74.8750,
    description: 'Industrial Estate & South Jammu',
    aliases: ['digiana', '180010', 'gangyal', 'industrial estate'],
  },
  'Bari Brahmana': {
    name: 'Bari Brahmana',
    region: 'Jammu',
    pincode: '180018',
    lat: 32.6420,
    lng: 74.9280,
    description: 'Major Industrial Complex, Samba Border',
    aliases: ['bari brahmana', '180018', 'sidco bari brahmana'],
  },
  'RS Pura': {
    name: 'RS Pura',
    region: 'Jammu',
    pincode: '181102',
    lat: 32.6030,
    lng: 74.7330,
    description: 'Outer Jammu Border Belt & Suchetgarh',
    aliases: ['rs pura', '181102', 'ranbir singh pura', 'suchetgarh'],
  },
  'Nagrota': {
    name: 'Nagrota',
    region: 'Jammu',
    pincode: '181221',
    lat: 32.7950,
    lng: 74.9120,
    description: 'North Highway Entrance & Sainik School',
    aliases: ['nagrota', '181221', 'sainik school', 'kandoli'],
  },

  // ── OTHER JAMMU DIVISION DISTRICTS ─────────────────────────
  'Samba': {
    name: 'Samba',
    region: 'Jammu',
    pincode: '184121',
    lat: 32.5620,
    lng: 75.1160,
    description: 'Samba District HQ & Vijaypur Belt',
    aliases: ['samba', '184121', 'vijaypur', '184120'],
  },
  'Kathua': {
    name: 'Kathua',
    region: 'Jammu',
    pincode: '184101',
    lat: 32.3710,
    lng: 75.5210,
    description: 'Kathua District HQ & Industrial Hub',
    aliases: ['kathua', '184101', 'lakhanpur', 'hiranagar'],
  },
  'Udhampur': {
    name: 'Udhampur',
    region: 'Jammu',
    pincode: '182101',
    lat: 32.9260,
    lng: 75.1410,
    description: 'Northern Command HQ, Udhampur District',
    aliases: ['udhampur', '182101', 'ramnagar', 'chenani'],
  },
  'Katra': {
    name: 'Katra',
    region: 'Jammu',
    pincode: '182301',
    lat: 32.9910,
    lng: 74.9310,
    description: 'Holy Shrine Base Town, Reasi District',
    aliases: ['katra', '182301', 'vaishno devi', 'reasi'],
  },
  'Rajouri': {
    name: 'Rajouri',
    region: 'Jammu',
    pincode: '185131',
    lat: 33.3810,
    lng: 74.3120,
    description: 'Rajouri District HQ & Pir Panjal Belt',
    aliases: ['rajouri', '185131', 'nowshera', 'thannamandi'],
  },
  'Poonch': {
    name: 'Poonch',
    region: 'Jammu',
    pincode: '185101',
    lat: 33.7720,
    lng: 74.0920,
    description: 'Poonch Border District HQ',
    aliases: ['poonch', '185101', 'surankote', 'mendhar'],
  },
  'Doda': {
    name: 'Doda',
    region: 'Jammu',
    pincode: '182202',
    lat: 33.1450,
    lng: 75.5460,
    description: 'Doda District HQ & Chenab Valley',
    aliases: ['doda', '182202', 'doda town'],
  },
  'Bhaderwah': {
    name: 'Bhaderwah',
    region: 'Jammu',
    pincode: '182222',
    lat: 32.9810,
    lng: 75.7120,
    description: 'Chota Kashmir, Doda District',
    aliases: ['bhaderwah', '182222', 'bhadarwah'],
  },
  'Kishtwar': {
    name: 'Kishtwar',
    region: 'Jammu',
    pincode: '182204',
    lat: 33.3120,
    lng: 75.7680,
    description: 'Kishtwar District HQ & Saffron Belt',
    aliases: ['kishtwar', '182204', 'paddar'],
  },
  'Ramban': {
    name: 'Ramban',
    region: 'Jammu',
    pincode: '182144',
    lat: 33.2420,
    lng: 75.2410,
    description: 'Ramban District HQ',
    aliases: ['ramban', '182144'],
  },
  'Banihal': {
    name: 'Banihal',
    region: 'Jammu',
    pincode: '182146',
    lat: 33.4320,
    lng: 75.2010,
    description: 'Banihal Railway Station & Tunnel, Ramban District',
    aliases: ['banihal', '182146', 'banihal tunnel'],
  },
  'Reasi': {
    name: 'Reasi',
    region: 'Jammu',
    pincode: '182311',
    lat: 33.0810,
    lng: 74.8310,
    description: 'Reasi District HQ & Chenab Bridge',
    aliases: ['reasi', '182311', 'chenab bridge'],
  },

  // ── KASHMIR DIVISION DISTRICTS ──────────────────────────────
  'Srinagar': {
    name: 'Srinagar',
    region: 'Kashmir',
    pincode: '190001',
    lat: 34.0837,
    lng: 74.7973,
    description: 'Summer Capital City Center & Lal Chowk',
    aliases: ['srinagar', '190001', 'lal chowk', 'rajbagh', 'karan nagar'],
  },
  'Hazratbal (Srinagar)': {
    name: 'Hazratbal (Srinagar)',
    region: 'Kashmir',
    pincode: '190006',
    lat: 34.1250,
    lng: 74.8380,
    description: 'North Srinagar & University Area',
    aliases: ['hazratbal', '190006', 'soura', '190011', 'nigeen'],
  },
  'Anantnag': {
    name: 'Anantnag',
    region: 'Kashmir',
    pincode: '192101',
    lat: 33.7310,
    lng: 75.1480,
    description: 'South Kashmir Commercial Capital (Islamabad)',
    aliases: ['anantnag', '192101', 'khanabal', 'bijbehara'],
  },
  'Pahalgam': {
    name: 'Pahalgam',
    region: 'Kashmir',
    pincode: '192126',
    lat: 34.0150,
    lng: 75.3150,
    description: 'Tourist Hub, Anantnag District',
    aliases: ['pahalgam', '192126', 'arow valley'],
  },
  'Baramulla': {
    name: 'Baramulla',
    region: 'Kashmir',
    pincode: '193101',
    lat: 34.2010,
    lng: 74.3420,
    description: 'North Kashmir District HQ',
    aliases: ['baramulla', '193101', 'sopore', '193201', 'pattan'],
  },
  'Gulmarg': {
    name: 'Gulmarg',
    region: 'Kashmir',
    pincode: '193403',
    lat: 34.0480,
    lng: 74.3800,
    description: 'Resort Town, Baramulla District',
    aliases: ['gulmarg', '193403', 'tangmarg'],
  },
  'Pulwama': {
    name: 'Pulwama',
    region: 'Kashmir',
    pincode: '192301',
    lat: 33.8720,
    lng: 74.8950,
    description: 'Pulwama District HQ & Saffron Hub',
    aliases: ['pulwama', '192301', 'pampore', '192304'],
  },
  'Shopian': {
    name: 'Shopian',
    region: 'Kashmir',
    pincode: '192303',
    lat: 33.7210,
    lng: 74.8310,
    description: 'Shopian Apple Valley HQ',
    aliases: ['shopian', '192303'],
  },
  'Budgam': {
    name: 'Budgam',
    region: 'Kashmir',
    pincode: '191111',
    lat: 34.0160,
    lng: 74.7210,
    description: 'Budgam District HQ & Airport Entrance',
    aliases: ['budgam', '191111', 'beerwah', 'chadoora'],
  },
  'Ganderbal': {
    name: 'Ganderbal',
    region: 'Kashmir',
    pincode: '191201',
    lat: 34.2250,
    lng: 74.7780,
    description: 'Ganderbal HQ & Kangan Valley',
    aliases: ['ganderbal', '191201', 'kangan', 'sonamarg'],
  },
  'Kulgam': {
    name: 'Kulgam',
    region: 'Kashmir',
    pincode: '192231',
    lat: 33.6420,
    lng: 75.0120,
    description: 'Kulgam District HQ & South Kashmir',
    aliases: ['kulgam', '192231', 'dhalwan'],
  },
  'Kupwara': {
    name: 'Kupwara',
    region: 'Kashmir',
    pincode: '193222',
    lat: 34.5310,
    lng: 74.2560,
    description: 'North Kashmir Border District HQ',
    aliases: ['kupwara', '193222', 'handwara', '193221'],
  },
  'Bandipora': {
    name: 'Bandipora',
    region: 'Kashmir',
    pincode: '193502',
    lat: 34.4210,
    lng: 74.6510,
    description: 'Bandipora District HQ & Wular Lake',
    aliases: ['bandipora', '193502', 'gurez'],
  },
}

/**
 * Calculates Haversine distance in kilometers between two GPS coordinates
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371 // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const d = R * c
  return Math.round(d * 10) / 10 // Round to 1 decimal place (e.g. 1.4 km)
}

/**
 * Resolves input text (PIN code, place name, landmark, or area) to Jammu location
 */
export function resolveJammuInput(query: string): {
  areaName: string
  pincode: string
  lat: number
  lng: number
  matched: boolean
} {
  if (!query || !query.trim()) {
    return { areaName: 'Gandhi Nagar', pincode: '180004', lat: 32.7081, lng: 74.8711, matched: false }
  }

  const q = query.trim().toLowerCase()

  // 1. Direct match by PIN code or Area key
  for (const [key, loc] of Object.entries(JAMMU_AREAS)) {
    if (
      loc.pincode === q ||
      key.toLowerCase() === q ||
      loc.aliases.some(alias => alias.toLowerCase() === q || q.includes(alias.toLowerCase()))
    ) {
      return { areaName: loc.name, pincode: loc.pincode, lat: loc.lat, lng: loc.lng, matched: true }
    }
  }

  // 2. Partial match
  for (const [key, loc] of Object.entries(JAMMU_AREAS)) {
    if (
      key.toLowerCase().includes(q) ||
      loc.description.toLowerCase().includes(q) ||
      loc.aliases.some(alias => alias.toLowerCase().includes(q))
    ) {
      return { areaName: loc.name, pincode: loc.pincode, lat: loc.lat, lng: loc.lng, matched: true }
    }
  }

  // Default fallback to Gandhi Nagar
  return { areaName: 'Gandhi Nagar', pincode: '180004', lat: 32.7081, lng: 74.8711, matched: false }
}

/**
 * Finds the closest mapped J&K area for raw GPS coordinates
 */
export function findClosestJammuArea(lat: number, lng: number): JammuLocation {
  let closest: JammuLocation | null = null
  let minDistance = Infinity

  for (const loc of Object.values(JAMMU_AREAS)) {
    const d = calculateHaversineDistance(lat, lng, loc.lat, loc.lng)
    if (d < minDistance) {
      minDistance = d
      closest = loc
    }
  }

  return closest || JAMMU_AREAS['Gandhi Nagar']
}

/**
 * Resolves lat/lng for a Jammu area string or returns default (Gandhi Nagar)
 */
export function getCoordinatesForArea(areaName?: string | null): { lat: number; lng: number } {
  if (!areaName) return { lat: 32.7081, lng: 74.8711 }
  const res = resolveJammuInput(areaName)
  return { lat: res.lat, lng: res.lng }
}
