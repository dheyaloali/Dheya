import * as React from "react";

interface Option {
  label: string;
  value: number;
}

interface MultiSelectProps {
  options: Option[];
  value: number[];
  onChange: (value: number[]) => void;
  placeholder?: string;
  className?: string;
}

export const MultiSelect: React.FC<MultiSelectProps> = ({ options, value, onChange, placeholder, className }) => {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = Array.from(e.target.selectedOptions, (option) => Number(option.value));
    onChange(selected);
  };

  return (
    <select
      multiple
      className={`border rounded px-2 py-1 ${className || ''}`}
      value={value.map(String)}
      onChange={handleChange}
      size={Math.min(options.length, 8)}
    >
      {placeholder && value.length === 0 && (
        <option value="" disabled>{placeholder}</option>
      )}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}; 