'use client';

import { useAuthContext } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  User,
  Mail,
  Shield,
  Hash,
  Key,
  LogOut,
  ChevronRight
} from 'lucide-react';

export default function ProfilePage() {
  const { user, logout } = useAuthContext();
  const router = useRouter();

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-thai">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 pb-20">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <button
            onClick={() => router.back()}
            className="flex items-center text-gray-600 hover:text-gray-900 transition-colors font-thai"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            ย้อนกลับ
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Profile Card */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden mb-4">
          {/* Profile Header */}
          <div className="bg-gradient-to-br from-primary-500 to-primary-600 px-6 py-8">
            <div className="flex items-center space-x-4">
              <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center ring-4 ring-white/30">
                <span className="text-3xl font-bold text-white">
                  {user.full_name?.charAt(0).toUpperCase() || user.username?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-white font-thai mb-1">
                  {user.full_name || user.username || 'ไม่ระบุชื่อ'}
                </h2>
                <div className="inline-flex items-center px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full">
                  <Shield className="w-4 h-4 text-white mr-1.5" />
                  <span className="text-sm text-white font-medium font-thai">
                    {user.role_name || 'ไม่ระบุบทบาท'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Profile Details */}
          <div className="px-6 py-5 space-y-1">
            <div className="flex items-center py-3 border-b border-gray-100">
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center mr-4">
                <User className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-500 font-thai mb-0.5">ชื่อผู้ใช้</p>
                <p className="text-gray-900 font-medium font-thai">{user.username || '-'}</p>
              </div>
            </div>

            <div className="flex items-center py-3 border-b border-gray-100">
              <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center mr-4">
                <Mail className="w-5 h-5 text-purple-600" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-500 font-thai mb-0.5">อีเมล</p>
                <p className="text-gray-900 font-medium">{user.email || '-'}</p>
              </div>
            </div>

            <div className="flex items-center py-3">
              <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center mr-4">
                <Hash className="w-5 h-5 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-500 font-thai mb-0.5">User ID</p>
                <p className="text-gray-900 font-medium">{user.user_id || '-'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="space-y-3">
          <button
            onClick={() => router.push('/change-password')}
            className="w-full bg-white rounded-xl shadow-sm p-4 flex items-center justify-between hover:shadow-md transition-all active:scale-[0.98]"
          >
            <div className="flex items-center">
              <div className="w-11 h-11 bg-amber-50 rounded-xl flex items-center justify-center mr-4">
                <Key className="w-5 h-5 text-amber-600" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-gray-900 font-thai">เปลี่ยนรหัสผ่าน</p>
                <p className="text-xs text-gray-500 font-thai">อัพเดทรหัสผ่านของคุณ</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </button>

          <button
            onClick={handleLogout}
            className="w-full bg-white rounded-xl shadow-sm p-4 flex items-center justify-between hover:shadow-md transition-all active:scale-[0.98] border border-red-100"
          >
            <div className="flex items-center">
              <div className="w-11 h-11 bg-red-50 rounded-xl flex items-center justify-center mr-4">
                <LogOut className="w-5 h-5 text-red-600" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-red-600 font-thai">ออกจากระบบ</p>
                <p className="text-xs text-red-400 font-thai">ออกจากบัญชีของคุณ</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-red-400" />
          </button>
        </div>
      </div>
    </div>
  );
}
