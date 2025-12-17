'use client';

interface FilterSelectOption {
  value: string;
  label: string;
}

interface FilterSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: FilterSelectOption[];
  placeholder?: string;
  className?: string;
}

/**
 * Dropdown select สำหรับ filter แบบ compact
 * 
 * @example
 * <FilterSelect 
 *   value={selectedWarehouse} 
 *   onChange={setSelectedWarehouse}
 *   options={[
 *     { value: 'all', label: 'ทุกคลัง' },
 *     { value: 'WH001', label: 'คลัง 1' }
 *   ]}
 * />
 */
export default function FilterSelect({ 
  value, 
  onChange, 
  options,
  placeholder,
  className = ''
}: FilterSelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`px-2 py-1 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500/50 ${className}`}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
