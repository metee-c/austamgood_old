import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';

interface ComboBoxProps {
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  options: string[] | Array<{ value: string; label: string }>;
  placeholder?: string;
  className?: string;
  required?: boolean;
}

const ComboBox: React.FC<ComboBoxProps> = ({
  name,
  value,
  onChange,
  options,
  placeholder,
  className,
  required
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filteredOptions, setFilteredOptions] = useState<typeof options>(options);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Memoize options to prevent unnecessary re-renders
  const memoizedOptions = useMemo(() => options, [JSON.stringify(options)]);

  useEffect(() => {
    setFilteredOptions(memoizedOptions);
  }, [memoizedOptions]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    onChange(e);

    // Filter options based on input
    const filtered = memoizedOptions.filter(option =>
      typeof option === 'string'
        ? option.toLowerCase().includes(inputValue.toLowerCase())
        : option.label.toLowerCase().includes(inputValue.toLowerCase())
    );
    setFilteredOptions(filtered as typeof options);
    
    if (!isOpen && inputValue) {
      setIsOpen(true);
    }
  }, [memoizedOptions, onChange, isOpen]);

  const handleOptionClick = (option: string | { value: string; label: string }) => {
    const optionValue = typeof option === 'string' ? option : option.value;
    const syntheticEvent = {
      target: {
        name,
        value: optionValue,
        type: 'text'
      }
    } as React.ChangeEvent<HTMLInputElement>;
    
    onChange(syntheticEvent);
    setIsOpen(false);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleInputFocus = useCallback(() => {
    setFilteredOptions(memoizedOptions);
    setIsOpen(true);
  }, [memoizedOptions]);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          name={name}
          value={value}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          className={className}
          placeholder={placeholder}
          required={required}
          autoComplete="off"
        />
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="absolute right-2 top-1/2 transform -translate-y-1/2 text-thai-gray-400 hover:text-thai-gray-600"
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {isOpen && filteredOptions.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-thai-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {filteredOptions.map((option, index) => (
            <button
              key={index}
              type="button"
              onClick={() => handleOptionClick(option)}
              className="w-full px-3 py-2 text-left text-sm font-thai hover:bg-thai-gray-50 focus:bg-thai-gray-50 focus:outline-none"
            >
              {typeof option === 'string' ? option : option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ComboBox;