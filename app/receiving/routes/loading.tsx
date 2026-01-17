import { Loader2, Truck, MapPin, Package } from 'lucide-react';

export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header Skeleton */}
        <div className="mb-6">
          <div className="h-8 w-64 bg-gray-200 rounded animate-pulse mb-2"></div>
          <div className="h-4 w-96 bg-gray-200 rounded animate-pulse"></div>
        </div>

        {/* Loading Spinner with Icon */}
        <div className="bg-white rounded-lg shadow-sm p-12 mb-6">
          <div className="flex flex-col items-center justify-center">
            <div className="relative mb-6">
              {/* Animated Icons */}
              <div className="absolute inset-0 flex items-center justify-center">
                <Truck className="w-12 h-12 text-blue-400 animate-pulse" />
              </div>
              <div className="absolute inset-0 flex items-center justify-center animate-spin">
                <Loader2 className="w-20 h-20 text-blue-600" />
              </div>
            </div>

            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              กำลังโหลดข้อมูลแผนจัดเส้นทาง...
            </h2>
            <p className="text-gray-500 text-center max-w-md">
              กรุณารอสักครู่ ระบบกำลังดึงข้อมูลแผนการจัดส่ง เที่ยวรถ และออเดอร์
            </p>

            {/* Loading Steps */}
            <div className="mt-8 space-y-3 w-full max-w-md">
              <LoadingStep icon={<Package />} text="โหลดข้อมูลแผนจัดเส้นทาง" />
              <LoadingStep icon={<Truck />} text="โหลดข้อมูลเที่ยวรถ" delay={200} />
              <LoadingStep icon={<MapPin />} text="โหลดข้อมูลจุดส่ง" delay={400} />
            </div>
          </div>
        </div>

        {/* Content Skeleton */}
        <div className="space-y-4">
          {/* Filter Bar Skeleton */}
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex gap-4">
              <div className="h-10 w-48 bg-gray-200 rounded animate-pulse"></div>
              <div className="h-10 w-48 bg-gray-200 rounded animate-pulse"></div>
              <div className="h-10 w-32 bg-gray-200 rounded animate-pulse"></div>
            </div>
          </div>

          {/* Table Skeleton */}
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <div className="h-6 w-32 bg-gray-200 rounded animate-pulse"></div>
            </div>
            <div className="divide-y divide-gray-200">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="p-4 flex gap-4">
                  <div className="h-12 w-12 bg-gray-200 rounded animate-pulse"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-3/4 bg-gray-200 rounded animate-pulse"></div>
                    <div className="h-3 w-1/2 bg-gray-200 rounded animate-pulse"></div>
                  </div>
                  <div className="h-8 w-24 bg-gray-200 rounded animate-pulse"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoadingStep({ 
  icon, 
  text, 
  delay = 0 
}: { 
  icon: React.ReactNode; 
  text: string; 
  delay?: number;
}) {
  return (
    <div 
      className="flex items-center gap-3 text-gray-600"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="w-5 h-5 animate-pulse">
        {icon}
      </div>
      <span className="text-sm">{text}</span>
      <div className="flex-1 flex items-center gap-1">
        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
      </div>
    </div>
  );
}
