import { ColorSelector } from "./ColorSelector";

import { Edge } from "@xyflow/react";

interface Props {
  localEdge: Edge;
  handleFieldChange: (field: string, value: any) => void;
}

export function EditorDrawerEdgeContent({
  localEdge,
  handleFieldChange
}: Props) {
  return (
    <div className="drawer-content">
      <div className="form-group">
        <ColorSelector
          label="Color"
          value={localEdge.style?.stroke || "#222222"}
          onChange={color => handleFieldChange("color", color)}
        />
      </div>
      <div className="form-group">
        <label>
          <input
            type="checkbox"
            checked={!!localEdge.animated}
            onChange={e => handleFieldChange("animated", e.target.checked)}
          />
          Animated
        </label>
      </div>
      <div className="form-group">
        <label>Type</label>
        <select
          value={localEdge.type || "default"}
          onChange={e => handleFieldChange("type", e.target.value)}
        >
          <option value="default">Default</option>
          <option value="straight">Straight</option>
          <option value="step">Step</option>
          <option value="smoothstep">Smoothstep</option>
          <option value="simplebezier">Simple Bezier</option>
        </select>
      </div>
    </div>
  );
}
