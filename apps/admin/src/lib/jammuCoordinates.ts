export interface JammuLocation {
  name: string
  district: string
  region: 'Jammu' | 'Kashmir'
  pincode: string
  lat: number
  lng: number
  description: string
  aliases: string[]
}

export const JAMMU_AREAS: Record<string, JammuLocation> = {
  'Gandhi Nagar': { name: 'Gandhi Nagar', district: 'Jammu', region: 'Jammu', pincode: '180004', lat: 32.7081, lng: 74.8711, description: 'Central commercial area', aliases: ['gandhi nagar', '180004'] },
  'Trikuta Nagar': { name: 'Trikuta Nagar', district: 'Jammu', region: 'Jammu', pincode: '180012', lat: 32.702, lng: 74.878, description: 'Residential sector', aliases: ['trikuta nagar', '180012'] },
  'Satwari': { name: 'Satwari', district: 'Jammu', region: 'Jammu', pincode: '180011', lat: 32.689, lng: 74.845, description: 'Airport and cantonment area', aliases: ['satwari', '180011'] },
  'Bakshi Nagar': { name: 'Bakshi Nagar', district: 'Jammu', region: 'Jammu', pincode: '180003', lat: 32.738, lng: 74.848, description: 'West Jammu', aliases: ['bakshi nagar', '180003'] },
  'Janipur': { name: 'Janipur', district: 'Jammu', region: 'Jammu', pincode: '180007', lat: 32.755, lng: 74.849, description: 'North Jammu', aliases: ['janipur', '180007'] },
  'Channi Himmat': { name: 'Channi Himmat', district: 'Jammu', region: 'Jammu', pincode: '180015', lat: 32.695, lng: 74.89, description: 'East Jammu', aliases: ['channi himmat', '180015'] },
  'Jewel Chowk': { name: 'Jewel Chowk', district: 'Jammu', region: 'Jammu', pincode: '180001', lat: 32.727, lng: 74.857, description: 'Old city center', aliases: ['jewel chowk', '180001'] },
  'Talab Tillo': { name: 'Talab Tillo', district: 'Jammu', region: 'Jammu', pincode: '180002', lat: 32.723, lng: 74.832, description: 'West Jammu belt', aliases: ['talab tillo', '180002'] },
  'Digiana': { name: 'Digiana', district: 'Jammu', region: 'Jammu', pincode: '180010', lat: 32.685, lng: 74.875, description: 'Industrial area', aliases: ['digiana', '180010'] },
  'Bari Brahmana': { name: 'Bari Brahmana', district: 'Jammu', region: 'Jammu', pincode: '180018', lat: 32.642, lng: 74.928, description: 'Industrial complex', aliases: ['bari brahmana', '180018'] },
  'RS Pura': { name: 'RS Pura', district: 'Jammu', region: 'Jammu', pincode: '181102', lat: 32.603, lng: 74.733, description: 'Border belt', aliases: ['rs pura', '181102'] },
  'Nagrota': { name: 'Nagrota', district: 'Jammu', region: 'Jammu', pincode: '181221', lat: 32.795, lng: 74.912, description: 'Highway area', aliases: ['nagrota', '181221'] },
  'Samba': { name: 'Samba', district: 'Samba', region: 'Jammu', pincode: '184121', lat: 32.562, lng: 75.116, description: 'Samba district headquarters', aliases: ['samba', '184121'] },
  'Kathua': { name: 'Kathua', district: 'Kathua', region: 'Jammu', pincode: '184101', lat: 32.371, lng: 75.521, description: 'Kathua district headquarters', aliases: ['kathua', '184101'] },
  'Udhampur': { name: 'Udhampur', district: 'Udhampur', region: 'Jammu', pincode: '182101', lat: 32.926, lng: 75.141, description: 'Udhampur district', aliases: ['udhampur', '182101'] },
  'Katra': { name: 'Katra', district: 'Reasi', region: 'Jammu', pincode: '182301', lat: 32.991, lng: 74.931, description: 'Vaishno Devi base town', aliases: ['katra', '182301'] },
  'Rajouri': { name: 'Rajouri', district: 'Rajouri', region: 'Jammu', pincode: '185131', lat: 33.381, lng: 74.312, description: 'Rajouri district', aliases: ['rajouri', '185131'] },
  'Poonch': { name: 'Poonch', district: 'Poonch', region: 'Jammu', pincode: '185101', lat: 33.772, lng: 74.092, description: 'Poonch district', aliases: ['poonch', '185101'] },
  'Doda': { name: 'Doda', district: 'Doda', region: 'Jammu', pincode: '182202', lat: 33.145, lng: 75.546, description: 'Doda district', aliases: ['doda', '182202'] },
  'Bhaderwah': { name: 'Bhaderwah', district: 'Doda', region: 'Jammu', pincode: '182222', lat: 32.981, lng: 75.712, description: 'Bhaderwah town', aliases: ['bhaderwah', '182222'] },
  'Kishtwar': { name: 'Kishtwar', district: 'Kishtwar', region: 'Jammu', pincode: '182204', lat: 33.312, lng: 75.768, description: 'Kishtwar district', aliases: ['kishtwar', '182204'] },
  'Ramban': { name: 'Ramban', district: 'Ramban', region: 'Jammu', pincode: '182144', lat: 33.242, lng: 75.241, description: 'Ramban district', aliases: ['ramban', '182144'] },
  'Banihal': { name: 'Banihal', district: 'Ramban', region: 'Jammu', pincode: '182146', lat: 33.432, lng: 75.201, description: 'Banihal town', aliases: ['banihal', '182146'] },
  'Reasi': { name: 'Reasi', district: 'Reasi', region: 'Jammu', pincode: '182311', lat: 33.081, lng: 74.831, description: 'Reasi district', aliases: ['reasi', '182311'] },
  'Srinagar': { name: 'Srinagar', district: 'Srinagar', region: 'Kashmir', pincode: '190001', lat: 34.0837, lng: 74.7973, description: 'Summer capital', aliases: ['srinagar', '190001'] },
  'Hazratbal (Srinagar)': { name: 'Hazratbal (Srinagar)', district: 'Srinagar', region: 'Kashmir', pincode: '190006', lat: 34.125, lng: 74.838, description: 'North Srinagar area', aliases: ['hazratbal', '190006'] },
  'Anantnag': { name: 'Anantnag', district: 'Anantnag', region: 'Kashmir', pincode: '192101', lat: 33.731, lng: 75.148, description: 'South Kashmir district', aliases: ['anantnag', '192101'] },
  'Pahalgam': { name: 'Pahalgam', district: 'Anantnag', region: 'Kashmir', pincode: '192126', lat: 34.015, lng: 75.315, description: 'Tourist town', aliases: ['pahalgam', '192126'] },
  'Baramulla': { name: 'Baramulla', district: 'Baramulla', region: 'Kashmir', pincode: '193101', lat: 34.201, lng: 74.342, description: 'North Kashmir district', aliases: ['baramulla', '193101'] },
  'Gulmarg': { name: 'Gulmarg', district: 'Baramulla', region: 'Kashmir', pincode: '193403', lat: 34.048, lng: 74.38, description: 'Resort town', aliases: ['gulmarg', '193403'] },
  'Pulwama': { name: 'Pulwama', district: 'Pulwama', region: 'Kashmir', pincode: '192301', lat: 33.872, lng: 74.895, description: 'Pulwama district', aliases: ['pulwama', '192301'] },
  'Shopian': { name: 'Shopian', district: 'Shopian', region: 'Kashmir', pincode: '192303', lat: 33.721, lng: 74.831, description: 'Shopian district', aliases: ['shopian', '192303'] },
  'Budgam': { name: 'Budgam', district: 'Budgam', region: 'Kashmir', pincode: '191111', lat: 34.016, lng: 74.721, description: 'Budgam district', aliases: ['budgam', '191111'] },
  'Ganderbal': { name: 'Ganderbal', district: 'Ganderbal', region: 'Kashmir', pincode: '191201', lat: 34.225, lng: 74.778, description: 'Kashmir valley district', aliases: ['ganderbal', '191201'] },
  'Kulgam': { name: 'Kulgam', district: 'Kulgam', region: 'Kashmir', pincode: '192231', lat: 33.642, lng: 75.012, description: 'South Kashmir district', aliases: ['kulgam', '192231'] },
  'Kupwara': { name: 'Kupwara', district: 'Kupwara', region: 'Kashmir', pincode: '193222', lat: 34.531, lng: 74.256, description: 'North Kashmir district', aliases: ['kupwara', '193222'] },
  'Bandipora': { name: 'Bandipora', district: 'Bandipora', region: 'Kashmir', pincode: '193502', lat: 34.421, lng: 74.651, description: 'Bandipora district', aliases: ['bandipora', '193502'] },
}

export const JAMMU_DISTRICT_OPTIONS = Array.from(
  new Set(Object.values(JAMMU_AREAS).map(loc => loc.district))
).sort()

export function getAreasForDistrict(district: string): string[] {
  if (!district) return Object.keys(JAMMU_AREAS)
  return Object.entries(JAMMU_AREAS)
    .filter(([_, loc]) => loc.district === district || loc.name === district)
    .map(([name]) => name)
    .sort()
}
