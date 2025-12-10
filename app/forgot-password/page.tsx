'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetToken, setResetToken] = useState(''); // For development only

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setLoading(true);

    try {
      const response = await fetch('/api/auth/password-reset/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'เกิดข้อผิดพลาดในการขอรีเซ็ตรหัสผ่าน');
        setLoading(false);
        return;
      }

      setSuccess(true);
      // In development, show the token
      if (data.token) {
        setResetToken(data.token);
      }
      setLoading(false);
    } catch (err) {
      console.error('Forgot password error:', err);
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-start pt-48 px-4 relative overflow-hidden">
      {/* Background Image */}
      <Image
        src="/images/backgrounds/login.jpg"
        alt="Background"
        fill
        priority
        className="object-cover"
        quality={100}
      />

      {/* System Name at Top */}
      <div className="absolute top-8 left-0 right-0 text-center z-20">
        <h2 className="text-2xl font-bold text-gray-600">AustamGood WMS</h2>
      </div>

      <div className="max-w-md w-full space-y-6 bg-white/60 p-10 shadow-xl relative z-20" style={{ borderRadius: '18px' }}>
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-700">
            ลืมรหัสผ่าน
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            กรอกอีเมลของคุณเพื่อรับลิงก์รีเซ็ตรหัสผ่าน
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 px-4 py-3 rounded-lg">
            <p className="text-sm font-medium text-red-800">{error}</p>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="bg-green-50 border border-green-200 px-4 py-3 rounded-lg">
            <p className="text-sm font-semibold text-green-800 mb-2">
              ส่งคำขอรีเซ็ตรหัสผ่านสำเร็จ
            </p>
            <p className="text-xs text-green-700">
              หากอีเมลนี้มีอยู่ในระบบ เราจะส่งลิงก์รีเซ็ตรหัสผ่านไปให้
            </p>
            {resetToken && (
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                <p className="text-xs font-medium text-yellow-800 mb-1">
                  Development Mode - Reset Token:
                </p>
                <p className="text-xs text-yellow-700 break-all font-mono">
                  {resetToken}
                </p>
                <Link
                  href={`/reset-password?token=${resetToken}`}
                  className="inline-block mt-2 text-xs text-blue-600 hover:text-blue-500 underline"
                >
                  ไปที่หน้ารีเซ็ตรหัสผ่าน
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Form */}
        {!success && (
          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-900 mb-1">
                อีเมล
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 rounded-lg placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="example@company.com"
                disabled={loading}
              />
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-base font-medium rounded-md text-white bg-blue-500 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    กำลังส่งคำขอ...
                  </span>
                ) : (
                  'ส่งลิงก์รีเซ็ตรหัสผ่าน'
                )}
              </button>
            </div>
          </form>
        )}

        {/* Back to Login */}
        <div className="text-center">
          <Link
            href="/login"
            className="text-sm font-bold text-blue-700 hover:text-blue-600"
          >
            ← กลับไปหน้าเข้าสู่ระบบ
          </Link>
        </div>

        {/* Footer */}
        <div className="text-center text-sm font-medium text-gray-500">
          <p>© 2024 Metee Charoensuk</p>
        </div>
      </div>
    </div>
  );
}
