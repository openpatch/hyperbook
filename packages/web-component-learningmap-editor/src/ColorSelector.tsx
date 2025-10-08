import React from "react";

interface ColorSelectorProps {
  value: string;
  onChange: (color: string) => void;
  label?: string;
}

export const ColorSelector: React.FC<ColorSelectorProps> = ({ value, onChange, label }) => {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {label && <label style={{ marginRight: 8 }}>{label}</label>}
      <input
        type="color"
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ width: 32, height: 32, border: "none", background: "none", padding: 0 }}
      />
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="#e5e7eb"
        style={{ width: 100 }}
      />
    </div>
  );
};
