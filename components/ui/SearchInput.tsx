'use client';

import { Search } from 'lucide-react';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Input ค้นหาแบบ compact พร้อม icon
 * 
 * @example
 * <SearchInput 
 *   value={searchTerm} 
 *   onChange={setSearchTerm} 
 *   placeholder="ค้นหา..." 
 * />
 */
export default function SearchInput({ 
  value, 
  onChange, 
  placeholder = 'ค้นหา...',
  className = ''
}: SearchInputProps) {
  return (
    <div className={`flex-1 relative ${className}`}>
      <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-thai-gray-400" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-7 pr-2 py-1 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500/50"
      />
    </div>
  );
}
