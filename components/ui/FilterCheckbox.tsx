'use client';

interface FilterCheckboxProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}

/**
 * Checkbox สำหรับ filter แบบ compact
 * 
 * @example
 * <FilterCheckbox 
 *   label="สต็อกต่ำ" 
 *   checked={showLowStock} 
 *   onChange={setShowLowStock} 
 * />
 */
export default function FilterCheckbox({ 
  label, 
  checked, 
  onChange,
  className = ''
}: FilterCheckboxProps) {
  return (
    <label className={`flex items-center cursor-pointer text-xs font-thai px-2 py-1 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded hover:bg-white/80 ${className}`}>
      <input
        type="checkbox"
        className="mr-1 w-3 h-3"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}
