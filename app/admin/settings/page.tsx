'use client';

import { useState, useEffect } from 'react';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

interface SystemSetting {
  setting_id: number;
  setting_key: string;
  setting_value: string;
  setting_type: 'string' | 'number' | 'boolean' | 'json';
  description?: string;
  module: string;
  updated_at: string;
  updated_by?: number;
}

function SystemSettingsPage() {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [groupedSettings, setGroupedSettings] = useState<Record<string, SystemSetting[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedSetting, setSelectedSetting] = useState<SystemSetting | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  // Fetch settings
  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/auth/settings');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch settings');
      }

      const settingsList = data.settings || [];
      setSettings(settingsList);

      // Group by module
      const grouped = settingsList.reduce((acc: Record<string, SystemSetting[]>, setting: SystemSetting) => {
        const module = setting.module || 'other';
        if (!acc[module]) {
          acc[module] = [];
        }
        acc[module].push(setting);
        return acc;
      }, {});

      setGroupedSettings(grouped);
    } catch (err: any) {
      console.error('Error fetching settings:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Open edit modal
  const openEditModal = (setting: SystemSetting) => {
    setSelectedSetting(setting);
    setEditValue(setting.setting_value);
    setShowEditModal(true);
  };

  // Save setting
  const handleSaveSetting = async () => {
    if (!selectedSetting) return;

    try {
      setSaving(true);
      const response = await fetch(`/api/auth/settings/${selectedSetting.setting_key}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          setting_value: editValue
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update setting');
      }

      setShowEditModal(false);
      setSelectedSetting(null);
      await fetchSettings();
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Render input based on type
  const renderInput = () => {
    if (!selectedSetting) return null;

    switch (selectedSetting.setting_type) {
      case 'boolean':
        return (
          <select
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="true">True</option>
            <option value="false">False</option>
          </select>
        );
      case 'number':
        return (
          <input
            type="number"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        );
      case 'json':
        return (
          <textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            rows={10}
          />
        );
      default:
        return (
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        );
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">System Settings</h1>
          <p className="mt-2 text-gray-600">
            จัดการการตั้งค่าระบบทั้งหมด
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Settings by Module */}
        <div className="space-y-6">
          {Object.entries(groupedSettings).map(([module, moduleSettings]) => (
            <div key={module} className="bg-white rounded-lg shadow overflow-hidden">
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 capitalize">
                  {module.replace('_', ' ')} Settings
                </h2>
              </div>
              <div className="divide-y divide-gray-200">
                {moduleSettings.map((setting) => (
                  <div key={setting.setting_id} className="px-6 py-4 hover:bg-gray-50">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center">
                          <h3 className="text-sm font-medium text-gray-900">
                            {setting.setting_key}
                          </h3>
                          <span className="ml-2 inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                            {setting.setting_type}
                          </span>
                        </div>
                        {setting.description && (
                          <p className="mt-1 text-sm text-gray-500">{setting.description}</p>
                        )}
                        <div className="mt-2">
                          <span className="text-sm text-gray-700">Current Value: </span>
                          <span className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                            {setting.setting_type === 'json' 
                              ? JSON.stringify(JSON.parse(setting.setting_value), null, 2).substring(0, 100) + '...'
                              : setting.setting_value
                            }
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-gray-500">
                          Last updated: {new Date(setting.updated_at).toLocaleString('th-TH')}
                        </div>
                      </div>
                      <button
                        onClick={() => openEditModal(setting)}
                        className="ml-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                      >
                        แก้ไข
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {settings.length === 0 && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-500">ไม่พบการตั้งค่าในระบบ</p>
          </div>
        )}

        {/* Edit Modal */}
        {showEditModal && selectedSetting && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
              <h2 className="text-xl font-bold mb-4">แก้ไขการตั้งค่า</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Setting Key
                  </label>
                  <input
                    type="text"
                    value={selectedSetting.setting_key}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                  />
                </div>

                {selectedSetting.description && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <p className="text-sm text-gray-600">{selectedSetting.description}</p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type
                  </label>
                  <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                    {selectedSetting.setting_type}
                  </span>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Value
                  </label>
                  {renderInput()}
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setShowEditModal(false)}
                  disabled={saving}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleSaveSetting}
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SystemSettingsPageWithAuth() {
  return (
    <ProtectedRoute allowedRoles={['Super Admin']}>
      <SystemSettingsPage />
    </ProtectedRoute>
  );
}
