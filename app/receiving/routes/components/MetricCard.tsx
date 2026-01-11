'use client';

// ===== MetricCard Component =====
// แยกออกมาจาก page.tsx
// ห้ามแก้ไข Logic - Copy มาจากเดิมทั้งหมด

import React from 'react';

interface MetricCardProps {
    title: string;
    value: number;
    icon: React.ReactNode;
    iconBg: string;
}

export function MetricCard({ title, value, icon, iconBg }: MetricCardProps) {
    return (
        <div className="bg-white/90 backdrop-blur-sm border border-gray-200 rounded-lg p-3">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-xs text-gray-600">{title}</p>
                    <p className="text-xl font-bold text-gray-900">{value}</p>
                </div>
                <div className={`${iconBg} rounded-full p-2`}>{icon}</div>
            </div>
        </div>
    );
}

export default MetricCard;
