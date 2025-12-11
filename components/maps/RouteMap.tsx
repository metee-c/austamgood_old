'use client';

import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import StopDetailPopup from './StopDetailPopup';

interface RouteMapProps {
  routes?: any[];
  center?: [number, number];
  zoom?: number;
  warehouse?: any;
  trips?: any[];
  height?: string;
  onTripSelect?: (tripIndex: number | null) => void;
  selectedTripIndices?: number[]; // Multi-select support
  onTripSelectMulti?: (tripIndices: number[]) => void;
  onMoveOrder?: (orderId: number, fromTripId: number, toTripId: number) => Promise<void>;
  onReorderStops?: (tripId: number, orderedStopIds: number[]) => Promise<void>; // สำหรับเปลี่ยนลำดับจุดส่ง
}

const MAPBOX_TOKEN = 'pk.eyJ1IjoieW95b21ldGVlIiwiYSI6ImNtY3U3ZWp5ZDBicDIyanB0czg3d2o2NGoifQ.sdHHSLjh7vr-_w1KrU5f3Q';

const COLORS = [
  '#FF6B6B', // 1. แดง
  '#4ECDC4', // 2. เขียวมิ้นท์
  '#FFD93D', // 3. เหลืองสด
  '#6BCB77', // 4. เขียวสด
  '#4D96FF', // 5. น้ำเงินสด
  '#FF8C42', // 6. ส้มสด
  '#A78BFA', // 7. ม่วงอ่อน
  '#F472B6', // 8. ชมพูสด
  '#34D399', // 9. เขียวมิ้นท์เข้ม
  '#FBBF24', // 10. เหลืองทอง
  '#EF4444', // 11. แดงเข้ม
  '#3B82F6', // 12. น้ำเงินเข้ม
  '#10B981', // 13. เขียวเข้ม
  '#F59E0B', // 14. ส้มเข้ม
  '#8B5CF6', // 15. ม่วงเข้ม
  '#EC4899', // 16. ชมพูเข้ม
  '#14B8A6', // 17. เขียวน้ำทะเล
  '#F97316', // 18. ส้มแดง
  '#06B6D4', // 19. ฟ้าสด
  '#84CC16'  // 20. เขียวมะนาว
];

const RouteMap: React.FC<RouteMapProps> = ({
  routes,
  center = [100.5018, 13.7563],
  zoom = 11,
  warehouse,
  trips = [],
  height = '600px',
  onTripSelect,
  selectedTripIndices,
  onTripSelectMulti,
  onMoveOrder,
  onReorderStops
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [selectedTripIndex, setSelectedTripIndex] = useState<number | null>(null);
  const [internalSelectedIndices, setInternalSelectedIndices] = useState<number[]>([]);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  // Use multi-select if provided, otherwise use single select
  const isMultiSelectMode = onTripSelectMulti !== undefined;
  const activeIndices = isMultiSelectMode ? (selectedTripIndices || internalSelectedIndices) : [];

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: center,
        zoom: zoom
      });

      map.current.on('load', () => {
        setMapLoaded(true);
      });

      // Add navigation controls
      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    } catch (error) {
      console.error('Error initializing map:', error);
    }

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Update map with trips data
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Remove existing route layers
    trips.forEach((_, idx) => {
      const layerId = `route-line-${idx}`;
      const sourceId = `route-${idx}`;
      if (map.current!.getLayer(layerId)) {
        map.current!.removeLayer(layerId);
      }
      if (map.current!.getSource(sourceId)) {
        map.current!.removeSource(sourceId);
      }
    });

    const bounds = new mapboxgl.LngLatBounds();
    let hasValidCoordinates = false;

    // Determine which trips to show
    let tripsToShow: any[];
    let tripIndices: number[];

    if (isMultiSelectMode) {
      // Multi-select mode: show only selected trips (empty if none selected)
      if (activeIndices.length > 0) {
        tripsToShow = activeIndices.map(idx => trips[idx]).filter(Boolean);
        tripIndices = activeIndices;
      } else {
        tripsToShow = [];
        tripIndices = [];
      }
    } else {
      // Single select mode (legacy)
      tripsToShow = selectedTripIndex !== null ? [trips[selectedTripIndex]] : [];
      tripIndices = selectedTripIndex !== null ? [selectedTripIndex] : [];
    }

    // Add warehouse marker
    if (warehouse?.latitude && warehouse?.longitude) {
      const warehouseLng = Number(warehouse.longitude);
      const warehouseLat = Number(warehouse.latitude);
      
      if (Number.isFinite(warehouseLng) && Number.isFinite(warehouseLat)) {
        const el = document.createElement('div');
        el.className = 'warehouse-marker';
        el.style.width = '30px';
        el.style.height = '30px';
        el.style.backgroundImage = 'url(data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAiIGhlaWdodD0iMzAiIHZpZXdCb3g9IjAgMCAzMCAzMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIxNSIgY3k9IjE1IiByPSIxNCIgZmlsbD0iIzM0OThkYiIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIyIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtc2l6ZT0iMTEiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiBmb250LXdlaWdodD0iYm9sZCI+REM8L3RleHQ+PC9zdmc+)';
        el.style.backgroundSize = 'cover';

        const marker = new mapboxgl.Marker(el)
          .setLngLat([warehouseLng, warehouseLat])
          .setPopup(new mapboxgl.Popup().setHTML(`
            <div class="p-2">
              <strong>คลังสินค้า</strong><br/>
              ${warehouse.name || 'Warehouse'}
            </div>
          `))
          .addTo(map.current);

        markersRef.current.push(marker);
        bounds.extend([warehouseLng, warehouseLat]);
        hasValidCoordinates = true;
      }
    }

    // Add trip routes and stops
    tripsToShow.forEach((trip, arrayIndex) => {
      const tripIndex = tripIndices[arrayIndex];
      const color = COLORS[tripIndex % COLORS.length];
      const stops = trip.stops || [];

      stops.forEach((stop: any, stopIndex: number) => {
        const lng = Number(stop.longitude);
        const lat = Number(stop.latitude);

        if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;

        // Create marker element
        const el = document.createElement('div');
        el.className = 'stop-marker';
        el.style.width = '24px';
        el.style.height = '24px';
        el.style.borderRadius = '50%';
        el.style.backgroundColor = color;
        el.style.border = '2px solid white';
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';
        el.style.color = 'white';
        el.style.fontSize = '10px';
        el.style.fontWeight = 'bold';
        el.style.cursor = 'pointer';
        el.textContent = String(stop.sequence_no || stopIndex + 1);

        // Create popup container
        const popupContainer = document.createElement('div');
        const root = ReactDOM.createRoot(popupContainer);

        // Debug: Log stop data
        console.log('🔍 Stop data for popup:', {
          stop_id: stop.stop_id,
          order_id: stop.order_id,
          order_no: stop.order_no,
          trip_id: stop.trip_id,
          fullStop: stop
        });

        // Callback สำหรับเปลี่ยนลำดับจุดส่ง
        const handleReorderStopInPopup = async (stopId: number, newSequenceNo: number) => {
          if (!onReorderStops) return;

          const currentTrip = trips.find(t =>
            t.stops?.some((s: any) => s.stop_id === stopId)
          );

          if (!currentTrip || !currentTrip.stops) return;

          const stops = [...currentTrip.stops];
          const currentIndex = stops.findIndex((s: any) => s.stop_id === stopId);

          if (currentIndex === -1) return;

          const currentSequence = stops[currentIndex].sequence_no;

          // สลับลำดับ: ย้าย stop จาก currentSequence ไป newSequenceNo
          // และเลื่อนที่อื่นให้อัตโนมัติ
          const [movedStop] = stops.splice(currentIndex, 1);
          const newIndex = newSequenceNo - 1; // sequence_no เริ่มจาก 1, array เริ่มจาก 0
          stops.splice(newIndex, 0, movedStop);

          // สร้าง orderedStopIds ตามลำดับใหม่
          const orderedStopIds = stops.map((s: any) => s.stop_id);

          await onReorderStops(currentTrip.trip_id, orderedStopIds);
        };

        // Render React component into popup
        root.render(
          <StopDetailPopup
            stop={stop}
            tripNumber={trip.trip_sequence || tripIndex + 1}
            onMoveOrder={onMoveOrder}
            availableTrips={trips}
            onReorderStop={onReorderStops ? handleReorderStopInPopup : undefined}
            totalStopsInTrip={stops.length}
          />
        );

        const popup = new mapboxgl.Popup({
          maxWidth: '340px',
          className: 'stop-detail-popup'
        }).setDOMContent(popupContainer);

        // สร้าง marker (ไม่ใช้ draggable แล้ว - ใช้ popup แทน)
        const marker = new mapboxgl.Marker(el)
          .setLngLat([lng, lat])
          .setPopup(popup)
          .addTo(map.current!);

        markersRef.current.push(marker);
        bounds.extend([lng, lat]);
        hasValidCoordinates = true;
      });

      // Draw route line using Mapbox Directions API
      if (stops.length > 0) {
        // Build coordinates array starting from warehouse
        const coordinates: [number, number][] = [];
        
        // Add warehouse as starting point if available
        if (warehouse?.latitude && warehouse?.longitude) {
          const warehouseLng = Number(warehouse.longitude);
          const warehouseLat = Number(warehouse.latitude);
          if (Number.isFinite(warehouseLng) && Number.isFinite(warehouseLat)) {
            coordinates.push([warehouseLng, warehouseLat]);
          }
        }
        
        // Add all stops
        stops.forEach((stop: any) => {
          const lng = Number(stop.longitude);
          const lat = Number(stop.latitude);
          if (Number.isFinite(lng) && Number.isFinite(lat)) {
            coordinates.push([lng, lat]);
          }
        });

        if (coordinates.length > 1) {
          const sourceId = `route-${tripIndex}`;
          const layerId = `route-line-${tripIndex}`;

          // Fetch route from Mapbox Directions API
          const coordinatesString = coordinates.map(coord => coord.join(',')).join(';');
          const directionsUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinatesString}?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`;

          fetch(directionsUrl)
            .then(response => response.json())
            .then(data => {
              if (data.routes && data.routes.length > 0) {
                const routeGeometry = data.routes[0].geometry;

                if (map.current!.getSource(sourceId)) {
                  map.current!.removeLayer(layerId);
                  map.current!.removeSource(sourceId);
                }

                map.current!.addSource(sourceId, {
                  type: 'geojson',
                  data: {
                    type: 'Feature',
                    properties: {},
                    geometry: routeGeometry
                  }
                });

                map.current!.addLayer({
                  id: layerId,
                  type: 'line',
                  source: sourceId,
                  layout: {
                    'line-join': 'round',
                    'line-cap': 'round'
                  },
                  paint: {
                    'line-color': color,
                    'line-width': 4,
                    'line-opacity': 0.8
                  }
                });
              }
            })
            .catch(error => {
              console.error('Error fetching route from Mapbox:', error);
              // Fallback to straight line if API fails
              if (map.current!.getSource(sourceId)) {
                map.current!.removeLayer(layerId);
                map.current!.removeSource(sourceId);
              }

              map.current!.addSource(sourceId, {
                type: 'geojson',
                data: {
                  type: 'Feature',
                  properties: {},
                  geometry: {
                    type: 'LineString',
                    coordinates: coordinates
                  }
                }
              });

              map.current!.addLayer({
                id: layerId,
                type: 'line',
                source: sourceId,
                layout: {
                  'line-join': 'round',
                  'line-cap': 'round'
                },
                paint: {
                  'line-color': color,
                  'line-width': 3,
                  'line-opacity': 0.7
                }
              });
            });
        }
      }
    });

    // Fit map to bounds
    if (hasValidCoordinates && !bounds.isEmpty()) {
      map.current.fitBounds(bounds, {
        padding: 50,
        maxZoom: 14
      });
    }

  }, [trips, warehouse, mapLoaded, selectedTripIndex, isMultiSelectMode, activeIndices]);

  return (
    <div 
      ref={mapContainer} 
      style={{ width: '100%', height }} 
      className="rounded-lg overflow-hidden"
    />
  );
};

export default RouteMap;
