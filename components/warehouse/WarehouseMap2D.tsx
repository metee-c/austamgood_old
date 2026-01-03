'use client';

import React, { useState, useMemo } from 'react';
import { ZoneGroup, LocationInventory, getLocationStatus, getStatusColor } from '@/types/warehouse-dashboard';

interface WarehouseMap2DProps {
  zones: ZoneGroup[];
  onLocationClick: (location: LocationInventory) => void;
}

export default function WarehouseMap2D({ zones, onLocationClick }: WarehouseMap2DProps) {
  const [hoveredLocation, setHoveredLocation] = useState<string | null>(null);

  // Create location lookup map
  const locationMap = useMemo(() => {
    const map = new Map<string, LocationInventory>();
    zones.forEach((zone) => {
      zone.locations.forEach((loc) => {
        map.set(loc.location_code, loc);
      });
    });
    return map;
  }, [zones]);

  // Rack rows configuration (6 double rows)
  const rackRows = [
    { id: 1, y: 40, aisles: ['A01', 'A02'] },
    { id: 2, y: 90, aisles: ['A03', 'A04'] },
    { id: 3, y: 140, aisles: ['A05', 'A06'] },
    { id: 4, y: 190, aisles: ['A07', 'A08'] },
    { id: 5, y: 240, aisles: ['A09', 'A10'] },
    { id: 6, y: 290, aisles: ['A10'] }, // A10 is long rack
  ];

  // Docks configuration
  const docks = ['D06', 'D05', 'D04', 'D03', 'D02', 'D01'];

  // Generate rack cells with real data
  const generateRackCells = (startX: number, y: number, width: number, cellCount: number, aisleCode: string) => {
    const cells = [];
    const cellWidth = width / cellCount;

    // Get locations for this aisle
    const aisleLocations = Array.from(locationMap.values())
      .filter((loc) => loc.aisle === aisleCode)
      .sort((a, b) => a.location_code.localeCompare(b.location_code))
      .slice(0, cellCount);

    for (let i = 0; i < cellCount; i++) {
      const loc = aisleLocations[i];
      const color = loc ? getStatusColor(getLocationStatus(loc)) : '#e0e0e0';
      const isHovered = loc && hoveredLocation === loc.location_code;

      cells.push(
        <rect
          key={`${aisleCode}-${i}`}
          x={startX + i * cellWidth}
          y={y}
          width={cellWidth - 1}
          height={18}
          fill={color}
          stroke={isHovered ? '#2563EB' : '#1976d2'}
          strokeWidth={isHovered ? 2 : 0.5}
          style={{ cursor: loc ? 'pointer' : 'default' }}
          onClick={() => loc && onLocationClick(loc)}
          onMouseEnter={() => loc && setHoveredLocation(loc.location_code)}
          onMouseLeave={() => setHoveredLocation(null)}
        >
          {loc && isHovered && (
            <title>{`${loc.location_code}\nSKU: ${loc.sku_count}\nQty: ${loc.total_piece_qty}`}</title>
          )}
        </rect>
      );
    }
    return cells;
  };

  // Generate BLK cells
  const generateBLKCells = (startX: number, y: number, count: number, prefix: string) => {
    const cells = [];
    const cellWidth = 24;

    const blkLocations = Array.from(locationMap.values())
      .filter((loc) => loc.location_code.startsWith(`${prefix}-BLK`))
      .sort((a, b) => {
        const aNum = parseInt(a.location_code.split('-').pop() || '0');
        const bNum = parseInt(b.location_code.split('-').pop() || '0');
        return aNum - bNum;
      })
      .slice(0, count);

    for (let i = 0; i < count; i++) {
      const loc = blkLocations[i];
      const color = loc ? getStatusColor(getLocationStatus(loc)) : '#e3f2fd';
      const isHovered = loc && hoveredLocation === loc.location_code;

      cells.push(
        <rect
          key={`${prefix}-${i}`}
          x={startX + i * cellWidth + 1}
          y={y + 1}
          width={22}
          height={88}
          fill={color}
          stroke={isHovered ? '#2563EB' : '#90caf9'}
          strokeWidth={isHovered ? 2 : 0.5}
          style={{ cursor: loc ? 'pointer' : 'default' }}
          onClick={() => loc && onLocationClick(loc)}
          onMouseEnter={() => loc && setHoveredLocation(loc.location_code)}
          onMouseLeave={() => setHoveredLocation(null)}
        >
          {loc && isHovered && (
            <title>{`${loc.location_code}\nSKU: ${loc.sku_count}\nQty: ${loc.total_piece_qty}`}</title>
          )}
        </rect>
      );
    }
    return cells;
  };

  return (
    <div className="bg-white p-4">
      <h1 className="text-xl font-bold mb-2 text-gray-800 font-thai">Physical Layout - WH001</h1>

      {/* Legend */}
      <div className="flex gap-4 mb-4 text-sm font-thai">
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-gray-300 border border-gray-400"></div>
          <span>ว่าง</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-green-500"></div>
          <span>มีสินค้า</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-yellow-400"></div>
          <span>จองแล้ว</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-red-500"></div>
          <span>เต็ม</span>
        </div>
      </div>

      <div className="border border-gray-300 overflow-auto">
        <svg viewBox="0 0 1200 640" className="w-full" style={{ minWidth: '1100px' }}>
          {/* Background */}
          <rect x="0" y="0" width="1200" height="640" fill="#fafafa" />

          {/* Top header bar */}
          <rect x="900" y="5" width="200" height="20" fill="#c62828" />
          <text x="1000" y="18" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold" className="font-thai">
            พื้นที่รับสินค้า
          </text>

          {/* Dimension labels */}
          <text x="1070" y="45" fill="#c62828" fontSize="8">13.5 M</text>
          <text x="1120" y="60" fill="#c62828" fontSize="8">5 M</text>
          <text x="1120" y="85" fill="#c62828" fontSize="8">3.7 M</text>
          <text x="550" y="100" fill="#c62828" fontSize="8">4.7 M</text>

          {/* Main Storage Racks - 6 double rows */}
          {rackRows.map((row, rowIndex) => {
            const leftAisle = row.aisles[0];
            const rightAisle = row.aisles[1] || row.aisles[0];

            return (
              <g key={row.id} transform={`translate(30, ${row.y})`}>
                {/* Left section of racks */}
                <g>
                  {/* Top row of cells */}
                  <g transform="translate(0, 0)">
                    {generateRackCells(0, 0, 420, 14, leftAisle)}
                  </g>
                  {/* Bottom row of cells */}
                  <g transform="translate(0, 20)">
                    {generateRackCells(0, 0, 420, 14, leftAisle)}
                  </g>
                </g>

                {/* Right section of racks */}
                <g transform="translate(450, 0)">
                  {/* Top row of cells */}
                  <g transform="translate(0, 0)">
                    {generateRackCells(0, 0, 550, 18, rightAisle)}
                  </g>
                  {/* Bottom row of cells */}
                  <g transform="translate(0, 20)">
                    {generateRackCells(0, 0, 550, 18, rightAisle)}
                  </g>
                </g>
              </g>
            );
          })}

          {/* AA-BLK Zone */}
          <g transform="translate(30, 380)">
            <text x="0" y="-5" fill="#c62828" fontSize="9" className="font-thai">AA-BLK-01</text>

            {/* Left group - 17 slots with dashed border */}
            <rect x="0" y="0" width="412" height="90" fill="none" stroke="#1976d2" strokeWidth={1} strokeDasharray="3,2" />
            {generateBLKCells(0, 0, 17, 'AA')}

            {/* 3 Pillars */}
            <rect x="424" y="80" width={8} height={8} fill="#ccc" />
            <rect x="444" y="80" width={8} height={8} fill="#ccc" />
            <rect x="464" y="80" width={8} height={8} fill="#ccc" />

            {/* Right group - 13 slots */}
            <g transform="translate(450, 0)">
              {generateBLKCells(0, 0, 13, 'AA')}
            </g>
            <text x="720" y="45" fill="#333" fontSize="9" className="font-thai">AA-BLK30</text>
          </g>

          {/* AB-BLK Zone */}
          <g transform="translate(30, 510)">
            <text x="0" y="-5" fill="#c62828" fontSize="9" className="font-thai">AB-BLK-01</text>

            {/* Dashed border around entire row */}
            <rect x="0" y="0" width="720" height="90" fill="none" stroke="#90caf9" strokeWidth={1} strokeDasharray="3,2" />

            {/* 30 continuous slots */}
            {generateBLKCells(0, 0, 30, 'AB')}
            <text x="730" y="45" fill="#333" fontSize="9" className="font-thai">AB-BLK30</text>
          </g>

          {/* Picking Zone 1 */}
          <rect x="900" y="380" width="150" height="100" rx="8" fill="#d1c4e9" stroke="#7e57c2" strokeWidth={1} />
          <text x="975" y="435" textAnchor="middle" fill="#4527a0" fontSize="12" fontWeight="bold" className="font-thai">
            Picking Zone 1
          </text>

          {/* Docks Area (D01-D06) */}
          <g transform="translate(1050, 40)">
            {docks.map((dock, index) => (
              <g key={dock} transform={`translate(0, ${index * 50})`}>
                {/* Dock label */}
                <rect x="80" y="5" width="35" height="30" fill="#333" />
                <text x="97" y="25" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">
                  {dock}
                </text>

                {/* Dock lines (staging area) */}
                {[...Array(5)].map((_, i) => (
                  <rect
                    key={i}
                    x={0}
                    y={i * 7}
                    width={70}
                    height={5}
                    fill="none"
                    stroke="#ef5350"
                    strokeWidth={1.5}
                  />
                ))}
              </g>
            ))}
          </g>

          {/* Office Area */}
          <g transform="translate(1060, 410)">
            <pattern id="diagonalHatch" patternUnits="userSpaceOnUse" width="4" height="4">
              <path d="M-1,1 l2,-2 M0,4 l4,-4 M3,5 l2,-2" stroke="#666" strokeWidth="0.5"/>
            </pattern>
            <rect x="0" y="0" width="110" height="200" fill="url(#diagonalHatch)" stroke="#666" strokeWidth={1} />
            <rect x="25" y="85" width="60" height="30" fill="white" />
            <text x="55" y="105" textAnchor="middle" fill="#333" fontSize="12" fontWeight="bold" className="font-thai">
              Office
            </text>
          </g>

          {/* Charge Battery Area */}
          <g transform="translate(900, 540)">
            <rect x="0" y="0" width="100" height="35" fill="#f5f5f5" stroke="#999" strokeWidth={1} />
            <text x="50" y="22" textAnchor="middle" fill="#666" fontSize="9" className="font-thai">
              Charge Battery
            </text>
          </g>

        </svg>
      </div>

      <div className="mt-2 text-sm text-gray-500 font-thai">
        Warehouse Width: 80m × Depth: 60m | Scale: 1:12m
      </div>
    </div>
  );
}
