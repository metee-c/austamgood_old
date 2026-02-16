'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════
// POWER BI ENTERPRISE THEME (same as Executive Dashboard)
// ═══════════════════════════════════════════════════════════════
const T = {
  navy: '#1B2A4A',
  blue: '#2B5797',
  teal: '#00A4EF',
  accent: '#0078D4',
  green: '#107C10',
  yellow: '#FFB900',
  red: '#D13438',
  grey1: '#F3F2F1',
  grey2: '#EDEBE9',
  grey3: '#D2D0CE',
  grey4: '#A19F9D',
  grey5: '#605E5C',
  grey6: '#323130',
  white: '#FFFFFF',
};

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════
interface AgingRow {
  bracket: string;
  sku_count: number;
  pallet_count: number;
  weight_kg: number;
  top_skus: Array<{
    sku_id: string;
    name: string;
    qty: number;
    pallets: number;
    weight_kg: number;
  }>;
}

interface CategoryRow {
  class: string;
  sku_count: number;
  total_packs: number;
  weight_kg: number;
}

interface TurnoverRow {
  sku_id: string;
  sku_name: string;
  outbound_qty: number;
  current_stock: number;
  turnover_ratio: number;
}

interface SafetyAlertRow {
  sku_id: string;
  sku_name: string;
  current_qty: number;
  safety_stock: number;
  reorder_point: number;
  status: string;
}

interface SlowDeadRow {
  sku_id: string;
  sku_name: string;
  current_qty: number;
  last_movement_date: string | null;
  days_since_movement: number | null;
}

interface DashData {
  kpis: {
    total_skus: number;
    total_pallets: number;
    total_weight_tons: number;
    total_locations: number;
  };
  aging: AgingRow[];
  category: CategoryRow[];
  turnover_top20: TurnoverRow[];
  turnover_bottom20: TurnoverRow[];
  safety_alerts: SafetyAlertRow[];
  slow_dead_stock: SlowDeadRow[];
  meta: {
    updated: string;
    date: string;
  };
}

// ═══════════════════════════════════════════════════════════════
// SVG CHART COMPONENTS (Pure SVG, no library)
// ═══════════════════════════════════════════════════════════════

// ── Donut Chart ──
const DonutChart = ({ data, colors, size = 120 }: { data: { label: string; value: number }[]; colors: string[]; size?: number }) => {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const strokeWidth = size * 0.15; // 15% of size for better proportion
  const r = (size - strokeWidth) / 2;
  const c = Math.PI * 2 * r;
  let offset = 0;

  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {data.map((d, i) => {
          const pct = d.value / total;
          const dash = pct * c;
          const o = offset;
          offset += dash;
          return (
            <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none"
              stroke={colors[i % colors.length]} strokeWidth={strokeWidth}
              strokeDasharray={`${dash} ${c - dash}`} strokeDashoffset={-o}
              transform={`rotate(-90 ${size / 2} ${size / 2})`} />
          );
        })}
        <circle cx={size / 2} cy={size / 2} r={r - strokeWidth * 0.7} fill={T.white} />
        <text x={size / 2} y={size / 2 + 5} textAnchor="middle" fontSize="14" fontWeight="700" fill={T.grey6}>
          {total.toLocaleString()}
        </text>
      </svg>
      <div className="space-y-1">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: colors[i % colors.length] }} />
            <span style={{ color: T.grey5 }}>{d.label}</span>
            <span className="font-semibold" style={{ color: T.grey6 }}>{d.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Horizontal Bar Chart ──
const HBarChart = ({ data, maxValue, color, h = 200 }: { data: { label: string; value: number }[]; maxValue?: number; color: string; h?: number }) => {
  const top = data.slice(0, 20);
  const maxVal = maxValue || Math.max(...top.map(d => d.value), 1);
  const barH = 20;
  const gap = 6;
  const totalH = top.length * (barH + gap);
  const labelW = 120;
  const chartW = 200;

  return (
    <svg viewBox={`0 0 ${labelW + chartW + 80} ${totalH + 10}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      {top.map((d, i) => {
        const y = i * (barH + gap);
        const w = (d.value / maxVal) * chartW;
        return (
          <g key={i}>
            <text x={labelW - 6} y={y + barH / 2 + 4} textAnchor="end" fontSize="9" fill={T.grey5}>
              {d.label.length > 16 ? d.label.slice(0, 16) + '…' : d.label}
            </text>
            <rect x={labelW} y={y} width={w} height={barH} fill={color} rx="3" opacity="0.8" />
            <text x={labelW + w + 6} y={y + barH / 2 + 4} fontSize="9" fontWeight="600" fill={T.grey6}>
              {d.value.toLocaleString()}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function WarehouseInventoryDashboard() {
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedAgingBracket, setExpandedAgingBracket] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/dashboard/inventory');
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to fetch data');
      setData(json.data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── KPI Card (same style as Executive Dashboard) ──
  const KPICard = ({
    value,
    label,
    color,
    unit = '',
    prevValue = 0,
    hideCompare = false
  }: {
    value: number;
    label: string;
    color: string;
    unit?: string;
    prevValue?: number;
    hideCompare?: boolean;
  }) => {
    const diff = value - prevValue;
    const diffPct = prevValue ? (diff / prevValue) * 100 : 0;

    return (
      <div className="rounded-lg p-4 flex flex-col justify-between relative overflow-hidden"
        style={{ backgroundColor: T.white, border: `1px solid ${T.grey2}`, borderLeft: `4px solid ${color}` }}>
        <span className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color }}>{label}</span>
        <div>
          <div className="text-2xl font-bold" style={{ color: T.navy }}>{value.toLocaleString()}{unit}</div>
          {!hideCompare && (
            <div className="flex items-center gap-1 mt-1">
              {diff > 0 ? <ArrowUpRight className="w-3 h-3" style={{ color: T.green }} /> :
               diff < 0 ? <ArrowDownRight className="w-3 h-3" style={{ color: T.red }} /> :
               <Minus className="w-3 h-3" style={{ color: T.grey4 }} />}
              <span className="text-xs font-semibold" style={{ color: diff >= 0 ? T.green : T.red }}>
                {diff >= 0 ? '+' : ''}{diffPct.toFixed(1)}%
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── LOADING / ERROR ──
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[500px]" style={{ backgroundColor: T.grey1 }}>
        <div className="text-center">
          <div className="w-10 h-10 border-4 rounded-full border-t-transparent animate-spin mx-auto mb-3"
            style={{ borderColor: T.grey3, borderTopColor: T.accent }} />
          <span className="text-sm" style={{ color: T.grey5 }}>กำลังโหลดรายงาน...</span>
        </div>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-full min-h-[500px]" style={{ backgroundColor: T.grey1 }}>
        <div className="text-center">
          <p className="text-sm mb-3" style={{ color: T.red }}>{error || 'ไม่มีข้อมูล'}</p>
          <button onClick={fetchData} className="px-4 py-2 rounded text-sm text-white" style={{ backgroundColor: T.accent }}>
            ลองใหม่
          </button>
        </div>
      </div>
    );
  }

  const { kpis, aging, category, turnover_top20, turnover_bottom20, safety_alerts, slow_dead_stock } = data;

  // Chart colors - white, light blue, dark blue theme
  const agingColors = [T.blue, T.teal, T.accent, T.navy];
  const categoryColors = [T.blue, T.teal, T.accent, T.grey4];

  // Thai month for header
  const thaiMonthNames = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
                          'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  const now = new Date(data.meta.updated);
  const currentThaiMonth = thaiMonthNames[now.getMonth()];
  const currentThaiYearBE = now.getFullYear() + 543;

  // Calculate current month date range (1st day to today)
  const today = new Date(data.meta.date);
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const dateRangeText = `${firstDayOfMonth.getDate()}/${firstDayOfMonth.getMonth() + 1}/${firstDayOfMonth.getFullYear() + 543} - ${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear() + 543}`;

  return (
    <div className="h-full overflow-hidden" style={{ backgroundColor: T.grey1, fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      <div className="h-full overflow-y-auto">
        {/* ── REPORT HEADER BAR ── */}
        <div className="sticky top-0 z-10 px-5 py-3 flex items-center justify-between"
          style={{ backgroundColor: T.white, borderBottom: `1px solid ${T.grey2}` }}>
          <div>
            <h1 className="text-lg font-bold" style={{ color: T.navy }}>รายงานภาพรวมสินค้าคงคลัง</h1>
            <span className="text-xs" style={{ color: T.grey4 }}>
              {currentThaiMonth} {currentThaiYearBE} • อัปเดตล่าสุด {new Date(data.meta.updated).toLocaleString('th-TH')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchData} className="p-1.5 rounded hover:bg-gray-100" title="รีเฟรช">
              <RefreshCw className="w-4 h-4" style={{ color: T.grey5 }} />
            </button>
          </div>
        </div>

        {/* ── REPORT BODY ── */}
        <div className="p-5 space-y-5">

          {/* ROW 1: Aging Donut + Category Donut */}
          <div className="grid grid-cols-12 gap-4">
            {/* Aging Report */}
            <div className="col-span-6 rounded-lg p-4" style={{ backgroundColor: T.white, border: `1px solid ${T.grey2}` }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-bold" style={{ color: T.navy }}>ระยะเวลาสินค้าอยู่ในคลัง</span>
              </div>
              <DonutChart
                data={aging.map(a => ({ label: a.bracket, value: a.pallet_count }))}
                colors={agingColors}
                size={120}
              />
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${T.grey2}` }}>
                      <th className="py-2 px-2 text-left font-bold uppercase tracking-wider text-[10px]" style={{ color: T.grey4 }}>ช่วงอายุ</th>
                      <th className="py-2 px-2 text-right font-bold uppercase tracking-wider text-[10px]" style={{ color: T.grey4 }}>SKU</th>
                      <th className="py-2 px-2 text-right font-bold uppercase tracking-wider text-[10px]" style={{ color: T.grey4 }}>พาเลท</th>
                      <th className="py-2 px-2 text-right font-bold uppercase tracking-wider text-[10px]" style={{ color: T.grey4 }}>น้ำหนัก (ตัน)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aging.map((a, i) => (
                      <React.Fragment key={i}>
                        <tr
                          style={{ borderBottom: expandedAgingBracket === a.bracket ? 'none' : `1px solid ${T.grey2}` }}
                          className="hover:bg-slate-50 cursor-pointer"
                          onClick={() => setExpandedAgingBracket(expandedAgingBracket === a.bracket ? null : a.bracket)}
                        >
                          <td className="py-2 px-2 font-semibold" style={{ color: T.grey6 }}>
                            <span className="flex items-center gap-1">
                              {expandedAgingBracket === a.bracket ? '▼' : '▶'}
                              {a.bracket}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-right" style={{ color: T.grey6 }}>{a.sku_count}</td>
                          <td className="py-2 px-2 text-right" style={{ color: T.grey6 }}>{a.pallet_count}</td>
                          <td className="py-2 px-2 text-right font-semibold" style={{ color: T.navy }}>{(a.weight_kg / 1000).toFixed(1)}</td>
                        </tr>
                        {expandedAgingBracket === a.bracket && a.top_skus.length > 0 && (
                          <tr style={{ borderBottom: `1px solid ${T.grey2}` }}>
                            <td colSpan={4} className="py-3 px-4" style={{ backgroundColor: T.grey1 }}>
                              <div className="text-[10px] font-bold mb-2" style={{ color: T.grey5 }}>TOP 10 สินค้าในช่วงนี้:</div>
                              <table className="w-full text-[10px]">
                                <thead>
                                  <tr style={{ borderBottom: `1px solid ${T.grey3}` }}>
                                    <th className="py-1 px-2 text-left font-semibold" style={{ color: T.grey4 }}>รหัสสินค้า</th>
                                    <th className="py-1 px-2 text-left font-semibold" style={{ color: T.grey4 }}>ชื่อสินค้า</th>
                                    <th className="py-1 px-2 text-right font-semibold" style={{ color: T.grey4 }}>จำนวน</th>
                                    <th className="py-1 px-2 text-right font-semibold" style={{ color: T.grey4 }}>พาเลท</th>
                                    <th className="py-1 px-2 text-right font-semibold" style={{ color: T.grey4 }}>น้ำหนัก (ตัน)</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {a.top_skus.map((s, si) => (
                                    <tr key={si} style={{ borderBottom: `1px solid ${T.grey2}` }}>
                                      <td className="py-1 px-2">
                                        <span className="font-mono text-[9px] px-1 py-0.5 rounded" style={{ backgroundColor: T.grey2, color: T.grey6 }}>
                                          {s.sku_id}
                                        </span>
                                      </td>
                                      <td className="py-1 px-2" style={{ color: T.grey6 }}>{s.name}</td>
                                      <td className="py-1 px-2 text-right font-semibold" style={{ color: T.grey6 }}>{Math.round(s.qty).toLocaleString()}</td>
                                      <td className="py-1 px-2 text-right" style={{ color: T.grey6 }}>{s.pallets}</td>
                                      <td className="py-1 px-2 text-right font-semibold" style={{ color: T.navy }}>{(s.weight_kg / 1000).toFixed(1)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Category Breakdown */}
            <div className="col-span-6 rounded-lg p-4" style={{ backgroundColor: T.white, border: `1px solid ${T.grey2}` }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-bold" style={{ color: T.navy }}>ประเภทสินค้า (ABC Classification)</span>
              </div>
              <DonutChart
                data={category.map(c => ({ label: c.class, value: c.sku_count }))}
                colors={categoryColors}
                size={120}
              />
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${T.grey2}` }}>
                      <th className="py-2 px-2 text-left font-bold uppercase tracking-wider text-[10px]" style={{ color: T.grey4 }}>ประเภท</th>
                      <th className="py-2 px-2 text-right font-bold uppercase tracking-wider text-[10px]" style={{ color: T.grey4 }}>SKU</th>
                      <th className="py-2 px-2 text-right font-bold uppercase tracking-wider text-[10px]" style={{ color: T.grey4 }}>ชิ้น</th>
                      <th className="py-2 px-2 text-right font-bold uppercase tracking-wider text-[10px]" style={{ color: T.grey4 }}>น้ำหนัก (ตัน)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {category.map((c, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${T.grey2}` }} className="hover:bg-slate-50">
                        <td className="py-2 px-2 font-semibold" style={{ color: T.grey6 }}>{c.class}</td>
                        <td className="py-2 px-2 text-right" style={{ color: T.grey6 }}>{c.sku_count}</td>
                        <td className="py-2 px-2 text-right" style={{ color: T.grey6 }}>{c.total_packs.toLocaleString()}</td>
                        <td className="py-2 px-2 text-right font-semibold" style={{ color: T.navy }}>{(c.weight_kg / 1000).toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ROW 2: Turnover Top 10 & Bottom 10 (Side by Side) */}
          <div className="grid grid-cols-2 gap-4">
            {/* Top 10 */}
            <div className="rounded-lg p-4" style={{ backgroundColor: T.white, border: `1px solid ${T.grey2}`, borderLeft: `4px solid ${T.blue}` }}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-sm font-bold" style={{ color: T.blue }}>Top 10 สินค้าเคลื่อนไหวเร็ว (เดือนปัจจุบัน)</span>
                <div className="text-[10px] mt-0.5" style={{ color: T.grey4 }}>{dateRangeText}</div>
              </div>
              <span className="text-[10px]" style={{ color: T.grey4 }}>จัดเรียงตามปริมาณจ่ายออก</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ borderBottom: `2px solid ${T.grey2}` }}>
                    <th className="py-2 px-3 text-left font-bold uppercase tracking-wider text-[10px]" style={{ color: T.grey4 }}>#</th>
                    <th className="py-2 px-3 text-left font-bold uppercase tracking-wider text-[10px]" style={{ color: T.grey4 }}>ชื่อสินค้า</th>
                    <th className="py-2 px-3 text-right font-bold uppercase tracking-wider text-[10px]" style={{ color: T.grey4 }}>จ่ายออก (ถุง)</th>
                    <th className="py-2 px-3 text-left font-bold uppercase tracking-wider text-[10px]" style={{ color: T.grey4 }}>แท่งกราฟ</th>
                  </tr>
                </thead>
                <tbody>
                  {turnover_top20.slice(0, 10).map((t, i) => {
                    const maxVal = Math.max(...turnover_top20.slice(0, 10).map(x => x.outbound_qty), 1);
                    const barWidth = (t.outbound_qty / maxVal) * 100;

                    return (
                      <tr key={i} style={{ borderBottom: `1px solid ${T.grey2}` }} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-bold" style={{ color: T.grey4 }}>{i + 1}</td>
                        <td className="py-2 px-3" style={{ color: T.grey6 }}>{t.sku_name}</td>
                        <td className="py-2 px-3 text-right font-semibold" style={{ color: T.blue }}>{t.outbound_qty.toLocaleString()}</td>
                        <td className="py-2 px-3">
                          <div className="w-full h-4 rounded-sm" style={{ backgroundColor: T.grey2 }}>
                            <div className="h-full rounded-sm" style={{ width: `${barWidth}%`, backgroundColor: T.blue }} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </div>

            {/* Bottom 10 */}
            <div className="rounded-lg p-4" style={{ backgroundColor: T.white, border: `1px solid ${T.grey2}`, borderLeft: `4px solid ${T.teal}` }}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-sm font-bold" style={{ color: T.teal }}>Bottom 10 สินค้าเคลื่อนไหวช้า (เดือนปัจจุบัน)</span>
                <div className="text-[10px] mt-0.5" style={{ color: T.grey4 }}>{dateRangeText}</div>
              </div>
              <span className="text-[10px]" style={{ color: T.grey4 }}>จัดเรียงตามปริมาณจ่ายน้อยสุด</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ borderBottom: `2px solid ${T.grey2}` }}>
                    <th className="py-2 px-3 text-left font-bold uppercase tracking-wider text-[10px]" style={{ color: T.grey4 }}>#</th>
                    <th className="py-2 px-3 text-left font-bold uppercase tracking-wider text-[10px]" style={{ color: T.grey4 }}>ชื่อสินค้า</th>
                    <th className="py-2 px-3 text-right font-bold uppercase tracking-wider text-[10px]" style={{ color: T.grey4 }}>จ่ายออก (ถุง)</th>
                    <th className="py-2 px-3 text-left font-bold uppercase tracking-wider text-[10px]" style={{ color: T.grey4 }}>แท่งกราฟ</th>
                  </tr>
                </thead>
                <tbody>
                  {turnover_bottom20.slice(0, 10).map((t, i) => {
                    const maxVal = Math.max(...turnover_bottom20.slice(0, 10).map(x => x.outbound_qty), 1);
                    const barWidth = (t.outbound_qty / maxVal) * 100;

                    return (
                      <tr key={i} style={{ borderBottom: `1px solid ${T.grey2}` }} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-bold" style={{ color: T.grey4 }}>{i + 1}</td>
                        <td className="py-2 px-3" style={{ color: T.grey6 }}>{t.sku_name}</td>
                        <td className="py-2 px-3 text-right font-semibold" style={{ color: T.teal }}>{t.outbound_qty.toLocaleString()}</td>
                        <td className="py-2 px-3">
                          <div className="w-full h-4 rounded-sm" style={{ backgroundColor: T.grey2 }}>
                            <div className="h-full rounded-sm" style={{ width: `${barWidth}%`, backgroundColor: T.teal }} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </div>
          </div>

          {/* ROW 3: Safety Stock Alerts */}
          {safety_alerts.length > 0 && (
            <div className="rounded-lg p-4" style={{ backgroundColor: T.white, border: `1px solid ${T.grey2}`, borderLeft: `4px solid ${T.accent}` }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-bold" style={{ color: T.accent }}>
                  แจ้งเตือนสินค้าใกล้หมด
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: T.accent + '20', color: T.accent }}>
                  {safety_alerts.length} รายการ
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${T.grey2}` }}>
                      <th className="py-2 px-3 text-left font-bold uppercase tracking-wider text-[10px]" style={{ color: T.grey4 }}>SKU</th>
                      <th className="py-2 px-3 text-left font-bold uppercase tracking-wider text-[10px]" style={{ color: T.grey4 }}>ชื่อสินค้า</th>
                      <th className="py-2 px-3 text-right font-bold uppercase tracking-wider text-[10px]" style={{ color: T.grey4 }}>คงเหลือ (ถุง)</th>
                      <th className="py-2 px-3 text-right font-bold uppercase tracking-wider text-[10px]" style={{ color: T.grey4 }}>Safety Stock</th>
                      <th className="py-2 px-3 text-right font-bold uppercase tracking-wider text-[10px]" style={{ color: T.grey4 }}>Reorder Point</th>
                      <th className="py-2 px-3 text-center font-bold uppercase tracking-wider text-[10px]" style={{ color: T.grey4 }}>สถานะ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {safety_alerts.slice(0, 20).map((a, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${T.grey2}` }} className="hover:bg-slate-50">
                        <td className="py-2 px-3">
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: T.grey2, color: T.grey6 }}>
                            {a.sku_id}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-semibold" style={{ color: T.grey6 }}>{a.sku_name}</td>
                        <td className="py-2 px-3 text-right font-bold" style={{ color: T.accent }}>{a.current_qty.toLocaleString()}</td>
                        <td className="py-2 px-3 text-right" style={{ color: T.grey6 }}>{a.safety_stock || '-'}</td>
                        <td className="py-2 px-3 text-right" style={{ color: T.grey6 }}>{a.reorder_point || '-'}</td>
                        <td className="py-2 px-3 text-center">
                          <span className="px-2 py-1 rounded text-[10px] font-bold"
                            style={{
                              backgroundColor: a.status === 'below_safety' ? T.navy + '20' : T.accent + '20',
                              color: a.status === 'below_safety' ? T.navy : T.accent,
                            }}>
                            {a.status === 'below_safety' ? 'ต่ำกว่า Safety' : 'ต่ำกว่า Reorder'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ROW 4: Slow/Dead Stock */}
          {slow_dead_stock.length > 0 && (
            <div className="rounded-lg p-4" style={{ backgroundColor: T.white, border: `1px solid ${T.grey2}`, borderLeft: `4px solid ${T.grey5}` }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-bold" style={{ color: T.grey5 }}>
                  สินค้าเคลื่อนไหวช้า/หยุดนิ่ง
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: T.grey3, color: T.grey6 }}>
                  {slow_dead_stock.length} รายการ
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${T.grey2}` }}>
                      <th className="py-2 px-3 text-left font-bold uppercase tracking-wider text-[10px]" style={{ color: T.grey4 }}>SKU</th>
                      <th className="py-2 px-3 text-left font-bold uppercase tracking-wider text-[10px]" style={{ color: T.grey4 }}>ชื่อสินค้า</th>
                      <th className="py-2 px-3 text-right font-bold uppercase tracking-wider text-[10px]" style={{ color: T.grey4 }}>คงเหลือ (ถุง)</th>
                      <th className="py-2 px-3 text-right font-bold uppercase tracking-wider text-[10px]" style={{ color: T.grey4 }}>เคลื่อนไหวล่าสุด</th>
                      <th className="py-2 px-3 text-right font-bold uppercase tracking-wider text-[10px]" style={{ color: T.grey4 }}>จำนวนวัน</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slow_dead_stock.slice(0, 20).map((s, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${T.grey2}` }} className="hover:bg-slate-50">
                        <td className="py-2 px-3">
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: T.grey2, color: T.grey6 }}>
                            {s.sku_id}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-semibold" style={{ color: T.grey6 }}>{s.sku_name}</td>
                        <td className="py-2 px-3 text-right font-semibold" style={{ color: T.navy }}>{s.current_qty.toLocaleString()}</td>
                        <td className="py-2 px-3 text-right" style={{ color: T.grey5 }}>
                          {s.last_movement_date || '-'}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <span className="px-2 py-1 rounded text-[10px] font-bold"
                            style={{
                              backgroundColor: (s.days_since_movement || 0) >= 90 ? T.navy + '20' : T.accent + '20',
                              color: (s.days_since_movement || 0) >= 90 ? T.navy : T.accent,
                            }}>
                            {s.days_since_movement ? `${s.days_since_movement} วัน` : 'N/A'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

        {/* ── FOOTER ── */}
        <div className="px-5 py-3 text-center" style={{ borderTop: `1px solid ${T.grey2}` }}>
          <span className="text-xs" style={{ color: T.grey4 }}>
            Austamgood WMS • รายงานภาพรวมสินค้าคงคลัง • สร้างเมื่อ {new Date().toLocaleDateString('th-TH')}
          </span>
        </div>
      </div>
    </div>
  );
}