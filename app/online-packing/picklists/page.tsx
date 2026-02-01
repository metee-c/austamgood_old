'use client';

import { useState, useEffect } from 'react';
import { ClipboardList, Printer, RefreshCw, Search } from 'lucide-react';
import Button from '@/components/ui/Button';
import { PageContainer, PageHeaderWithFilters, FilterSelect } from '@/components/ui/page-components';

interface OnlinePicklist {
  id: number;
  picklist_code: string;
  platform: string;
  picklist_type: string;
  status: string;
  total_lines: number;
  total_quantity: number;
  notes?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export default function OnlinePicklistsPage() {
  const [picklists, setPicklists] = useState<OnlinePicklist[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState('');

  useEffect(() => {
    fetchPicklists();
  }, []);

  const fetchPicklists = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedStatus) params.append('status', selectedStatus);
      if (selectedPlatform) params.append('platform', selectedPlatform);

      const response = await fetch(`/api/online-picklists?${params.toString()}`);
      const result = await response.json();
      
      if (result.success) {
        setPicklists(result.data || []);
      }
    } catch (error) {
      console.error('Error fetching picklists:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = () => {
    fetchPicklists();
  };

  const handleClear = () => {
    setSelectedStatus('');
    setSelectedPlatform('');
    fetchPicklists();
  };

  const handlePrint = (picklist: OnlinePicklist) => {
    window.open(`/online-packing/picklists/${picklist.id}/print`, '_blank');
  };

  const formatDate = (dateString: string): string => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    return new Intl.DateTimeFormat('th-TH', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const getStatusText = (status: string): string => {
    switch (status) {
      case 'pending': return 'รอดำเนินการ';
      case 'picking': return 'กำลังหยิบ';
      case 'completed': return 'เสร็จสิ้น';
      case 'cancelled': return 'ยกเลิก';
      default: return status;
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'picking': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPlatformColor = (platform: string): string => {
    switch (platform) {
      case 'Shopee': return 'bg-orange-100 text-orange-800';
      case 'Lazada': return 'bg-blue-100 text-blue-800';
      case 'TikTok': case 'TikTok Shop': return 'bg-pink-100 text-pink-800';
      case 'Line': case 'Line Shopping': return 'bg-green-100 text-green-800';
      case 'Facebook': return 'bg-indigo-100 text-indigo-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <PageContainer>
      <PageHeaderWithFilters title="ใบหยิบสินค้าออนไลน์">
        <FilterSelect
          value={selectedPlatform}
          onChange={setSelectedPlatform}
          options={[
            { value: '', label: '-- แพลตฟอร์ม --' },
            { value: 'Shopee', label: 'Shopee' },
            { value: 'Lazada', label: 'Lazada' },
            { value: 'TikTok', label: 'TikTok' },
            { value: 'Line', label: 'Line' },
            { value: 'Facebook', label: 'Facebook' }
          ]}
        />
        <FilterSelect
          value={selectedStatus}
          onChange={setSelectedStatus}
          options={[
            { value: '', label: '-- ทุกสถานะ --' },
            { value: 'pending', label: 'รอดำเนินการ' },
            { value: 'picking', label: 'กำลังหยิบ' },
            { value: 'completed', label: 'เสร็จสิ้น' },
            { value: 'cancelled', label: 'ยกเลิก' }
          ]}
        />
        <Button
          variant="primary"
          size="sm"
          icon={Search}
          onClick={handleSearch}
          loading={isLoading}
          className="text-xs py-1 px-2"
        >
          ค้นหา
        </Button>
        {(selectedPlatform || selectedStatus) && (
          <button
            onClick={handleClear}
            className="px-2 py-1 text-xs text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
          >
            ล้าง
          </button>
        )}
      </PageHeaderWithFilters>

      {/* Main Content */}
      <div className="flex-1 min-h-0 bg-white border rounded-lg shadow-sm flex flex-col overflow-hidden">
        {/* Summary Bar */}
        {picklists.length > 0 && (
          <div className="flex-shrink-0 px-3 py-2 bg-gray-50 border-b flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3 text-[10px]">
              <span className="text-gray-600">ใบหยิบทั้งหมด: <span className="font-semibold text-primary-600">{picklists.length}</span></span>
              <span className="text-gray-600">รอดำเนินการ: <span className="font-semibold text-yellow-600">{picklists.filter(p => p.status === 'pending').length}</span></span>
              <span className="text-gray-600">เสร็จสิ้น: <span className="font-semibold text-green-600">{picklists.filter(p => p.status === 'completed').length}</span></span>
            </div>
            <Button variant="outline" size="sm" onClick={handleSearch} className="text-[10px] py-1 px-2">
              <RefreshCw className="w-3 h-3 mr-1" />
              รีเฟรช
            </Button>
          </div>
        )}

        {/* Table Content */}
        <div className="flex-1 overflow-auto">
          {picklists.length > 0 ? (
            <table className="w-full text-[10px]">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-2 py-1.5 text-left font-semibold text-gray-700 border-b whitespace-nowrap">เลขที่ใบหยิบ</th>
                  <th className="px-2 py-1.5 text-left font-semibold text-gray-700 border-b whitespace-nowrap">ประเภท</th>
                  <th className="px-2 py-1.5 text-left font-semibold text-gray-700 border-b whitespace-nowrap">แพลตฟอร์ม</th>
                  <th className="px-2 py-1.5 text-left font-semibold text-gray-700 border-b whitespace-nowrap">สถานะ</th>
                  <th className="px-2 py-1.5 text-center font-semibold text-gray-700 border-b whitespace-nowrap">รายการ</th>
                  <th className="px-2 py-1.5 text-center font-semibold text-gray-700 border-b whitespace-nowrap">จำนวนชิ้น</th>
                  <th className="px-2 py-1.5 text-left font-semibold text-gray-700 border-b whitespace-nowrap">วันที่สร้าง</th>
                  <th className="px-2 py-1.5 text-center font-semibold text-gray-700 border-b whitespace-nowrap">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {picklists.map((picklist) => (
                  <tr key={picklist.id} className="hover:bg-gray-50 border-b border-gray-100">
                    <td className="px-2 py-1">
                      <div className="flex items-center gap-1">
                        <ClipboardList className="w-3 h-3 text-primary-500" />
                        <span className="font-mono font-medium text-gray-800">{picklist.picklist_code}</span>
                      </div>
                    </td>
                    <td className="px-2 py-1">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                        picklist.picklist_type === 'bonus' 
                          ? 'bg-purple-100 text-purple-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {picklist.picklist_type === 'bonus' ? '🎁 ของแถม' : '📦 สินค้า'}
                      </span>
                    </td>
                    <td className="px-2 py-1">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${getPlatformColor(picklist.platform)}`}>
                        {picklist.platform}
                      </span>
                    </td>
                    <td className="px-2 py-1">
                      <span className={`px-1.5 py-0.5 rounded border text-[9px] font-medium ${getStatusColor(picklist.status)}`}>
                        {getStatusText(picklist.status)}
                      </span>
                    </td>
                    <td className="px-2 py-1 text-center font-medium text-gray-700">{picklist.total_lines}</td>
                    <td className="px-2 py-1 text-center font-semibold text-primary-600">{picklist.total_quantity}</td>
                    <td className="px-2 py-1 text-gray-600">{formatDate(picklist.created_at)}</td>
                    <td className="px-2 py-1 text-center">
                      <button
                        onClick={() => handlePrint(picklist)}
                        className="p-1 hover:bg-gray-100 rounded text-gray-600 hover:text-primary-600"
                        title="พิมพ์ใบหยิบ"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center py-16 text-gray-400">
              <ClipboardList className="w-12 h-12 mb-3 opacity-50" />
              <p className="text-sm font-medium">ไม่พบใบหยิบสินค้าออนไลน์</p>
              <p className="text-xs mt-1">กดปุ่ม "ปริ้นจัดสินค้า" ที่หน้า ERP เพื่อสร้างใบหยิบใหม่</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-3 py-1.5 border-t bg-gray-50 flex items-center justify-between text-[10px] text-gray-500">
          <div>
            <span>รายการใบหยิบ: {picklists.length} รายการ</span>
          </div>
          <div className="flex items-center gap-2">
            <span>รวมจำนวนชิ้น: {picklists.reduce((sum, p) => sum + (p.total_quantity || 0), 0)} ชิ้น</span>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
