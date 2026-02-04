import { NextRequest, NextResponse } from 'next/server';
import { withShadowLog } from '@/lib/logging/with-shadow-log';
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || 'pk.eyJ1IjoieW95b21ldGVlIiwiYSI6ImNtY3U3ZWp5ZDBicDIyanB0czg3d2o2NGoifQ.sdHHSLjh7vr-_w1KrU5f3Q';

// Extract location components from address
interface LocationComponents {
  province: string | null;
  district: string | null;
  subdistrict: string | null;
  village: string | null;
}

function extractLocationComponents(address: string): LocationComponents {
  const provinces = [
    'กรุงเทพ', 'กรุงเทพมหานคร', 'สมุทรปราการ', 'นนทบุรี', 'ปทุมธานี', 'พระนครศรีอยุธยา',
    'อ่างทอง', 'ลพบุรี', 'สิงห์บุรี', 'ชัยนาท', 'สระบุรี', 'ชลบุรี', 'ระยอง', 'จันทบุรี',
    'ตราด', 'ฉะเชิงเทรา', 'ปราจีนบุรี', 'นครนายก', 'สระแก้ว', 'นครราชสีมา', 'บุรีรัมย์',
    'สุรินทร์', 'ศรีสะเกษ', 'อุบลราชธานี', 'ยโสธร', 'ชัยภูมิ', 'อำนาจเจริญ', 'บึงกาฬ',
    'หนองบัวลำภู', 'ขอนแก่น', 'อุดรธานี', 'เลย', 'หนองคาย', 'มหาสารคาม', 'ร้อยเอ็ด',
    'กาฬสินธุ์', 'สกลนคร', 'นครพนม', 'มุกดาหาร', 'เชียงใหม่', 'ลำพูน', 'ลำปาง', 'อุตรดิตถ์',
    'แพร่', 'น่าน', 'พะเยา', 'เชียงราย', 'แม่ฮ่องสอน', 'นครสวรรค์', 'อุทัยธานี', 'กำแพงเพชร',
    'ตาก', 'สุโขทัย', 'พิษณุโลก', 'พิจิตร', 'เพชรบูรณ์', 'ราชบุรี', 'กาญจนบุรี', 'สุพรรณบุรี',
    'นครปฐม', 'สมุทรสาคร', 'สมุทรสงคราม', 'เพชรบุรี', 'ประจวบคีรีขันธ์', 'นครศรีธรรมราช',
    'กระบี่', 'พังงา', 'ภูเก็ต', 'สุราษฎร์ธานี', 'ระนอง', 'ชุมพร', 'สงขลา', 'สตูล', 'ตรัง',
    'พัทลุง', 'ปัตตานี', 'ยะลา', 'นราธิวาส'
  ];

  const lowerAddress = address.toLowerCase();
  let province: string | null = null;
  let district: string | null = null;
  let subdistrict: string | null = null;
  let village: string | null = null;

  // Extract province (จ. or จังหวัด)
  for (const prov of provinces) {
    const lowerProv = prov.toLowerCase();
    if (lowerAddress.includes(lowerProv) ||
        lowerAddress.includes(`จ.${lowerProv}`) ||
        lowerAddress.includes(`จังหวัด${lowerProv}`) ||
        lowerAddress.includes(`จังหวัด ${lowerProv}`)) {
      province = prov;
      break;
    }
  }

  // Extract district (อ. or อำเภอ or เขต)
  const districtPatterns = [
    /(?:อ\.|อำเภอ|เขต)\s*([ก-๙]+)/g,
    /(?:อ\.|อำเภอ|เขต)([ก-๙]+)/g
  ];

  for (const pattern of districtPatterns) {
    const match = lowerAddress.match(pattern);
    if (match && match[0]) {
      district = match[0].replace(/(?:อ\.|อำเภอ|เขต)\s*/g, '').trim();
      break;
    }
  }

  // Extract subdistrict (ต. or ตำบล or แขวง)
  const subdistrictPatterns = [
    /(?:ต\.|ตำบล|แขวง)\s*([ก-๙]+)/g,
    /(?:ต\.|ตำบล|แขวง)([ก-๙]+)/g
  ];

  for (const pattern of subdistrictPatterns) {
    const match = lowerAddress.match(pattern);
    if (match && match[0]) {
      subdistrict = match[0].replace(/(?:ต\.|ตำบล|แขวง)\s*/g, '').trim();
      break;
    }
  }

  // Extract village (ม. or หมู่ or หมู่บ้าน)
  const villagePatterns = [
    /(?:ม\.|หมู่|หมู่บ้าน)\s*(?:ที่\s*)?(\d+|[ก-๙]+)/g,
    /(?:ม\.|หมู่|หมู่บ้าน)(?:ที่\s*)?(\d+|[ก-๙]+)/g,
    /(?:บ้าน|หมู่บ้าน)\s*([ก-๙]+)/g
  ];

  for (const pattern of villagePatterns) {
    const match = lowerAddress.match(pattern);
    if (match && match[0]) {
      village = match[0].replace(/(?:ม\.|หมู่|หมู่บ้าน|ที่|บ้าน)\s*/g, '').trim();
      break;
    }
  }

  return { province, district, subdistrict, village };
}

// Calculate match score for geocoding result
function calculateMatchScore(
  resultPlaceName: string,
  components: LocationComponents
): number {
  let score = 0;
  const lowerResult = resultPlaceName.toLowerCase();

  // Province match (most important) - 40 points
  if (components.province) {
    if (lowerResult.includes(components.province.toLowerCase())) {
      score += 40;
    } else {
      // If province doesn't match, heavily penalize
      return -100;
    }
  }

  // District match - 30 points
  if (components.district) {
    if (lowerResult.includes(components.district)) {
      score += 30;
    }
  }

  // Subdistrict match - 20 points
  if (components.subdistrict) {
    if (lowerResult.includes(components.subdistrict)) {
      score += 20;
    }
  }

  // Village match - 10 points
  if (components.village) {
    if (lowerResult.includes(components.village)) {
      score += 10;
    }
  }

  return score;
}

async function _POST(request: NextRequest) {
try {
    const body = await request.json();
    const { address } = body;

    if (!address || typeof address !== 'string' || address.trim().length === 0) {
      return NextResponse.json({ error: 'Address is required' }, { status: 400 });
    }

    // Extract location components from address
    const locationComponents = extractLocationComponents(address);

    // Use Mapbox Geocoding API with improved parameters
    // https://docs.mapbox.com/api/search/geocoding/
    const encodedAddress = encodeURIComponent(address);

    // Thailand bounding box: [minLng, minLat, maxLng, maxLat]
    const thailandBbox = '97.3438,5.6108,105.6378,20.4648';

    // Center of Thailand for proximity bias
    const thailandCenter = '100.5018,13.7563';

    // Request multiple results with improved parameters
    const geocodingUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?` +
      `access_token=${MAPBOX_TOKEN}` +
      `&country=TH` +
      `&limit=10` + // Get top 10 results to increase chance of finding correct province
      `&bbox=${thailandBbox}` + // Limit to Thailand
      `&proximity=${thailandCenter}` + // Bias towards center of Thailand
      `&language=th` + // Prefer Thai language results
      `&types=address,poi,place,locality,neighborhood,postcode`; // Include various location types

    const response = await fetch(geocodingUrl);

    if (!response.ok) {
      console.error('Mapbox Geocoding API error:', response.statusText);
      return NextResponse.json(
        { error: 'Failed to geocode address' },
        { status: response.status }
      );
    }

    const data = await response.json();

    if (!data.features || data.features.length === 0) {
      return NextResponse.json(
        {
          error: 'ไม่พบพิกัดจากที่อยู่นี้',
          data: null,
          results: []
        },
        { status: 404 }
      );
    }

    // Process all results and calculate match scores
    const results = data.features.map((feature: any) => {
      const [longitude, latitude] = feature.center;
      const placeName = feature.place_name;
      const relevance = feature.relevance || 0;
      const placeType = feature.place_type?.[0] || 'unknown';

      // Calculate match score based on location components
      const matchScore = calculateMatchScore(placeName, locationComponents);

      // Calculate estimated accuracy based on place type and relevance
      let estimatedErrorKm = 0;

      if (placeType === 'address') {
        if (relevance >= 0.9) estimatedErrorKm = 0.05;
        else if (relevance >= 0.7) estimatedErrorKm = 0.1;
        else if (relevance >= 0.5) estimatedErrorKm = 0.3;
        else estimatedErrorKm = 0.5;
      } else if (placeType === 'poi') {
        if (relevance >= 0.9) estimatedErrorKm = 0.1;
        else if (relevance >= 0.7) estimatedErrorKm = 0.2;
        else if (relevance >= 0.5) estimatedErrorKm = 0.5;
        else estimatedErrorKm = 1;
      } else if (placeType === 'neighborhood' || placeType === 'locality') {
        if (relevance >= 0.9) estimatedErrorKm = 0.5;
        else if (relevance >= 0.7) estimatedErrorKm = 1;
        else if (relevance >= 0.5) estimatedErrorKm = 2;
        else estimatedErrorKm = 3;
      } else if (placeType === 'place') {
        if (relevance >= 0.9) estimatedErrorKm = 1;
        else if (relevance >= 0.7) estimatedErrorKm = 2;
        else if (relevance >= 0.5) estimatedErrorKm = 3;
        else estimatedErrorKm = 5;
      } else {
        estimatedErrorKm = 5;
      }

      return {
        latitude,
        longitude,
        place_name: placeName,
        place_type: placeType,
        relevance,
        match_score: matchScore,
        estimated_error_km: estimatedErrorKm,
        raw_feature: feature
      };
    });

    // Filter out results with negative match scores (wrong province)
    const validResults = results.filter((r: any) => r.match_score >= 0);

    if (validResults.length === 0) {
      // No valid results found (all had wrong province)
      return NextResponse.json({
        error: `ไม่พบพิกัดที่ตรงกับจังหวัด${locationComponents.province ? ` "${locationComponents.province}"` : ''}`,
        data: null,
        results: [],
        extracted_components: locationComponents
      }, { status: 404 });
    }

    // Sort by match score first, then relevance
    validResults.sort((a: any, b: any) => {
      if (b.match_score !== a.match_score) {
        return b.match_score - a.match_score;
      }
      return b.relevance - a.relevance;
    });

    return NextResponse.json({
      data: validResults[0], // Best match
      results: validResults.slice(0, 5), // Top 5 results only
      extracted_components: locationComponents,
      error: null
    });

  } catch (error) {
    console.error('Geocoding API error:', error);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export const POST = withShadowLog(_POST);
