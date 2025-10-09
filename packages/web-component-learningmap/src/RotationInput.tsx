import React from "react";

interface RotationInputProps {
  value: number;
  onChange: (value: number) => void;
}

export function RotationInput({ value, onChange }: RotationInputProps) {
  return (
    <div className="form-group">
      <label>Rotation (degrees): {value}°</label>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          type="range"
          min={0}
          max={360}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={{ flex: 1 }}
        />
        <input
          type="number"
          min={0}
          max={360}
          value={value}
          onChange={e => {
            let v = Number(e.target.value);
            if (isNaN(v)) v = 0;
            if (v < 0) v = 0;
            if (v > 360) v = 360;
            onChange(v);
          }}
          style={{ width: 100 }}
        />
      </div>
    </div>
  );
}
