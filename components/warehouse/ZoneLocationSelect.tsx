import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Location } from '@/hooks/useLocations';
import { useLocations } from '@/hooks/useLocations';
import { Search, ChevronDown, ChevronRight, MapPin } from 'lucide-react';

interface ZoneLocationSelectProps {
  warehouseId: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

interface ZoneOption {
  zone: string;
  locations: Location[];
  expanded: boolean;
}

const ZoneLocationSelect: React.FC<ZoneLocationSelectProps> = ({
  warehouseId,
  value,
  onChange,
  disabled = false,
  placeholder = 'เลือกตำแหน่งปลายทาง',
  className = ''
}) => {
  const [selectedZone, setSelectedZone] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [expandedZones, setExpandedZones] = useState<Set<string>>(new Set());
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);

  // Debounce search term to prevent too many API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch all locations for the warehouse
  const { locations: allLocations, loading } = useLocations({
    warehouse_id: warehouseId,
    status: 'active',
    search: debouncedSearch || undefined
  });

  // Group locations by zone
  const zonesData = useMemo(() => {
    if (!allLocations || allLocations.length === 0) return [];

    const zoneMap = new Map<string, Location[]>();
    
    // Group by zone
    allLocations.forEach(location => {
      const zone = location.zone || 'ไม่ระบุโซน';
      if (!zoneMap.has(zone)) {
        zoneMap.set(zone, []);
      }
      zoneMap.get(zone)!.push(location);
    });

    // Convert to array and sort
    const zones: ZoneOption[] = Array.from(zoneMap.entries())
      .map(([zone, locations]) => ({
        zone,
        locations: locations.sort((a, b) => (a.location_code || '').localeCompare(b.location_code || '')),
        expanded: expandedZones.has(zone)
      }))
      .sort((a, b) => {
        // Sort with "ไม่ระบุโซน" at the end
        if (a.zone === 'ไม่ระบุโซน') return 1;
        if (b.zone === 'ไม่ระบุโซน') return -1;
        return a.zone.localeCompare(b.zone);
      });

    return zones;
  }, [allLocations, expandedZones]);

  // Filter zones and locations based on search term (client-side filtering for immediate feedback)
  const filteredZones = useMemo(() => {
    if (!searchTerm.trim()) return zonesData;

    const searchLower = searchTerm.toLowerCase();

    return zonesData
      .map(zoneData => ({
        ...zoneData,
        locations: zoneData.locations.filter(location =>
          (location.location_code || '').toLowerCase().includes(searchLower) ||
          (location.location_name || '').toLowerCase().includes(searchLower) ||
          (location.zone || '').toLowerCase().includes(searchLower)
        )
      }))
      .filter(zoneData =>
        zoneData.zone.toLowerCase().includes(searchLower) ||
        zoneData.locations.length > 0
      );
  }, [zonesData, searchTerm]);

  // Get selected location info
  const selectedLocation = useMemo(() => {
    if (!value) return null;
    return allLocations?.find(loc => loc.location_id === value) || null;
  }, [value, allLocations]);

  // Auto-expand first zone if none selected
  useEffect(() => {
    if (filteredZones.length > 0 && expandedZones.size === 0 && !debouncedSearch) {
      const firstZone = filteredZones[0];
      setExpandedZones(new Set([firstZone.zone]));
    }
  }, [filteredZones, expandedZones, debouncedSearch]);

  const toggleZone = useCallback((zone: string) => {
    setExpandedZones(prev => {
      const newSet = new Set(prev);
      if (newSet.has(zone)) {
        newSet.delete(zone);
      } else {
        newSet.add(zone);
      }
      return newSet;
    });
  }, []);

  const handleLocationSelect = useCallback((locationId: string) => {
    onChange(locationId);
    setIsDropdownOpen(false);
    setSearchTerm('');
  }, [onChange]);

  const handleZoneSelect = useCallback((zone: string) => {
    setSelectedZone(zone);
    // Auto-expand the selected zone
    setExpandedZones(prev => new Set(prev).add(zone));
  }, []);

  const clearSelection = useCallback(() => {
    onChange('');
    setSelectedZone('');
    setSearchTerm('');
  }, [onChange]);

  if (loading) {
    return (
      <div className={`w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 ${className}`}>
        <div className="text-sm text-gray-500">กำลังโหลดข้อมูลตำแหน่ง...</div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* Selected Location Display */}
      <div 
        className={`w-full px-3 py-2 border border-gray-200 rounded-lg cursor-pointer flex items-center justify-between ${
          disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white hover:border-gray-300'
        }`}
        onClick={() => !disabled && setIsDropdownOpen(!isDropdownOpen)}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {selectedLocation ? (
            <>
              <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-gray-900 truncate">
                  {selectedLocation.location_code}
                </div>
                {selectedLocation.location_name && (
                  <div className="text-xs text-gray-500 truncate">
                    {selectedLocation.location_name}
                  </div>
                )}
                {selectedLocation.zone && (
                  <div className="text-xs text-blue-600">
                    โซน: {selectedLocation.zone}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-sm text-gray-500">{placeholder}</div>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
      </div>

      {/* Dropdown */}
      {isDropdownOpen && !disabled && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-96 overflow-hidden">
          {/* Search Box */}
          <div className="p-3 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ค้นหาโซนหรือตำแหน่ง..."
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                autoFocus
              />
            </div>
          </div>

          {/* Info message showing total locations */}
          {!searchTerm && allLocations && allLocations.length > 0 && (
            <div className="px-3 py-2 bg-blue-50 border-b border-blue-100">
              <p className="text-xs text-blue-700">
                📍 พบ {allLocations.length.toLocaleString()} ตำแหน่งทั้งหมด - ใช้การค้นหาเพื่อกรองผลลัพธ์
              </p>
            </div>
          )}

          {/* Zones List */}
          <div className="max-h-80 overflow-y-auto">
            {filteredZones.length === 0 ? (
              <div className="p-4 text-center text-sm text-gray-500">
                {searchTerm ? 'ไม่พบโซนหรือตำแหน่งที่ค้นหา' : 'ไม่มีข้อมูลตำแหน่ง'}
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredZones.map((zoneData) => (
                  <div key={zoneData.zone} className="bg-white">
                    {/* Zone Header */}
                    <div
                      className="px-3 py-2 hover:bg-gray-50 cursor-pointer flex items-center justify-between bg-gray-50"
                      onClick={() => toggleZone(zoneData.zone)}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 flex items-center justify-center">
                          {zoneData.expanded ? (
                            <ChevronDown className="w-3 h-3 text-gray-600" />
                          ) : (
                            <ChevronRight className="w-3 h-3 text-gray-600" />
                          )}
                        </div>
                        <span className="text-sm font-medium text-gray-900">
                          {zoneData.zone}
                        </span>
                        <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded-full">
                          {zoneData.locations.length} ตำแหน่ง
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleZoneSelect(zoneData.zone);
                        }}
                        className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50"
                      >
                        เลือกโซนนี้
                      </button>
                    </div>

                    {/* Locations in Zone */}
                    {zoneData.expanded && (
                      <div className="bg-white border-t border-gray-100">
                        {zoneData.locations.map((location) => (
                          <div
                            key={location.location_id}
                            className={`px-6 py-2 hover:bg-blue-50 cursor-pointer flex items-center gap-2 ${
                              value === location.location_id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                            }`}
                            onClick={() => handleLocationSelect(location.location_id)}
                          >
                            <MapPin className="w-3 h-3 text-gray-400" />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm text-gray-900 truncate">
                                {location.location_code}
                              </div>
                              {location.location_name && (
                                <div className="text-xs text-gray-500 truncate">
                                  {location.location_name}
                                </div>
                              )}
                            </div>
                            {value === location.location_id && (
                              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Clear Button */}
          {value && (
            <div className="p-3 border-t border-gray-200">
              <button
                onClick={clearSelection}
                className="w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg border border-red-200"
              >
                ยกเลิกการเลือก
              </button>
            </div>
          )}
        </div>
      )}

      {/* Click outside to close */}
      {isDropdownOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsDropdownOpen(false)}
        />
      )}
    </div>
  );
};

export default ZoneLocationSelect;
