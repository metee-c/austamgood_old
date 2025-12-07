'use client';

import { useState, useEffect } from 'react';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

interface LoginAttempt {
  attempt_id: number;
  email: string;
  ip_address: string;
  user_agent?: string;
  success: boolean;
  failure_reason?: string;
  created_at: string;
}

interface Statistics {
  total_attempts: number;
  successful_attempts: number;
  failed_attempts: number;
  success_rate: number;
  unique_users: number;
  unique_ips: number;
}

function LoginAttemptsPage() {
  const [attempts, setAttempts] = useState<LoginAttempt[]>([]);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filter states
  const [filters, setFilters] = useState({
    email: '',
    ip_address: '',
    success: '',
    start_date: '',
    end_date: '',
    page: 1,
    limit: 50
  });

  // Fetch login attempts
  const fetchAttempts = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      
      if (filters.email) queryParams.append('email', filters.email);
      if (filters.ip_address) queryParams.append('ip_address', filters.ip_address);
      if (filters.success) queryParams.append('success', filters.success);
      if (filters.start_date) queryParams.append('start_date', filters.start_date);
      if (filters.end_date) queryParams.append('end_date', filters.end_date);
      queryParams.append('page', filters.page.toString());
      queryParams.append('limit', filters.limit.toString());

      const response = await fetch(`/api/auth/login-attempts?${queryParams.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch login attempts');
      }

      setAttempts(data.attempts || []);
      setStatistics(data.statistics || null);
    } catch (err: any) {
      console.error('Error fetching login attempts:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttempts();
  }, [filters.page]);

  if (loading && attempts.length === 0) {
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
          <h1 className="text-3xl font-bold text-gray-900">Login Attempts Monitoring</h1>
          <p className="mt-2 text-gray-600">
            ติดตามและวิเคราะห์ความพยายามในการเข้าสู่ระบบ
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Statistics Cards */}
        {statistics && (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500 mb-1">Total Attempts</div>
              <div className="text-2xl font-bold text-gray-900">{statistics.total_attempts}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500 mb-1">Successful</div>
              <div className="text-2xl font-bold text-green-600">{statistics.successful_attempts}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500 mb-1">Failed</div>
              <div className="text-2xl font-bold text-red-600">{statistics.failed_attempts}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500 mb-1">Success Rate</div>
              <div className="text-2xl font-bold text-blue-600">{statistics.success_rate.toFixed(1)}%</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500 mb-1">Unique Users</div>
              <div className="text-2xl font-bold text-gray-900">{statistics.unique_users}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500 mb-1">Unique IPs</div>
              <div className="text-2xl font-bold text-gray-900">{statistics.unique_ips}</div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">ตัวกรอง</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="text"
                value={filters.email}
                onChange={(e) => setFilters(prev => ({ ...prev, email: e.target.value, page: 1 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="ค้นหาด้วย email"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                IP Address
              </label>
              <input
                type="text"
                value={filters.ip_address}
                onChange={(e) => setFilters(prev => ({ ...prev, ip_address: e.target.value, page: 1 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="ค้นหาด้วย IP"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={filters.success}
                onChange={(e) => setFilters(prev => ({ ...prev, success: e.target.value, page: 1 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">ทั้งหมด</option>
                <option value="true">สำเร็จ</option>
                <option value="false">ล้มเหลว</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                วันที่เริ่มต้น
              </label>
              <input
                type="date"
                value={filters.start_date}
                onChange={(e) => setFilters(prev => ({ ...prev, start_date: e.target.value, page: 1 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                วันที่สิ้นสุด
              </label>
              <input
                type="date"
                value={filters.end_date}
                onChange={(e) => setFilters(prev => ({ ...prev, end_date: e.target.value, page: 1 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={fetchAttempts}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                ค้นหา
              </button>
            </div>
          </div>
        </div>

        {/* Attempts Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Timestamp
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  IP Address
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Failure Reason
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User Agent
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {attempts.map((attempt) => (
                <tr key={attempt.attempt_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(attempt.created_at).toLocaleString('th-TH')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {attempt.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {attempt.ip_address}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      attempt.success
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {attempt.success ? 'สำเร็จ' : 'ล้มเหลว'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {attempt.failure_reason || '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                    {attempt.user_agent || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {attempts.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">ไม่พบข้อมูล login attempts</p>
            </div>
          )}
        </div>

        {/* Pagination */}
        <div className="mt-6 flex justify-between items-center">
          <div className="text-sm text-gray-500">
            หน้า {filters.page}
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setFilters(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
              disabled={filters.page === 1}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              ก่อนหน้า
            </button>
            <button
              onClick={() => setFilters(prev => ({ ...prev, page: prev.page + 1 }))}
              disabled={attempts.length < filters.limit}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              ถัดไป
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginAttemptsPageWithAuth() {
  return (
    <ProtectedRoute allowedRoles={['Admin', 'Super Admin']}>
      <LoginAttemptsPage />
    </ProtectedRoute>
  );
}
