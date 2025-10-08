import React from "react";
import { X, Trash2, Save } from "lucide-react";
import { Edge } from "@xyflow/react";
import { EditorDrawerEdgeContent } from "./EditorDrawerEdgeContent";

interface EdgeDrawerProps {
  edge: Edge | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (edge: Edge) => void;
  onDelete: () => void;
}

export const EdgeDrawer: React.FC<EdgeDrawerProps> = ({
  edge: selectedEdge,
  isOpen: edgeDrawerOpen,
  onClose: closeDrawer,
  onUpdate: updateEdge,
  onDelete: deleteEdge,
}) => {
  if (!selectedEdge || !edgeDrawerOpen) return null;
  return (
    <div>
      <div className="drawer-overlay" onClick={closeDrawer} />
      <div className="drawer">
        <div className="drawer-header">
          <h2 className="drawer-title">Edit Edge</h2>
          <button onClick={closeDrawer} className="close-button">
            <X size={20} />
          </button>
        </div>
        <EditorDrawerEdgeContent
          localEdge={selectedEdge}
          handleFieldChange={(field: string, value: any) => {
            let updated = { ...selectedEdge };
            if (field === "color") {
              updated = {
                ...updated,
                style: { ...updated.style, stroke: value },
              };
            } else if (field === "animated") {
              updated = { ...updated, animated: value };
            } else if (field === "type") {
              updated = { ...updated, type: value };
            }
            updateEdge(updated);
          }}
        />
        <div className="drawer-footer">
          <button onClick={deleteEdge} className="danger-button">
            <Trash2 size={16} /> Delete Edge
          </button>
          <button onClick={closeDrawer} className="primary-button">
            <Save size={16} /> Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};
