import { Node } from "@xyflow/react";
import { ImageNodeData } from "./types";
import { getTranslations } from "./translations";

interface Props {
  localNode: Node<ImageNodeData>;
  handleFieldChange: (field: string, value: any) => void;
  language?: string;
}

export function EditorDrawerImageContent({ localNode, handleFieldChange, language = "en" }: Props) {
  const t = getTranslations(language);
  
  // Convert file to base64 and update node data
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        handleFieldChange("data", reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="drawer-content">
      <div className="form-group">
        <label>{t.image} (JPG, PNG, SVG)</label>
        <input
          type="file"
          accept="image/png,image/jpeg,image/svg+xml"
          onChange={handleFileChange}
        />
      </div>
      {localNode.data.data && (
        <div style={{ marginTop: 16 }}>
          <label>Preview:</label>
          <div>
            <img src={localNode.data.data} alt="Preview" style={{ maxWidth: "100%", maxHeight: 200 }} />
          </div>
        </div>
      )}
    </div>
  );
}
