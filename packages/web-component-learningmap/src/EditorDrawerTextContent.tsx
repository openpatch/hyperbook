import { Node } from "@xyflow/react";
import { TextNodeData } from "./types";
import { ColorSelector } from "./ColorSelector";
import { RotationInput } from "./RotationInput";
import { getTranslations } from "./translations";

interface Props {
  localNode: Node<TextNodeData>;
  handleFieldChange: (field: string, value: any) => void;
  language?: string;
}

export function EditorDrawerTextContent({ localNode, handleFieldChange, language = "en" }: Props) {
  const t = getTranslations(language);
  
  return (
    <div className="drawer-content">
      <div className="form-group">
        <label>{t.text}</label>
        <input
          type="text"
          value={localNode.data.text || ""}
          onChange={e => handleFieldChange("text", e.target.value)}
          placeholder={t.placeholderBackgroundText}
        />
      </div>
      <div className="form-group">
        <label>{t.fontSize}</label>
        <input
          type="number"
          value={localNode.data.fontSize || 32}
          onChange={e => handleFieldChange("fontSize", Number(e.target.value))}
        />
      </div>
      <div className="form-group">
        <ColorSelector
          label={t.color}
          value={localNode.data.color || "#e5e7eb"}
          onChange={color => handleFieldChange("color", color)}
        />
      </div>
      <RotationInput
        value={localNode.data.rotation || 0}
        onChange={v => handleFieldChange("rotation", v)}
      />
    </div>
  );
}
