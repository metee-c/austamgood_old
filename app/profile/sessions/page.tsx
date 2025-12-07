'use client';

import { useState, useEffect } from 'react';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { useAuthContext } from '@/contexts/AuthContext';

interface Session {
  session_id: string;
  created_at: string;
  last_activity: string;
  ip_address?: string;
  user_agent?: string;
}

function UserSessionsPage() {
  const { user } = useAuthContext();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Fetch user sessions
  const fetchSessions = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/auth/sessions');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch sessions');
      }

      setSessions(data.sessions || []);
      setCurrentSessionId(data.current_session_id || '');
    } catch (err: any) {
      console.error('Error fetching sessions:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Invalidate other sessions
  const handleInvalidateOtherSessions = async () => {
    if (!confirm('คุณแน่ใจหรือไม่ที่จะออกจากระบบในอุปกรณ์อื่นๆ ทั้งหมด?')) {
      return;
    }

    try {
      setActionLoading('invalidate_others');
      const response = await fetch('/api/auth/sessions', {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to invalidate sessions');
      }

      alert(`ออกจากระบบในอุปกรณ์อื่นๆ สำเร็จ (${data.invalidated_count} sessions)`);

      await fetchSessions();
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Invalidate specific session
  const handleInvalidateSession = async (sessionId: string) => {
    if (!confirm('คุณแน่ใจหรือไม่ที่จะออกจากระบบในอุปกรณ์นี้?')) {
      return;
    }

    try {
      setActionLoading(sessionId);
      const response = await fetch(`/api/auth/sessions/${sessionId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to invalidate session');
      }

      alert('ออกจากระบบสำเร็จ');
      await fetchSessions();
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  useEffect(() => {
    fetchSessions();
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
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">จัดการ Sessions</h1>
          <p className="mt-2 text-gray-600">
            ดูและจัดการอุปกรณ์ที่เข้าสู่ระบบด้วยบัญชีของคุณ
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="mb-6 flex justify-between items-center">
          <div className="text-sm text-gray-500">
            ทั้งหมด {sessions.length} sessions
          </div>
          <button
            onClick={handleInvalidateOtherSessions}
            disabled={actionLoading === 'invalidate_others' || sessions.length <= 1}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {actionLoading === 'invalidate_others' ? 'กำลังประมวลผล...' : 'ออกจากระบบอุปกรณ์อื่นๆ ทั้งหมด'}
          </button>
        </div>

        {/* Sessions List */}
        <div className="space-y-4">
          {sessions.map((session) => {
            const isCurrentSession = session.session_id === currentSessionId;
            const lastActivity = new Date(session.last_activity);
            const createdAt = new Date(session.created_at);

            return (
              <div
                key={session.session_id}
                className={`bg-white rounded-lg shadow p-6 ${
                  isCurrentSession ? 'border-2 border-blue-500' : 'border border-gray-200'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    {/* Session Header */}
                    <div className="flex items-center mb-3">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {session.user_agent || 'Unknown Device'}
                        </h3>
                        {isCurrentSession && (
                          <span className="inline-block mt-1 px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-800 rounded-full">
                            อุปกรณ์ปัจจุบัน
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Session Details */}
                    <div className="space-y-2 text-sm text-gray-600">
                      <div className="flex items-center">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span>IP Address: {session.ip_address || 'Unknown'}</span>
                      </div>
                      <div className="flex items-center">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>เข้าสู่ระบบเมื่อ: {createdAt.toLocaleString('th-TH')}</span>
                      </div>
                      <div className="flex items-center">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        <span>ใช้งานล่าสุด: {lastActivity.toLocaleString('th-TH')}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  {!isCurrentSession && (
                    <button
                      onClick={() => handleInvalidateSession(session.session_id)}
                      disabled={actionLoading === session.session_id}
                      className="ml-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors text-sm"
                    >
                      {actionLoading === session.session_id ? 'กำลังออก...' : 'ออกจากระบบ'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {sessions.length === 0 && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-gray-500">ไม่พบ sessions ที่ active</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function UserSessionsPageWithAuth() {
  return (
    <ProtectedRoute>
      <UserSessionsPage />
    </ProtectedRoute>
  );
}
