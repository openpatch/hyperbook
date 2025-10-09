import { ColorSelector } from "./ColorSelector";
import { Edge } from "@xyflow/react";
import { getTranslations } from "./translations";

interface Props {
  localEdge: Edge;
  handleFieldChange: (field: string, value: any) => void;
  language?: string;
}

export function EditorDrawerEdgeContent({
  localEdge,
  handleFieldChange,
  language = "en",
}: Props) {
  const t = getTranslations(language);
  
  return (
    <div className="drawer-content">
      <div className="form-group">
        <ColorSelector
          label={t.edgeColor}
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
          {t.animated}
        </label>
      </div>
      <div className="form-group">
        <label>{t.edgeType}</label>
        <select
          value={localEdge.type || "default"}
          onChange={e => handleFieldChange("type", e.target.value)}
        >
          <option value="default">{t.default}</option>
          <option value="straight">{t.straight}</option>
          <option value="step">{t.step}</option>
          <option value="smoothstep">{t.smoothstep}</option>
          <option value="simplebezier">Simple Bezier</option>
        </select>
      </div>
    </div>
  );
}
