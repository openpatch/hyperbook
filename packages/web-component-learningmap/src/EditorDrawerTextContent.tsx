import { Node } from "@xyflow/react";
import { TextNodeData } from "./types";
import { ColorSelector } from "./ColorSelector";
import { RotationInput } from "./RotationInput";

interface Props {
  localNode: Node<TextNodeData>;
  handleFieldChange: (field: string, value: any) => void;
}

export function EditorDrawerTextContent({ localNode, handleFieldChange }: Props) {
  return (
    <div className="drawer-content">
      <div className="form-group">
        <label>Text</label>
        <input
          type="text"
          value={localNode.data.text || ""}
          onChange={e => handleFieldChange("text", e.target.value)}
          placeholder="Background Text"
        />
      </div>
      <div className="form-group">
        <label>Font Size</label>
        <input
          type="number"
          value={localNode.data.fontSize || 32}
          onChange={e => handleFieldChange("fontSize", Number(e.target.value))}
        />
      </div>
      <div className="form-group">
        <ColorSelector
          label="Color"
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
