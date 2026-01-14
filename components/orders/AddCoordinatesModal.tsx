'use client';
import React, { useState, useEffect, useRef } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import RouteMap from '@/components/maps/RouteMap';
import mapboxgl from 'mapbox-gl';
import { MapPin, Search, Loader2, AlertCircle, CheckCircle, Move } from 'lucide-react';

interface AddCoordinatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: {
    order_no: string;
    customer_id: string;
    shop_name?: string;
    address?: string;
    latitude?: number;  // พิกัดเดิม (ถ้ามี)
    longitude?: number; // พิกัดเดิม (ถ้ามี)
  };
  warehouse: {
    name: string;
    latitude: number;
    longitude: number;
  };
  onSuccess: () => void;
}

type TabType = 'manual' | 'geocode' | 'map';

const MAPBOX_TOKEN = 'pk.eyJ1IjoieW95b21ldGVlIiwiYSI6ImNtY3U3ZWp5ZDBicDIyanB0czg3d2o2NGoifQ.sdHHSLjh7vr-_w1KrU5f3Q';

const AddCoordinatesModal: React.FC<AddCoordinatesModalProps> = ({
  isOpen,
  onClose,
  order,
  warehouse,
  onSuccess
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('geocode');

  // Manual input states
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');

  // Geocoding states
  const [geocodeAddress, setGeocodeAddress] = useState('');
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeResults, setGeocodeResults] = useState<any[]>([]);
  const [selectedResultIndex, setSelectedResultIndex] = useState<number>(0);
  const [geocodeError, setGeocodeError] = useState('');
  const [extractedComponents, setExtractedComponents] = useState<any>(null);

  // Map click states
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [clickedCoords, setClickedCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  // Saving state
  const [saving, setSaving] = useState(false);

  // Preview coordinates
  const [previewCoords, setPreviewCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  // Initialize geocode address from order
  useEffect(() => {
    if (order.address) {
      setGeocodeAddress(order.address);
    }
    // Pre-fill existing coordinates if available
    if (order.latitude && order.longitude) {
      setManualLat(order.latitude.toString());
      setManualLng(order.longitude.toString());
      setPreviewCoords({
        latitude: order.latitude,
        longitude: order.longitude
      });
    }
  }, [order.address, order.latitude, order.longitude]);

  // Initialize map for click-to-place
  useEffect(() => {
    if (!mapContainer.current || map.current || activeTab !== 'map') return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [warehouse.longitude, warehouse.latitude],
        zoom: 12
      });

      map.current.on('load', () => {
        setMapLoaded(true);
      });

      // Add navigation controls
      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

      // Add warehouse marker
      new mapboxgl.Marker({ color: '#3498db' })
        .setLngLat([warehouse.longitude, warehouse.latitude])
        .setPopup(new mapboxgl.Popup().setHTML(`<div class="p-2"><strong>คลังสินค้า</strong><br/>${warehouse.name}</div>`))
        .addTo(map.current);

      // Handle map click
      map.current.on('click', (e) => {
        const { lng, lat } = e.lngLat;

        // Remove existing marker
        if (marker.current) {
          marker.current.remove();
        }

        // Add new marker
        marker.current = new mapboxgl.Marker({ color: '#ef4444', draggable: true })
          .setLngLat([lng, lat])
          .setPopup(new mapboxgl.Popup().setHTML(`<div class="p-2"><strong>ตำแหน่งที่เลือก</strong><br/>${lat.toFixed(6)}, ${lng.toFixed(6)}</div>`))
          .addTo(map.current!);

        // Handle marker drag
        marker.current.on('dragend', () => {
          const lngLat = marker.current!.getLngLat();
          setClickedCoords({
            latitude: lngLat.lat,
            longitude: lngLat.lng
          });
          setPreviewCoords({
            latitude: lngLat.lat,
            longitude: lngLat.lng
          });
        });

        setClickedCoords({
          latitude: lat,
          longitude: lng
        });

        setPreviewCoords({
          latitude: lat,
          longitude: lng
        });
      });

    } catch (error) {
      console.error('Error initializing map:', error);
    }

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [activeTab, warehouse]);

  // Handle geocoding
  const handleGeocode = async () => {
    if (!geocodeAddress.trim()) {
      setGeocodeError('กรุณากรอกที่อยู่');
      return;
    }

    setGeocoding(true);
    setGeocodeError('');
    setGeocodeResults([]);
    setExtractedComponents(null);
    setPreviewCoords(null);
    setSelectedResultIndex(0);

    try {
      const response = await fetch('/api/geocoding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: geocodeAddress })
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        setGeocodeError(result.error || 'ไม่สามารถค้นหาพิกัดได้');
        setExtractedComponents(result.extracted_components || null);
        return;
      }

      if (result.data) {
        // Show only the best result
        setGeocodeResults([result.data]);
        setExtractedComponents(result.extracted_components || null);
        setPreviewCoords({
          latitude: result.data.latitude,
          longitude: result.data.longitude
        });
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      setGeocodeError('เกิดข้อผิดพลาดในการค้นหาพิกัด');
    } finally {
      setGeocoding(false);
    }
  };

  // Handle result selection
  const handleSelectResult = (index: number) => {
    setSelectedResultIndex(index);
    const selected = geocodeResults[index];
    setPreviewCoords({
      latitude: selected.latitude,
      longitude: selected.longitude
    });
  };

  // Handle manual coordinate preview
  const handleManualPreview = () => {
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);

    if (isNaN(lat) || isNaN(lng)) {
      alert('กรุณากรอกพิกัดให้ถูกต้อง');
      return;
    }

    if (lat < -90 || lat > 90) {
      alert('Latitude ต้องอยู่ระหว่าง -90 ถึง 90');
      return;
    }

    if (lng < -180 || lng > 180) {
      alert('Longitude ต้องอยู่ระหว่าง -180 ถึง 180');
      return;
    }

    setPreviewCoords({ latitude: lat, longitude: lng });
  };

  // Handle save coordinates
  const handleSave = async () => {
    let latitude: number;
    let longitude: number;

    if (activeTab === 'manual') {
      const lat = parseFloat(manualLat);
      const lng = parseFloat(manualLng);

      if (isNaN(lat) || isNaN(lng)) {
        alert('กรุณากรอกพิกัดให้ถูกต้อง');
        return;
      }

      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        alert('พิกัดไม่ถูกต้อง');
        return;
      }

      latitude = lat;
      longitude = lng;
    } else if (activeTab === 'geocode') {
      if (geocodeResults.length === 0) {
        alert('กรุณาค้นหาพิกัดก่อน');
        return;
      }

      const selected = geocodeResults[selectedResultIndex];
      latitude = selected.latitude;
      longitude = selected.longitude;
    } else if (activeTab === 'map') {
      if (!clickedCoords) {
        alert('กรุณาคลิกบนแผนที่เพื่อเลือกตำแหน่ง');
        return;
      }

      latitude = clickedCoords.latitude;
      longitude = clickedCoords.longitude;
    } else {
      return;
    }

    setSaving(true);

    // Debug: ตรวจสอบข้อมูลก่อนส่ง
    console.log('📤 Sending to API:', {
      customer_id: order.customer_id,
      order_no: order.order_no,
      latitude,
      longitude
    });

    try {
      const response = await fetch('/api/master-customer/update-coordinates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: order.customer_id,
          order_no: order.order_no,
          latitude,
          longitude
        })
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        alert(`เกิดข้อผิดพลาด: ${result.error || 'ไม่สามารถบันทึกได้'}`);
        return;
      }

      alert('บันทึกพิกัดสำเร็จ');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Save coordinates error:', error);
      alert('เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setSaving(false);
    }
  };

  // Create trips for map preview
  const trips = previewCoords ? [{
    trip_id: 1,
    trip_sequence: 1,
    stops: [{
      stop_id: 1,
      sequence_no: 1,
      order_id: order.order_no,
      order_no: order.order_no,
      shop_name: order.shop_name || '',
      latitude: previewCoords.latitude,
      longitude: previewCoords.longitude
    }]
  }] : [];

  // Determine if editing existing coordinates
  const isEditing = !!(order.latitude && order.longitude);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? `แก้ไขพิกัดสำหรับ ${order.order_no}` : `เพิ่มพิกัดสำหรับ ${order.order_no}`}
      size="4xl"
    >
      <div className="space-y-4">
        {/* Order Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600 font-thai">คำสั่งซื้อ:</span>
              <span className="ml-2 font-semibold font-mono text-blue-600">{order.order_no}</span>
            </div>
            <div>
              <span className="text-gray-600 font-thai">ชื่อร้าน:</span>
              <span className="ml-2 font-semibold font-thai">{order.shop_name || '-'}</span>
            </div>
            <div className="col-span-2">
              <span className="text-gray-600 font-thai">ที่อยู่:</span>
              <span className="ml-2 font-thai text-gray-800">{order.address || '-'}</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <div className="flex space-x-1">
            <button
              className={`px-4 py-2 font-thai text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'geocode'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
              onClick={() => setActiveTab('geocode')}
            >
              <div className="flex items-center space-x-2">
                <Search className="w-4 h-4" />
                <span>ค้นหาจากที่อยู่</span>
              </div>
            </button>
            <button
              className={`px-4 py-2 font-thai text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'map'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
              onClick={() => setActiveTab('map')}
            >
              <div className="flex items-center space-x-2">
                <Move className="w-4 h-4" />
                <span>คลิกบนแผนที่</span>
              </div>
            </button>
            <button
              className={`px-4 py-2 font-thai text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'manual'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
              onClick={() => setActiveTab('manual')}
            >
              <div className="flex items-center space-x-2">
                <MapPin className="w-4 h-4" />
                <span>กรอกพิกัดเอง</span>
              </div>
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="space-y-4">
          {activeTab === 'manual' ? (
            // Manual Input Tab
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 font-thai mb-1">
                    Latitude (ละติจูด)
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    value={manualLat}
                    onChange={(e) => setManualLat(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                    placeholder="เช่น 13.5836207"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 font-thai mb-1">
                    Longitude (ลองจิจูด)
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    value={manualLng}
                    onChange={(e) => setManualLng(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                    placeholder="เช่น 100.7638036"
                  />
                </div>
              </div>
              <Button
                onClick={handleManualPreview}
                variant="secondary"
                className="font-thai"
              >
                <MapPin className="w-4 h-4 mr-2" />
                แสดงตัวอย่างบนแผนที่
              </Button>
            </div>
          ) : activeTab === 'map' ? (
            // Map Click Tab
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm font-thai text-blue-800">
                  <strong>คำแนะนำ:</strong> คลิกบนแผนที่เพื่อเลือกตำแหน่ง หรือลากจุดแดงเพื่อปรับตำแหน่งที่แม่นยำ
                </p>
              </div>
              {clickedCoords && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm font-thai text-green-800">
                    <strong>พิกัดที่เลือก:</strong> {clickedCoords.latitude.toFixed(6)}, {clickedCoords.longitude.toFixed(6)}
                  </p>
                </div>
              )}
              <div
                ref={mapContainer}
                style={{ width: '100%', height: '400px' }}
                className="rounded-lg overflow-hidden border border-gray-300"
              />
            </div>
          ) : (
            // Geocoding Tab
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 font-thai mb-1">
                  ที่อยู่
                </label>
                <textarea
                  value={geocodeAddress}
                  onChange={(e) => setGeocodeAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-thai"
                  rows={3}
                  placeholder="เช่น โครงการ S-Park อาคาร D เลขที่ 89/220 ม.8 ต.คลองหนึ่ง อ.คลองหลวง จ.ปทุมธานี 12120"
                />
              </div>

              <Button
                onClick={handleGeocode}
                disabled={geocoding}
                className="font-thai"
              >
                {geocoding ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    กำลังค้นหา...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    ค้นหาพิกัด
                  </>
                )}
              </Button>

              {/* Geocode Error */}
              {geocodeError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start space-x-2">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-thai text-red-800">{geocodeError}</p>
                  </div>
                </div>
              )}

              {/* Extracted Components Info */}
              {extractedComponents && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm font-semibold text-blue-800 font-thai mb-1">
                    ตรวจพบจากที่อยู่:
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {extractedComponents.province && (
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded font-thai">
                        จ. {extractedComponents.province}
                      </span>
                    )}
                    {extractedComponents.district && (
                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded font-thai">
                        อ. {extractedComponents.district}
                      </span>
                    )}
                    {extractedComponents.subdistrict && (
                      <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded font-thai">
                        ต. {extractedComponents.subdistrict}
                      </span>
                    )}
                    {extractedComponents.village && (
                      <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded font-thai">
                        ม. {extractedComponents.village}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Geocode Results */}
              {geocodeResults.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-gray-700 font-thai">
                      ผลลัพธ์การค้นหา (ตัวเลือกที่ดีที่สุด)
                    </h4>
                    <p className="text-xs text-green-600 font-thai font-semibold">
                      ✓ ตรงกับจังหวัดแล้ว
                    </p>
                  </div>
                  <div className="space-y-2">
                    {geocodeResults.map((result, index) => (
                      <div
                        key={index}
                        onClick={() => handleSelectResult(index)}
                        className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                          selectedResultIndex === index
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <CheckCircle className={`w-4 h-4 ${selectedResultIndex === index ? 'text-blue-600' : 'text-gray-400'}`} />
                              <p className="text-sm font-thai font-semibold text-gray-800">
                                {result.place_name}
                              </p>
                            </div>
                            <div className="ml-6 space-y-1">
                              <p className="text-xs font-mono text-gray-600">
                                {result.latitude.toFixed(6)}, {result.longitude.toFixed(6)}
                              </p>
                              <div className="flex items-center flex-wrap gap-2 text-xs">
                                {result.match_score !== undefined && (
                                  <span className={`font-thai font-semibold ${
                                    result.match_score >= 80 ? 'text-green-600' :
                                    result.match_score >= 50 ? 'text-yellow-600' :
                                    result.match_score >= 30 ? 'text-orange-600' :
                                    'text-red-600'
                                  }`}>
                                    ความตรง: {result.match_score}%
                                  </span>
                                )}
                                <span className={`font-thai ${
                                  result.estimated_error_km < 0.5 ? 'text-green-600' :
                                  result.estimated_error_km < 2 ? 'text-yellow-600' :
                                  'text-orange-600'
                                }`}>
                                  โอกาสคาดเคลื่อน: ~{result.estimated_error_km} km
                                </span>
                                <span className="text-gray-500 font-thai">
                                  ประเภท: {
                                    result.place_type === 'address' ? 'ที่อยู่' :
                                    result.place_type === 'poi' ? 'สถานที่' :
                                    result.place_type === 'neighborhood' ? 'ย่าน' :
                                    result.place_type === 'locality' ? 'ตำบล' :
                                    result.place_type === 'place' ? 'เมือง' :
                                    result.place_type
                                  }
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Map Preview */}
          {previewCoords && activeTab !== 'map' && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-gray-700 font-thai">
                ตัวอย่างเส้นทาง
              </h4>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <RouteMap
                  trips={trips}
                  warehouse={warehouse}
                  height="400px"
                  onTripSelectMulti={() => {}}
                  selectedTripIndices={[0]}
                />
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
          <Button
            onClick={onClose}
            variant="secondary"
            disabled={saving}
            className="font-thai"
          >
            ยกเลิก
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !previewCoords}
            className="font-thai"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                กำลังบันทึก...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                บันทึกพิกัด
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default AddCoordinatesModal;
