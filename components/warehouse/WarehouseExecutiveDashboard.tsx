'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, ChevronDown, ArrowUpRight, ArrowDownRight, Minus, Camera } from 'lucide-react';
import html2canvas from 'html2canvas';
import dynamic from 'next/dynamic';

const ThailandHeatmap = dynamic(() => import('./ThailandHeatmap'), { ssr: false });

// ═══════════════════════════════════════════════════════════════
// POWER BI ENTERPRISE THEME
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
interface KPI { actual: number; goal: number; prev: number; label: string }
interface MonthlyRow { month: string; year: number; inbound: number; outbound: number }
interface DailyRow { date: string; inbound: number; outbound: number; inbound_types?: Record<string, number>; outbound_types?: Record<string, number> }
interface ProvinceRow { name: string; orders: number; weight: number; delivered: number }
interface CustomerRow { id: string; name: string; orders: number; qty: number; weight: number; fulfillment: number; trucks: number; shipping_cost: number }
interface StatusRow { status: string; count: number }
interface DashData {
  kpis: Record<string, KPI>;
  monthly: MonthlyRow[];
  daily: DailyRow[];
  provinces: ProvinceRow[];
  top_customers: CustomerRow[];
  status_breakdown: StatusRow[];
  filters: { customers: { id: string; name: string }[]; provinces: string[]; years: number[] };
  meta: { updated: string; year: number; month: number };
}

// ═══════════════════════════════════════════════════════════════
// SVG CHART COMPONENTS (Pure SVG, no library)
// ═══════════════════════════════════════════════════════════════

// ── Sparkline ──
const Sparkline = ({ data, color, w = 80, h = 24 }: { data: number[]; color: string; w?: number; h?: number }) => {
  if (!data.length) return <svg width={w} height={h} />;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const r = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / r) * (h - 4) - 2}`).join(' ');
  return (
    <svg width={w} height={h}>
      <polyline fill="none" stroke={color} strokeWidth="2" points={pts} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

// ── Gauge Ring (KPI) with 3D effect ──
const GaugeRing = ({ pct, color, size = 48 }: { pct: number; color: string; size?: number }) => {
  const r = (size - 8) / 2;
  const c = Math.PI * 2 * r;
  const val = Math.min(Math.max(pct, 0), 100);
  return (
    <svg width={size} height={size} className="block">
      {/* Drop shadow for 3D effect */}
      <defs>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="1" dy="2" stdDeviation="2" floodOpacity="0.25" />
        </filter>
        <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={color} />
          <stop offset="100%" stopColor={color} stopOpacity="0.7" />
        </linearGradient>
      </defs>
      {/* Background track */}
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={T.grey2} strokeWidth="7" filter="url(#shadow)" />
      {/* Progress arc with gradient and glow */}
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" 
        stroke="url(#progressGradient)" strokeWidth="7"
        strokeDasharray={`${(val / 100) * c} ${c}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        filter="url(#shadow)"
        style={{ transition: 'stroke-dasharray 0.8s ease' }}
      />
      {/* Center text */}
      <text x={size / 2} y={size / 2 + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill={T.grey6}>
        {val.toFixed(0)}%
      </text>
    </svg>
  );
};

// ── Column Chart with Data Labels ──
const ColumnChart = ({ data, h = 200, showValues = true }: { data: MonthlyRow[]; h?: number; showValues?: boolean }) => {
  const maxVal = Math.max(...data.map(d => Math.max(d.inbound, d.outbound)), 1);
  const bw = 16;
  const gap = 8;
  const groupW = bw * 2 + gap;
  const totalW = data.length * (groupW + 12);
  const pad = { top: 20, bottom: 36, left: 0 };
  const ch = h - pad.top - pad.bottom;

  return (
    <svg viewBox={`0 0 ${totalW} ${h}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      {[0.25, 0.5, 0.75, 1].map((p, i) => (
        <line key={i} x1="0" y1={pad.top + ch * (1 - p)} x2={totalW} y2={pad.top + ch * (1 - p)}
          stroke={T.grey2} strokeWidth="1" strokeDasharray="3" />
      ))}
      {data.map((d, i) => {
        const x = i * (groupW + 12) + 6;
        const hIb = (d.inbound / maxVal) * ch;
        const hOb = (d.outbound / maxVal) * ch;
        return (
          <g key={i}>
            <rect x={x} y={pad.top + ch - hIb} width={bw} height={hIb} fill={T.blue} rx="2" opacity="0.85" />
            <rect x={x + bw + 2} y={pad.top + ch - hOb} width={bw} height={hOb} fill={T.teal} rx="2" opacity="0.85" />
            {showValues && (
              <>
                <text x={x + bw/2} y={pad.top + ch - hIb - 3} textAnchor="middle" fontSize="7" fill={T.grey5}>{d.inbound > 0 ? (d.inbound/1000).toFixed(1) + 't' : ''}</text>
                <text x={x + bw + 2 + bw/2} y={pad.top + ch - hOb - 3} textAnchor="middle" fontSize="7" fill={T.grey5}>{d.outbound > 0 ? (d.outbound/1000).toFixed(1) + 't' : ''}</text>
              </>
            )}
            <text x={x + groupW / 2} y={h - 8} textAnchor="middle" fontSize="9" fill={T.grey5}>{d.month}</text>
          </g>
        );
      })}
    </svg>
  );
};

// ── Line Chart with Data Points ──
const LineChart = ({ data, h = 180, showPoints = true }: { data: DailyRow[]; h?: number; showPoints?: boolean }) => {
  if (!data.length) return null;
  const maxVal = Math.max(...data.map(d => Math.max(d.inbound, d.outbound)), 1);
  const pad = { top: 20, bottom: 28, left: 4, right: 4 };
  const w = 600;
  const ch = h - pad.top - pad.bottom;
  const cw = w - pad.left - pad.right;

  const getPoint = (d: DailyRow, i: number, key: 'inbound' | 'outbound') => {
    const x = pad.left + (i / (data.length - 1)) * cw;
    const y = pad.top + ch - ((d[key]) / maxVal) * ch;
    return { x, y };
  };

  const toPath = (key: 'inbound' | 'outbound') =>
    data.map((d, i) => {
      const { x, y } = getPoint(d, i, key);
      return `${i === 0 ? 'M' : 'L'}${x},${y}`;
    }).join(' ');

  const labels = [0, 7, 14, 21, 29].filter(i => i < data.length);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      {[0.25, 0.5, 0.75, 1].map((p, i) => (
        <line key={i} x1={pad.left} y1={pad.top + ch * (1 - p)} x2={w - pad.right} y2={pad.top + ch * (1 - p)}
          stroke={T.grey2} strokeWidth="1" strokeDasharray="3" />
      ))}
      <path d={toPath('inbound')} fill="none" stroke={T.blue} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d={toPath('outbound')} fill="none" stroke={T.teal} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {showPoints && data.map((d, i) => {
        const pIn = getPoint(d, i, 'inbound');
        const pOut = getPoint(d, i, 'outbound');
        const showLabel = i === 0 || i === data.length - 1 || i % 5 === 0;
        return (
          <g key={i}>
            <circle cx={pIn.x} cy={pIn.y} r="3" fill={T.blue} />
            <circle cx={pOut.x} cy={pOut.y} r="3" fill={T.teal} />
            {showLabel && (
              <>
                <text x={pIn.x} y={pIn.y - 6} textAnchor="middle" fontSize="7" fill={T.grey5}>{d.inbound > 0 ? (d.inbound/1000).toFixed(1) : '0'}</text>
                <text x={pOut.x} y={pOut.y - 6} textAnchor="middle" fontSize="7" fill={T.grey5}>{d.outbound > 0 ? (d.outbound/1000).toFixed(1) : '0'}</text>
              </>
            )}
          </g>
        );
      })}
      {labels.map(i => (
        <text key={i} x={pad.left + (i / (data.length - 1)) * cw} y={h - 6} textAnchor="middle" fontSize="9" fill={T.grey5}>
          {new Date(data[i].date).getDate()}/{new Date(data[i].date).getMonth() + 1}
        </text>
      ))}
    </svg>
  );
};

// ── Type color maps ──
const IB_COLORS: Record<string, string> = {
  'รับในประเทศ': '#2B5797',
  'รับต่างประเทศ': '#4178BE',
  'การผลิต': '#6699CC',
  'รับสินค้าชำรุด': '#8FB4DD',
  'รับสินค้าหมดอายุ': '#B3CEEC',
  'รับสินค้าตีกลับ': '#D6E6F5',
};
const OB_COLORS: Record<string, string> = {
  'route_planning': '#00A4EF',
  'express': '#4DC4F7',
  'special': '#99DFFB',
  'unknown': '#A19F9D',
};
const OB_LABELS: Record<string, string> = {
  'route_planning': 'จัดเส้นทาง',
  'express': 'ส่งรายชิ้น',
  'special': 'สินค้าพิเศษ',
  'unknown': 'อื่นๆ',
};

// ── Daily Bar Chart (10 days) - stacked by type with % table ──
const DailyBarChart = ({ data, h = 220 }: { data: DailyRow[]; h?: number }) => {
  if (!data.length) return null;
  const maxVal = Math.max(...data.map(d => Math.max(d.inbound, d.outbound)), 1);
  const bw = 14;
  const gap = 2;
  const groupW = bw * 2 + gap;
  const colW = groupW + 6;
  const labelW = 72;
  const totalW = labelW + data.length * colW + 10;
  const pad = { top: 28, bottom: 36, left: labelW, right: 10 };
  const ch = h - pad.top - pad.bottom;

  const getSegments = (types: Record<string, number> | undefined, total: number) => {
    if (!types || total === 0) return [];
    return Object.entries(types).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  };

  // Collect active inbound/outbound types
  const activeIb = Object.keys(IB_COLORS).filter(t => data.some(d => d.inbound_types && d.inbound_types[t]));
  const activeOb = Object.keys(OB_COLORS).filter(t => t !== 'unknown' && data.some(d => d.outbound_types && d.outbound_types[t]));
  const allTypes = [
    ...activeIb.map(t => ({ key: t, label: t.length > 7 ? t.slice(0, 7) + '…' : t, color: IB_COLORS[t], group: 'ib' as const })),
    ...activeOb.map(t => ({ key: t, label: OB_LABELS[t], color: OB_COLORS[t], group: 'ob' as const })),
  ];
  const rowH = 11;
  const tableRows = data.length + 2; // +2 for group header + type header
  const tableH = tableRows * rowH + 6;
  const totalH = h + tableH;

  return (
    <svg viewBox={`0 0 ${totalW} ${totalH}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      {/* Grid lines */}
      {[0.25, 0.5, 0.75, 1].map((p, i) => (
        <line key={i} x1={pad.left} y1={pad.top + ch * (1 - p)} x2={totalW - pad.right} y2={pad.top + ch * (1 - p)}
          stroke={T.grey2} strokeWidth="1" strokeDasharray="3" />
      ))}
      {/* Stacked bars */}
      {data.map((d, i) => {
        const x = pad.left + i * colW + 2;
        const ibTon = d.inbound / 1000;
        const obTon = d.outbound / 1000;

        const ibSegs = getSegments(d.inbound_types, d.inbound);
        let ibY = pad.top + ch;
        const ibRects = ibSegs.map(([type, val], si) => {
          const segH = (val / maxVal) * ch;
          ibY -= segH;
          return <rect key={`ib-${si}`} x={x} y={ibY} width={bw} height={segH} fill={IB_COLORS[type] || '#A19F9D'} rx="1" opacity="0.9" />;
        });

        const obSegs = getSegments(d.outbound_types, d.outbound);
        let obY = pad.top + ch;
        const obRects = obSegs.map(([type, val], si) => {
          const segH = (val / maxVal) * ch;
          obY -= segH;
          return <rect key={`ob-${si}`} x={x + bw + gap} y={obY} width={bw} height={segH} fill={OB_COLORS[type] || '#A19F9D'} rx="1" opacity="0.9" />;
        });

        const hIb = (d.inbound / maxVal) * ch;
        const hOb = (d.outbound / maxVal) * ch;

        return (
          <g key={i}>
            {ibRects.length > 0 ? ibRects : <rect x={x} y={pad.top + ch - hIb} width={bw} height={hIb} fill={T.blue} rx="1" opacity="0.85" />}
            {obRects.length > 0 ? obRects : <rect x={x + bw + gap} y={pad.top + ch - hOb} width={bw} height={hOb} fill={T.teal} rx="1" opacity="0.85" />}
            {ibTon > 0 && <text x={x + bw / 2} y={pad.top + ch - hIb - 3} textAnchor="middle" fontSize="5.5" fill={T.grey5}>{ibTon.toFixed(1)}</text>}
            {obTon > 0 && <text x={x + bw + gap + bw / 2} y={pad.top + ch - hOb - 3} textAnchor="middle" fontSize="5.5" fill={T.grey5}>{obTon.toFixed(1)}</text>}
          </g>
        );
      })}
      {/* X-axis labels */}
      {data.map((d, i) => {
        const x = pad.left + i * colW + 2 + groupW / 2;
        const date = new Date(d.date);
        return (
          <text key={i} x={x} y={h - 10} textAnchor="middle" fontSize="8" fontWeight="600" fill={T.grey5}>
            {date.getDate()}/{date.getMonth() + 1}
          </text>
        );
      })}

      {/* Column divider lines (chart area only) */}
      {data.map((_, i) => {
        const x = pad.left + i * colW - 1;
        return <line key={`div-${i}`} x1={x} y1={pad.top} x2={x} y2={h - 10} stroke={T.grey2} strokeWidth="0.5" />;
      })}
      {/* ── % Breakdown Table (transposed: types as columns, dates as rows) ── */}
      {(() => {
        const baseY = h + 2;
        const dateColW = 28;
        const typeCols = allTypes.length;
        const typeColW = typeCols > 0 ? (totalW - dateColW) / typeCols : 50;
        const nodes: React.ReactNode[] = [];

        // Top border
        nodes.push(<line key="tbl-top" x1={0} y1={baseY} x2={totalW} y2={baseY} stroke={T.grey3} strokeWidth="0.8" />);

        // Row 0: Group headers (สินค้าเข้า / สินค้าออก)
        const ibMid = dateColW + (activeIb.length * typeColW) / 2;
        nodes.push(<text key="ib-ghdr" x={ibMid} y={baseY + 8} textAnchor="middle" fontSize="6.5" fontWeight="700" fill={T.navy}>สินค้าเข้า</text>);
        if (activeOb.length > 0) {
          const obMid = dateColW + activeIb.length * typeColW + (activeOb.length * typeColW) / 2;
          nodes.push(<text key="ob-ghdr" x={obMid} y={baseY + 8} textAnchor="middle" fontSize="6.5" fontWeight="700" fill={T.navy}>สินค้าออก</text>);
          // Vertical divider between groups
          const divX = dateColW + activeIb.length * typeColW;
          nodes.push(<line key="grp-vdiv" x1={divX} y1={baseY} x2={divX} y2={baseY + tableH} stroke={T.grey3} strokeWidth="0.5" />);
        }
        nodes.push(<line key="ghdr-line" x1={0} y1={baseY + rowH} x2={totalW} y2={baseY + rowH} stroke={T.grey3} strokeWidth="0.5" />);

        // Row 1: Type name headers with color dots
        const typeHdrY = baseY + rowH;
        allTypes.forEach((t, ti) => {
          const cx = dateColW + ti * typeColW + typeColW / 2;
          nodes.push(
            <g key={`thdr-${ti}`}>
              <rect x={cx - 16} y={typeHdrY + 2} width={5} height={5} rx="1" fill={t.color} />
              <text x={cx - 9} y={typeHdrY + 7} fontSize="5.5" fill={T.grey6}>{t.label}</text>
            </g>
          );
        });
        nodes.push(<line key="thdr-line" x1={0} y1={typeHdrY + rowH} x2={totalW} y2={typeHdrY + rowH} stroke={T.grey3} strokeWidth="0.8" />);

        // Date column header
        nodes.push(<text key="date-hdr" x={dateColW / 2} y={typeHdrY + 7} textAnchor="middle" fontSize="5.5" fontWeight="600" fill={T.grey5}>วันที่</text>);

        // Vertical divider after date column
        nodes.push(<line key="date-vdiv" x1={dateColW} y1={baseY} x2={dateColW} y2={baseY + tableH} stroke={T.grey3} strokeWidth="0.5" />);

        // Data rows (one per date)
        data.forEach((d, di) => {
          const y = baseY + rowH * 2 + di * rowH;
          const date = new Date(d.date);
          const dateStr = `${date.getDate()}/${date.getMonth() + 1}`;

          // Row divider
          if (di > 0) nodes.push(<line key={`rdiv-${di}`} x1={0} y1={y} x2={totalW} y2={y} stroke={T.grey2} strokeWidth="0.3" />);

          // Date label
          nodes.push(<text key={`dt-${di}`} x={dateColW / 2} y={y + 7} textAnchor="middle" fontSize="6" fontWeight="500" fill={T.grey5}>{dateStr}</text>);

          // Type values
          allTypes.forEach((t, ti) => {
            const cx = dateColW + ti * typeColW + typeColW / 2;
            let val = 0, total = 0;
            if (t.group === 'ib') {
              val = d.inbound_types?.[t.key] || 0;
              total = d.inbound;
            } else {
              val = d.outbound_types?.[t.key] || 0;
              total = d.outbound;
            }
            const pct = total > 0 ? Math.round((val / total) * 100) : 0;
            nodes.push(<text key={`v-${di}-${ti}`} x={cx} y={y + 7} textAnchor="middle" fontSize="6" fill={pct > 0 ? T.grey6 : T.grey3}>{pct > 0 ? `${pct}%` : '-'}</text>);
          });
        });

        // Bottom border
        const bottomY = baseY + rowH * 2 + data.length * rowH;
        nodes.push(<line key="tbl-bot" x1={0} y1={bottomY} x2={totalW} y2={bottomY} stroke={T.grey3} strokeWidth="0.8" />);

        // Vertical column dividers for type columns
        allTypes.forEach((_, ti) => {
          if (ti === 0) return;
          const x = dateColW + ti * typeColW;
          nodes.push(<line key={`tcol-${ti}`} x1={x} y1={baseY + rowH} x2={x} y2={bottomY} stroke={T.grey2} strokeWidth="0.3" />);
        });

        return nodes;
      })()}
    </svg>
  );
};

// ── Horizontal Bar (Province) - weight in tons ──
const HBarChart = ({ data, h = 200 }: { data: ProvinceRow[]; h?: number }) => {
  const top = data.slice(0, 8);
  const maxVal = Math.max(...top.map(d => d.weight), 1);
  const barH = 20;
  const gap = 6;
  const totalH = top.length * (barH + gap);
  const labelW = 80;
  const chartW = 300;

  return (
    <svg viewBox={`0 0 ${labelW + chartW + 60} ${totalH + 10}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      {top.map((d, i) => {
        const y = i * (barH + gap);
        const w = (d.weight / maxVal) * chartW;
        const tons = (d.weight / 1000).toFixed(1);
        return (
          <g key={i}>
            <text x={labelW - 6} y={y + barH / 2 + 4} textAnchor="end" fontSize="10" fill={T.grey5}>
              {d.name.length > 12 ? d.name.slice(0, 12) + '…' : d.name}
            </text>
            <rect x={labelW} y={y} width={w} height={barH} fill={T.teal} rx="3" opacity="0.8" />
            <text x={labelW + w + 6} y={y + barH / 2 + 4} fontSize="10" fontWeight="600" fill={T.grey6}>
              {tons} ตัน
            </text>
          </g>
        );
      })}
    </svg>
  );
};

// ── Donut Chart ──
const DonutChart = ({ data, colors, size = 120 }: { data: { label: string; value: number }[]; colors: string[]; size?: number }) => {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = (size - 16) / 2;
  const c = Math.PI * 2 * r;
  let offset = 0;

  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size}>
        {data.map((d, i) => {
          const pct = d.value / total;
          const dash = pct * c;
          const o = offset;
          offset += dash;
          return (
            <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none"
              stroke={colors[i % colors.length]} strokeWidth="20"
              strokeDasharray={`${dash} ${c - dash}`} strokeDashoffset={-o}
              transform={`rotate(-90 ${size / 2} ${size / 2})`} />
          );
        })}
        <circle cx={size / 2} cy={size / 2} r={r - 14} fill={T.white} />
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

// ═══════════════════════════════════════════════════════════════
// STATUS LABEL MAP
// ═══════════════════════════════════════════════════════════════
const SL: Record<string, string> = {
  draft: 'ร่าง', confirmed: 'ยืนยันแล้ว', in_picking: 'กำลังหยิบ', picked: 'หยิบแล้ว',
  loaded: 'ขึ้นรถแล้ว', in_transit: 'กำลังจัดส่ง', delivered: 'จัดส่งแล้ว', cancelled: 'ยกเลิก',
};

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function WarehouseExecutiveDashboard() {
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'overview' | 'inbound' | 'outbound'>('overview');
  const [sideOpen, setSideOpen] = useState(true);
  const [filters, setFilters] = useState({ customer: '', province: '', year: '', dateFrom: '', dateTo: '' });
  const [capturing, setCapturing] = useState(false);
  const overviewRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (filters.customer) params.set('customer', filters.customer);
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.set('dateTo', filters.dateTo);
      const res = await fetch(`/api/dashboard/executive?${params}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json.data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleExportImage = useCallback(async () => {
    if (!overviewRef.current || capturing) return;
    setCapturing(true);
    try {
      const canvas = await html2canvas(overviewRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: T.grey1,
        logging: false,
      });
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const today = new Date().toISOString().slice(0, 10);
        a.download = `dashboard-overview-${today}.png`;
        a.click();
        URL.revokeObjectURL(url);
      }, 'image/png');
    } catch (e) {
      console.error('Export image error:', e);
    } finally {
      setCapturing(false);
    }
  }, [capturing]);

  // ── Achievement color ──
  const achColor = (actual: number, goal: number, lower = false) => {
    const pct = goal ? (actual / goal) * 100 : 0;
    if (lower) return pct <= 100 ? T.green : pct <= 130 ? T.yellow : T.red;
    return pct >= 100 ? T.green : pct >= 70 ? T.yellow : T.red;
  };

  // ── KPI Card (clean, no gauge, no sparkline) ──
  const KPICard = ({ kpi, color, unit = '', hideCompare = false }: { kpi: KPI; color: string; unit?: string; hideCompare?: boolean }) => {
    const diff = kpi.actual - kpi.prev;
    const diffPct = kpi.prev ? (diff / kpi.prev) * 100 : 0;

    return (
      <div className="rounded-lg p-4 flex flex-col justify-between" style={{ backgroundColor: T.white, border: `1px solid ${T.grey2}` }}>
        <span className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: T.grey4 }}>{kpi.label}</span>
        <div>
          <div className="text-2xl font-bold" style={{ color: T.navy }}>{kpi.actual.toLocaleString()}{unit}</div>
          {!hideCompare && (
            <div className="flex items-center gap-1 mt-1">
              {diff > 0 ? <ArrowUpRight className="w-3 h-3" style={{ color: T.green }} /> :
               diff < 0 ? <ArrowDownRight className="w-3 h-3" style={{ color: T.red }} /> :
               <Minus className="w-3 h-3" style={{ color: T.grey4 }} />}
              <span className="text-xs font-semibold" style={{ color: diff >= 0 ? T.green : T.red }}>
                {diff >= 0 ? '+' : ''}{diffPct.toFixed(1)}% จากก่อนหน้า
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
          <button onClick={fetchData} className="px-4 py-2 rounded text-sm text-white" style={{ backgroundColor: T.accent }}>ลองใหม่</button>
        </div>
      </div>
    );
  }

  const { kpis, monthly, daily, provinces, top_customers, status_breakdown } = data;
  const inboundSpark = daily.map(d => d.inbound);
  const outboundSpark = daily.map(d => d.outbound);
  
  // Thai month names for display
  const thaiMonthNames = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 
                          'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  const currentThaiMonth = thaiMonthNames[data.meta.month - 1];
  const currentThaiYearBE = data.meta.year + 543;
  const donutColors = [T.blue, T.teal, T.green, T.yellow, '#9B59B6', T.red, T.grey4, '#E67E22'];
  const statusLabels = ['draft', 'confirmed', 'in_picking', 'picked', 'loaded', 'in_transit', 'delivered'];

  const tabs = [
    { id: 'overview' as const, label: 'ภาพรวม' },
  ];

  return (
    <div className="flex h-full overflow-hidden" style={{ backgroundColor: T.grey1, fontFamily: "'Segoe UI', system-ui, sans-serif" }}>

      {/* ═══ LEFT SIDEBAR FILTER ═══ */}
      <div
        className="flex-shrink-0 overflow-y-auto transition-all duration-300"
        style={{
          width: sideOpen ? 240 : 0,
          backgroundColor: '#EBF5FF',
          borderRight: `1px solid ${T.grey3}`,
        }}
      >
        {sideOpen && (
          <div className="p-4">
            {/* Sidebar Header */}
            <div className="flex items-center justify-between mb-6">
              <span className="text-sm font-bold tracking-wide" style={{ color: T.navy }}>ตัวกรอง</span>
              <button onClick={() => setSideOpen(false)} style={{ color: T.grey5 }} className="hover:text-navy-800">
                <ChevronDown className="w-4 h-4 rotate-90" />
              </button>
            </div>

            {/* Date Range */}
            <div className="mb-5">
              <label className="block text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: T.grey5 }}>ช่วงวันที่</label>
              <div className="space-y-2">
                <input
                  type="date"
                  value={filters.dateFrom || ''}
                  onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))}
                  className="w-full text-sm rounded px-3 py-2 border-0 focus:outline-none focus:ring-2"
                  style={{ backgroundColor: T.white, color: T.grey6, border: `1px solid ${T.grey3}` }}
                  placeholder="จากวันที่"
                />
                <input
                  type="date"
                  value={filters.dateTo || ''}
                  onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))}
                  className="w-full text-sm rounded px-3 py-2 border-0 focus:outline-none focus:ring-2"
                  style={{ backgroundColor: T.white, color: T.grey6, border: `1px solid ${T.grey3}` }}
                  placeholder="ถึงวันที่"
                />
              </div>
            </div>

            {/* Province */}
            <div className="mb-5">
              <label className="block text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: T.grey5 }}>จังหวัด</label>
              <select
                value={filters.province}
                onChange={e => setFilters(f => ({ ...f, province: e.target.value }))}
                className="w-full text-sm rounded px-3 py-2 border-0 focus:outline-none"
                style={{ backgroundColor: T.white, color: T.grey6, border: `1px solid ${T.grey3}` }}
              >
                <option value="" style={{ color: T.grey6 }}>ทุกจังหวัด</option>
                {data.filters.provinces.map(p => <option key={p} value={p} style={{ color: T.grey6 }}>{p}</option>)}
              </select>
            </div>

            {/* Customer */}
            <div className="mb-5">
              <label className="block text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: T.grey5 }}>ลูกค้า</label>
              <select
                value={filters.customer}
                onChange={e => setFilters(f => ({ ...f, customer: e.target.value }))}
                className="w-full text-sm rounded px-3 py-2 border-0 focus:outline-none"
                style={{ backgroundColor: T.white, color: T.grey6, border: `1px solid ${T.grey3}` }}
              >
                <option value="" style={{ color: T.grey6 }}>ลูกค้าทั้งหมด</option>
                {data.filters.customers.slice(0, 50).map(c => (
                  <option key={c.id} value={c.id} style={{ color: T.grey6 }}>{c.name || c.id}</option>
                ))}
              </select>
            </div>

            {/* Status Legend - 2 colors only */}
            <div className="mt-8">
              <label className="block text-xs font-semibold mb-3 uppercase tracking-wider" style={{ color: T.grey5 }}>สัญลักษณ์</label>
              <div className="space-y-2">
                {[
                  { color: T.green, label: 'ดี (≥80%)' },
                  { color: T.red, label: 'ต่ำ (<80%)' },
                ].map((l, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: l.color }} />
                    <span className="text-xs" style={{ color: T.grey5 }}>{l.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Reset */}
            <button
              onClick={() => setFilters({ customer: '', province: '', year: '', dateFrom: '', dateTo: '' })}
              className="w-full mt-6 py-2 rounded text-xs font-semibold tracking-wide"
              style={{ backgroundColor: T.blue, color: T.white }}
            >
              ล้างตัวกรอง
            </button>
          </div>
        )}
      </div>

      {/* ═══ MAIN CONTENT ═══ */}
      <div className="flex-1 overflow-y-auto">
        {/* ── REPORT HEADER BAR ── */}
        <div className="sticky top-0 z-10 px-5 py-3 flex items-center justify-between"
          style={{ backgroundColor: T.white, borderBottom: `1px solid ${T.grey2}` }}>
          <div className="flex items-center gap-3">
            {!sideOpen && (
              <button onClick={() => setSideOpen(true)} className="p-1 rounded hover:bg-gray-100" title="แสดงตัวกรอง">
                <ChevronDown className="w-4 h-4 -rotate-90" style={{ color: T.grey5 }} />
              </button>
            )}
            <div>
              <h1 className="text-lg font-bold" style={{ color: T.navy }}>รายงานผลการดำเนินงานคลังสินค้า</h1>
              <span className="text-xs" style={{ color: T.grey4 }}>
                {currentThaiMonth} {currentThaiYearBE} • อัปเดตล่าสุด {new Date(data.meta.updated).toLocaleString('th-TH')}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Tab Navigation */}
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="px-4 py-1.5 rounded text-xs font-semibold transition-all"
                style={{
                  backgroundColor: tab === t.id ? T.accent : 'transparent',
                  color: tab === t.id ? T.white : T.grey5,
                }}
              >
                {t.label}
              </button>
            ))}
            <div className="w-px h-6 mx-2" style={{ backgroundColor: T.grey3 }} />
            <button onClick={fetchData} className="p-1.5 rounded hover:bg-gray-100" title="รีเฟรช">
              <RefreshCw className="w-4 h-4" style={{ color: T.grey5 }} />
            </button>
            {tab === 'overview' && (
              <button
                onClick={handleExportImage}
                disabled={capturing}
                className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-50"
                title="บันทึกเป็นภาพ"
              >
                <Camera className="w-4 h-4" style={{ color: capturing ? T.grey4 : T.grey5 }} />
              </button>
            )}
          </div>
        </div>

        {/* ── REPORT BODY ── */}
        <div className="p-5">

          {/* ═══ OVERVIEW TAB ═══ */}
          {tab === 'overview' && (
            <div ref={overviewRef} className="space-y-5">

              {/* KPI CARDS ROW */}
              <div className="grid grid-cols-4 gap-4">
                <KPICard kpi={kpis.inbound} color={T.blue} />
                <KPICard kpi={kpis.ytd_inbound} color={T.blue} hideCompare />
                <KPICard kpi={kpis.outbound} color={T.teal} />
                <KPICard kpi={kpis.ytd_outbound} color={T.teal} hideCompare />
              </div>

              {/* ROW 2: Monthly Chart + Heatmap side by side */}
              <div className="grid grid-cols-12 gap-4 items-stretch">
                {/* Monthly + Daily Comparison */}
                <div className="col-span-7 rounded-lg p-4 flex flex-col" style={{ backgroundColor: T.white, border: `1px solid ${T.grey2}` }}>
                  {/* Monthly */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-bold" style={{ color: T.navy }}>สินค้าเข้า vs สินค้าออก รายเดือน (ตัน)</span>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: T.blue }} /> สินค้าเข้า</span>
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: T.teal }} /> สินค้าออก</span>
                    </div>
                  </div>
                  <ColumnChart data={monthly} h={200} />

                  {/* Divider */}
                  <div className="my-8" style={{ borderTop: `1px solid ${T.grey2}` }} />

                  {/* Daily Trend */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold" style={{ color: T.navy }}>แนวโน้ม 10 วัน (ตัน)</span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mb-2 text-[10px]">
                    <span className="font-semibold" style={{ color: T.grey5 }}>เข้า:</span>
                    {Object.entries(IB_COLORS).map(([k, c]) => (
                      <span key={k} className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{ backgroundColor: c }} />{k}</span>
                    ))}
                    <span className="ml-2 font-semibold" style={{ color: T.grey5 }}>ออก:</span>
                    {Object.entries(OB_COLORS).filter(([k]) => k !== 'unknown').map(([k, c]) => (
                      <span key={k} className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{ backgroundColor: c }} />{OB_LABELS[k]}</span>
                    ))}
                  </div>
                  <DailyBarChart data={daily} h={220} />
                </div>

                {/* Heatmap */}
                <div className="col-span-5 rounded-lg p-3 overflow-hidden flex flex-col" style={{ backgroundColor: T.white, border: `1px solid ${T.grey2}` }}>
                  <span className="text-xs font-bold block mb-1" style={{ color: T.navy }}>การกระจายน้ำหนักตามจังหวัด</span>
                  <div className="flex-1 overflow-hidden">
                    <ThailandHeatmap
                      data={provinces.map(p => ({ name: p.name, orders: p.orders, weight: p.weight }))}
                    />
                  </div>
                </div>
              </div>


              {/* ROW 4: Top 10 Customers Table */}
              <div className="rounded-lg p-4" style={{ backgroundColor: T.white, border: `1px solid ${T.grey2}` }}>
                <span className="text-sm font-bold block mb-3" style={{ color: T.navy }}>ลูกค้า 10 อันดับแรกตามปริมาณออเดอร์</span>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm table-fixed">
                    <colgroup>
                      <col style={{ width: '3%' }} />
                      <col style={{ width: '10%' }} />
                      <col style={{ width: '25%' }} />
                      <col style={{ width: '8%' }} />
                      <col style={{ width: '12%' }} />
                      <col style={{ width: '8%' }} />
                      <col style={{ width: '14%' }} />
                      <col style={{ width: '20%' }} />
                    </colgroup>
                    <thead>
                      <tr style={{ borderBottom: `2px solid ${T.grey2}` }}>
                        {['#', 'รหัส', 'ชื่อร้าน', 'ออเดอร์', 'น้ำหนัก (ตัน)', 'รถ (คัน)', 'ค่าขนส่ง (฿)', 'จัดส่ง %'].map((h, i) => (
                          <th key={i} className={`py-2 px-2 text-xs font-bold uppercase tracking-wider ${i >= 3 ? 'text-right' : 'text-left'}`}
                            style={{ color: T.grey4 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {top_customers.map((c, i) => (
                        <tr key={c.id} style={{ borderBottom: `1px solid ${T.grey2}` }} className="hover:bg-slate-50">
                          <td className="py-2 px-2 font-bold" style={{ color: T.grey4 }}>{i + 1}</td>
                          <td className="py-2 px-2 font-semibold" style={{ color: T.navy }}>{c.id}</td>
                          <td className="py-2 px-2 text-xs overflow-hidden whitespace-nowrap text-ellipsis" style={{ color: T.grey6 }}>
                            {c.name || '-'}
                          </td>
                          <td className="py-2 px-2 text-right font-semibold" style={{ color: T.grey6 }}>{c.orders.toLocaleString()}</td>
                          <td className="py-2 px-2 text-right font-semibold" style={{ color: T.blue }}>{(c.weight / 1000).toFixed(1)}</td>
                          <td className="py-2 px-2 text-right font-semibold" style={{ color: T.accent }}>{c.trucks || '-'}</td>
                          <td className="py-2 px-2 text-right" style={{ color: T.grey6 }}>{c.shipping_cost ? c.shipping_cost.toLocaleString() : '-'}</td>
                          <td className="py-2 px-2 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-14 h-1.5 rounded-full" style={{ backgroundColor: T.grey2 }}>
                                <div className="h-full rounded-full" style={{
                                  width: `${Math.min(c.fulfillment, 100)}%`,
                                  backgroundColor: c.fulfillment >= 85 ? T.green : c.fulfillment >= 60 ? T.yellow : T.red,
                                }} />
                              </div>
                              <span className="font-semibold text-xs" style={{ color: c.fulfillment >= 85 ? T.green : c.fulfillment >= 60 ? T.yellow : T.red }}>
                                {c.fulfillment.toFixed(0)}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {top_customers.length === 0 && (
                        <tr><td colSpan={8} className="py-8 text-center text-xs" style={{ color: T.grey4 }}>ไม่มีข้อมูลลูกค้าสำหรับช่วงเวลานี้</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ═══ INBOUND TAB ═══ */}
          {tab === 'inbound' && (
            <div className="space-y-5">
              <div className="grid grid-cols-3 gap-4">
                <KPICard kpi={kpis.inbound} color={T.blue} />
                <KPICard kpi={kpis.backlog} color={T.yellow} />
                <KPICard kpi={{ actual: daily[daily.length - 1]?.inbound || 0, goal: Math.round((kpis.inbound.actual / Math.max(data.meta.month, 1))), prev: daily[daily.length - 2]?.inbound || 0, label: 'สินค้าเข้าวันนี้' }} color={T.blue} />
              </div>

              <div className="rounded-lg p-4" style={{ backgroundColor: T.white, border: `1px solid ${T.grey2}` }}>
                <span className="text-sm font-bold block mb-3" style={{ color: T.navy }}>แนวโน้มสินค้าเข้ารายวัน (30 วัน)</span>
                <LineChart data={daily} h={220} />
              </div>

              <div className="rounded-lg p-4" style={{ backgroundColor: T.white, border: `1px solid ${T.grey2}` }}>
                <span className="text-sm font-bold block mb-3" style={{ color: T.navy }}>ปริมาณสินค้าเข้ารายเดือน</span>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: `2px solid ${T.grey2}` }}>
                        {['เดือน', 'ปี', 'ปริมาณ', 'กราฟ'].map((h, i) => (
                          <th key={i} className={`py-2 px-3 text-xs font-bold uppercase tracking-wider ${i >= 2 ? 'text-right' : 'text-left'}`}
                            style={{ color: T.grey4 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {monthly.map((m, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${T.grey2}` }}>
                          <td className="py-2 px-3 font-semibold" style={{ color: T.navy }}>{m.month}</td>
                          <td className="py-2 px-3" style={{ color: T.grey5 }}>{m.year}</td>
                          <td className="py-2 px-3 text-right font-semibold" style={{ color: T.grey6 }}>{m.inbound.toLocaleString()}</td>
                          <td className="py-2 px-3">
                            <div className="w-full h-2 rounded-full" style={{ backgroundColor: T.grey2 }}>
                              <div className="h-full rounded-full" style={{
                                width: `${(m.inbound / Math.max(...monthly.map(x => x.inbound), 1)) * 100}%`,
                                backgroundColor: T.blue,
                              }} />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ═══ OUTBOUND TAB ═══ */}
          {tab === 'outbound' && (
            <div className="space-y-5">
              <div className="grid grid-cols-3 gap-4">
                <KPICard kpi={kpis.outbound} color={T.teal} />
                <KPICard kpi={kpis.otif} color={T.green} unit="%" />
                <KPICard kpi={{ actual: daily[daily.length - 1]?.outbound || 0, goal: Math.round((kpis.outbound.actual / Math.max(data.meta.month, 1))), prev: daily[daily.length - 2]?.outbound || 0, label: 'สินค้าออกวันนี้' }} color={T.teal} />
              </div>

              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-8 rounded-lg p-4" style={{ backgroundColor: T.white, border: `1px solid ${T.grey2}` }}>
                  <span className="text-sm font-bold block mb-3" style={{ color: T.navy }}>แนวโน้มสินค้าออกรายวัน (30 วัน)</span>
                  <LineChart data={daily} h={220} />
                </div>
                <div className="col-span-4 rounded-lg p-4" style={{ backgroundColor: T.white, border: `1px solid ${T.grey2}` }}>
                  <span className="text-sm font-bold block mb-3" style={{ color: T.navy }}>สัดส่วนสถานะ</span>
                  <DonutChart
                    data={status_breakdown.map(s => ({ label: SL[s.status] || s.status, value: s.count }))}
                    colors={donutColors}
                    size={110}
                  />
                </div>
              </div>

              <div className="rounded-lg p-4" style={{ backgroundColor: T.white, border: `1px solid ${T.grey2}` }}>
                <span className="text-sm font-bold block mb-3" style={{ color: T.navy }}>ปริมาณสินค้าออกรายเดือน</span>
                <ColumnChart data={monthly} h={200} />
              </div>
            </div>
          )}
        </div>

        {/* ── FOOTER ── */}
        <div className="px-5 py-3 text-center" style={{ borderTop: `1px solid ${T.grey2}` }}>
          <span className="text-xs" style={{ color: T.grey4 }}>
            Austamgood WMS • รายงานผลการดำเนินงานคลังสินค้า • สร้างเมื่อ {new Date().toLocaleDateString('th-TH')}
          </span>
        </div>
      </div>
    </div>
  );
}
