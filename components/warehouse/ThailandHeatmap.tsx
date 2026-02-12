'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { geoPath, geoMercator } from 'd3-geo';
import type { FeatureCollection, Feature, Geometry } from 'geojson';

// ── Province name mapping: English (GeoJSON) → Thai (DB) ──
const EN_TO_TH: Record<string, string> = {
  'Bangkok Metropolis': 'กรุงเทพฯ',
  'Amnat Charoen': 'อำนาจเจริญ',
  'Ang Thong': 'อ่างทอง',
  'Bueng Kan': 'บึงกาฬ',
  'Buri Ram': 'บุรีรัมย์',
  'Chachoengsao': 'ฉะเชิงเทรา',
  'Chai Nat': 'ชัยนาท',
  'Chaiyaphum': 'ชัยภูมิ',
  'Chanthaburi': 'จันทบุรี',
  'Chiang Mai': 'เชียงใหม่',
  'Chiang Rai': 'เชียงราย',
  'Chon Buri': 'ชลบุรี',
  'Chumphon': 'ชุมพร',
  'Kalasin': 'กาฬสินธุ์',
  'Kamphaeng Phet': 'กำแพงเพชร',
  'Kanchanaburi': 'กาญจนบุรี',
  'Khon Kaen': 'ขอนแก่น',
  'Krabi': 'กระบี่',
  'Lampang': 'ลำปาง',
  'Lamphun': 'ลำพูน',
  'Loei': 'เลย',
  'Lop Buri': 'ลพบุรี',
  'Mae Hong Son': 'แม่ฮ่องสอน',
  'Maha Sarakham': 'มหาสารคาม',
  'Mukdahan': 'มุกดาหาร',
  'Nakhon Nayok': 'นครนายก',
  'Nakhon Pathom': 'นครปฐม',
  'Nakhon Phanom': 'นครพนม',
  'Nakhon Ratchasima': 'นครราชสีมา',
  'Nakhon Sawan': 'นครสวรรค์',
  'Nakhon Si Thammarat': 'นครศรีธรรมราช',
  'Nan': 'น่าน',
  'Narathiwat': 'นราธิวาส',
  'Nong Bua Lam Phu': 'หนองบัวลำภู',
  'Nong Khai': 'หนองคาย',
  'Nonthaburi': 'นนทบุรี',
  'Pathum Thani': 'ปทุมธานี',
  'Pattani': 'ปัตตานี',
  'Phangnga': 'พังงา',
  'Phatthalung': 'พัทลุง',
  'Phayao': 'พะเยา',
  'Phetchabun': 'เพชรบูรณ์',
  'Phetchaburi': 'เพชรบุรี',
  'Phichit': 'พิจิตร',
  'Phitsanulok': 'พิษณุโลก',
  'Phra Nakhon Si Ayutthaya': 'พระนครศรีอยุธยา',
  'Phrae': 'แพร่',
  'Phuket': 'ภูเก็ต',
  'Prachin Buri': 'ปราจีนบุรี',
  'Prachuap Khiri Khan': 'ประจวบคีรีขันธ์',
  'Ranong': 'ระนอง',
  'Ratchaburi': 'ราชบุรี',
  'Rayong': 'ระยอง',
  'Roi Et': 'ร้อยเอ็ด',
  'Sa Kaeo': 'สระแก้ว',
  'Sakon Nakhon': 'สกลนคร',
  'Samut Prakan': 'สมุทรปราการ',
  'Samut Sakhon': 'สมุทรสาคร',
  'Samut Songkhram': 'สมุทรสงคราม',
  'Saraburi': 'สระบุรี',
  'Satun': 'สตูล',
  'Si Sa Ket': 'ศรีสะเกษ',
  'Sing Buri': 'สิงห์บุรี',
  'Songkhla': 'สงขลา',
  'Sukhothai': 'สุโขทัย',
  'Suphan Buri': 'สุพรรณบุรี',
  'Surat Thani': 'สุราษฎร์ธานี',
  'Surin': 'สุรินทร์',
  'Tak': 'ตาก',
  'Trang': 'ตรัง',
  'Trat': 'ตราด',
  'Ubon Ratchathani': 'อุบลราชธานี',
  'Udon Thani': 'อุดรธานี',
  'Uthai Thani': 'อุทัยธานี',
  'Uttaradit': 'อุตรดิตถ์',
  'Yala': 'ยะลา',
  'Yasothon': 'ยโสธร',
};

// Also handle DB names that don't exactly match
const TH_ALIAS: Record<string, string> = {
  'อยุธยา': 'พระนครศรีอยุธยา',
};

// ── Theme ──
const T = {
  navy: '#1B2A4A',
  grey1: '#F3F2F1',
  grey2: '#E1DFDD',
  grey3: '#D2D0CE',
  grey4: '#A19F9D',
  grey5: '#605E5C',
  grey6: '#323130',
  white: '#FFFFFF',
};

// ── Color scale ──
const COLOR_SCALE = [
  '#E8F4FD', // 0 - lightest
  '#B3D9F2',
  '#7DBDE8',
  '#4DA1DE',
  '#2B7BBF',
  '#1B5E9E',
  '#0D3F7A',
  '#082B5A', // 7 - darkest
];

function getColor(value: number, max: number): string {
  if (value === 0) return T.grey2;
  const ratio = Math.min(value / max, 1);
  // Use quantile-like steps
  const idx = Math.min(Math.floor(ratio * COLOR_SCALE.length), COLOR_SCALE.length - 1);
  return COLOR_SCALE[idx];
}

// ── Types ──
interface ProvinceData {
  name: string;
  orders: number;
  weight: number;
}

interface ThailandHeatmapProps {
  data: ProvinceData[];
  metric?: 'orders' | 'weight';
  width?: number;
  height?: number;
}

export default function ThailandHeatmap({ data, metric = 'weight', width = 280, height = 380 }: ThailandHeatmapProps) {
  const [geoData, setGeoData] = useState<FeatureCollection | null>(null);
  const [hoveredProvince, setHoveredProvince] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    fetch('/thailand.json')
      .then(res => res.json())
      .then(d => setGeoData(d as FeatureCollection))
      .catch(err => console.error('Failed to load Thailand GeoJSON:', err));
  }, []);

  const dataMap = useMemo(() => {
    const map = new Map<string, ProvinceData>();
    data.forEach(d => {
      const normalized = TH_ALIAS[d.name] || d.name;
      map.set(normalized, d);
    });
    return map;
  }, [data]);

  const totalOrders = useMemo(() => data.reduce((s, d) => s + d.orders, 0), [data]);
  const totalWeight = useMemo(() => data.reduce((s, d) => s + d.weight, 0), [data]);
  const maxVal = useMemo(() => {
    const vals = data.map(d => d.weight);
    return Math.max(...vals, 1);
  }, [data]);

  // Top 10 provinces by weight
  const sorted = useMemo(() => [...data].sort((a, b) => b.weight - a.weight), [data]);
  const top10 = useMemo(() => sorted.slice(0, 10), [sorted]);
  const othersWeight = useMemo(() => sorted.slice(10).reduce((s, d) => s + d.weight, 0), [sorted]);
  const othersOrders = useMemo(() => sorted.slice(10).reduce((s, d) => s + d.orders, 0), [sorted]);
  const othersCount = useMemo(() => sorted.length - Math.min(sorted.length, 10), [sorted]);

  const projection = useMemo(() => {
    return geoMercator()
      .center([101.5, 13.2])
      .scale(1700)
      .translate([130, 190]);
  }, []);

  const pathGenerator = useMemo(() => geoPath().projection(projection), [projection]);

  const handleMouseMove = useCallback((e: React.MouseEvent, provinceTh: string) => {
    const svgEl = (e.currentTarget as SVGElement).closest('.heatmap-container');
    if (svgEl) {
      const rect = svgEl.getBoundingClientRect();
      setTooltipPos({ x: e.clientX - rect.left + 12, y: e.clientY - rect.top - 8 });
    }
    setHoveredProvince(provinceTh);
  }, []);

  if (!geoData) {
    return (
      <div className="flex items-center justify-center h-40" style={{ color: T.grey4 }}>
        <span className="text-xs">กำลังโหลดแผนที่...</span>
      </div>
    );
  }

  const hoveredData = hoveredProvince ? dataMap.get(hoveredProvince) || dataMap.get(TH_ALIAS[hoveredProvince] || '') : null;
  const barMax = top10.length > 0 ? top10[0].weight : 1;

  return (
    <div className="relative heatmap-container" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="flex-1 flex flex-col min-h-0">
        {/* Legend */}
        <div className="flex items-center gap-2 mb-1 text-[7px] flex-shrink-0" style={{ color: T.grey5 }}>
          <span>0</span>
          <div className="flex items-center flex-1">
            {COLOR_SCALE.map((c, i) => (
              <div key={i} className="flex-1" style={{ height: 5, backgroundColor: c }} />
            ))}
          </div>
          <span>{(maxVal / 1000).toFixed(0)} ตัน</span>
        </div>
        {/* Map */}
        <svg viewBox="-10 -35 290 455" preserveAspectRatio="xMidYMid meet" className="flex-1 min-h-0" style={{ width: '100%', display: 'block' }}>
          {geoData.features.map((feature: Feature<Geometry>, i: number) => {
            const enName = feature.properties?.name || '';
            const thName = EN_TO_TH[enName] || enName;
            const pData = dataMap.get(thName) || dataMap.get(TH_ALIAS[thName] || '');
            const val = pData ? pData.weight : 0;
            const color = getColor(val, maxVal);
            const isHovered = hoveredProvince === thName;
            const d = pathGenerator(feature as any) || '';

            return (
              <path
                key={i}
                d={d}
                fill={color}
                stroke={isHovered ? T.navy : T.white}
                strokeWidth={isHovered ? 1.5 : 0.5}
                opacity={hoveredProvince && !isHovered ? 0.6 : 1}
                style={{ cursor: 'pointer', transition: 'opacity 0.15s, fill 0.15s' }}
                onMouseMove={(e) => handleMouseMove(e, thName)}
                onMouseLeave={() => setHoveredProvince(null)}
              />
            );
          })}
          {/* Top 10 detail legend on right side */}
          <g>
            <text x={168} y={250} fontSize="7" fontWeight="700" fill={T.navy}>Top 10 จังหวัด</text>
            {top10.map((p, idx) => {
              const y = 262 + idx * 13;
              const pct = totalWeight > 0 ? ((p.weight / totalWeight) * 100).toFixed(1) : '0';
              return (
                <g key={`detail-${idx}`}>
                  <circle cx={172} cy={y} r={4.5} fill={T.navy} opacity={0.9} />
                  <text x={172} y={y + 2} textAnchor="middle" fontSize="5.5" fontWeight="700" fill={T.white}>{idx + 1}</text>
                  <text x={180} y={y + 2} fontSize="5.5" fill={T.grey6}>{p.name}</text>
                  <text x={240} y={y + 2} textAnchor="end" fontSize="5.5" fontWeight="600" fill={T.grey6}>{(p.weight / 1000).toFixed(1)}t</text>
                  <text x={265} y={y + 2} textAnchor="end" fontSize="5" fill={T.grey4}>{pct}%</text>
                </g>
              );
            })}
            {othersCount > 0 && (() => {
              const y = 262 + 10 * 13;
              const pct = totalWeight > 0 ? ((othersWeight / totalWeight) * 100).toFixed(1) : '0';
              return (
                <g>
                  <line x1={168} y1={y - 5} x2={265} y2={y - 5} stroke={T.grey3} strokeWidth={0.4} />
                  <text x={172} y={y + 2} fontSize="5.5" fill={T.grey4}>อื่นๆ ({othersCount})</text>
                  <text x={240} y={y + 2} textAnchor="end" fontSize="5.5" fontWeight="600" fill={T.grey5}>{(othersWeight / 1000).toFixed(1)}t</text>
                  <text x={265} y={y + 2} textAnchor="end" fontSize="5" fill={T.grey4}>{pct}%</text>
                </g>
              );
            })()}
            {/* Total row */}
            {(() => {
              const y = 262 + 11 * 13;
              return (
                <g>
                  <line x1={168} y1={y - 5} x2={265} y2={y - 5} stroke={T.navy} strokeWidth={0.6} />
                  <text x={172} y={y + 2} fontSize="5.5" fontWeight="700" fill={T.navy}>รวมทั้งหมด</text>
                  <text x={240} y={y + 2} textAnchor="end" fontSize="5.5" fontWeight="700" fill={T.navy}>{(totalWeight / 1000).toFixed(1)}t</text>
                  <text x={265} y={y + 2} textAnchor="end" fontSize="5" fontWeight="700" fill={T.navy}>100%</text>
                </g>
              );
            })()}
          </g>
        </svg>

      </div>

      {/* Tooltip */}
      {hoveredProvince && (
        <div
          className="absolute pointer-events-none rounded shadow-lg px-2.5 py-1.5 text-[10px] z-50"
          style={{
            left: tooltipPos.x,
            top: tooltipPos.y,
            backgroundColor: 'rgba(27,42,74,0.95)',
            color: T.white,
            transform: 'translateY(-100%)',
          }}
        >
          <div className="font-bold text-[11px] mb-0.5">{hoveredProvince}</div>
          {hoveredData ? (
            <>
              <div>น้ำหนัก: <span className="font-semibold">{(hoveredData.weight / 1000).toFixed(1)} ตัน</span>
                <span className="ml-1 opacity-70">({totalWeight > 0 ? ((hoveredData.weight / totalWeight) * 100).toFixed(1) : 0}%)</span>
              </div>
              <div>ออเดอร์: <span className="font-semibold">{hoveredData.orders.toLocaleString()}</span>
                <span className="ml-1 opacity-70">({totalOrders > 0 ? ((hoveredData.orders / totalOrders) * 100).toFixed(1) : 0}%)</span>
              </div>
            </>
          ) : (
            <div style={{ color: T.grey3 }}>ไม่มีข้อมูล</div>
          )}
        </div>
      )}
    </div>
  );
}
