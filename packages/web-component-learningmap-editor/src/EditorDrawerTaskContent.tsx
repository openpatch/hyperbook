import { Node } from "@xyflow/react";
import { Plus, Trash2 } from "lucide-react";
import { NodeData } from "./types";

interface Props {
  localNode: Node<NodeData>;
  handleFieldChange: (field: string, value: any) => void;
  handleResourceChange: (index: number, field: string, value: string) => void;
  addResource: () => void;
  removeResource: (index: number) => void;
  handleUnlockAfterChange: (idx: number, id: string) => void;
  addUnlockAfter: () => void;
  removeUnlockAfter: (idx: number) => void;
  renderNodeSelect: (value: string, onChange: (id: string) => void) => React.ReactNode;
  handleCompletionNeedsChange: (idx: number, id: string) => void;
  addCompletionNeed: () => void;
  removeCompletionNeed: (idx: number) => void;
  handleCompletionOptionalChange: (idx: number, id: string) => void;
  addCompletionOptional: () => void;
  removeCompletionOptional: (idx: number) => void;
}

export function EditorDrawerTaskContent({
  localNode,
  handleFieldChange,
  handleResourceChange,
  addResource,
  removeResource,
  handleUnlockAfterChange,
  addUnlockAfter,
  removeUnlockAfter,
  renderNodeSelect,
  handleCompletionNeedsChange,
  addCompletionNeed,
  removeCompletionNeed,
  handleCompletionOptionalChange,
  addCompletionOptional,
  removeCompletionOptional,
}: Props) {
  // Color options for the dropdown
  const colorOptions = [
    { value: "blue", label: "Blue", className: "react-flow__node-topic blue" },
    { value: "yellow", label: "Yellow", className: "react-flow__node-topic yellow" },
    { value: "lila", label: "Lila", className: "react-flow__node-topic lila" },
    { value: "pink", label: "Pink", className: "react-flow__node-topic pink" },
    { value: "teal", label: "Teal", className: "react-flow__node-topic teal" },
    { value: "red", label: "Red", className: "react-flow__node-topic red" },
    { value: "black", label: "Black", className: "react-flow__node-topic black" },
    { value: "white", label: "White", className: "react-flow__node-topic white" },
  ];

  // Determine default color based on node type
  let defaultColor = "blue";
  if (localNode.type === "topic") defaultColor = "yellow";
  const selectedColor = localNode.data?.color || defaultColor;
  return (
    <div className="drawer-content">
      <div className="form-group">
        <label>Node Color</label>
        <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
          {colorOptions.map(opt => (
            <button
              key={opt.value}
              type="button"
              aria-label={opt.label}
              onClick={() => handleFieldChange("color", opt.value)}
              className={opt.className}
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                cursor: "pointer",
                fontWeight: "bold",
                boxSizing: "border-box",
                display: "inline-block",
                padding: 0,
              }}
            >{selectedColor === opt.value ? "X" : ""}</button>
          ))}
        </div>
      </div>
      <div className="form-group">
        <label>Label *</label>
        <input
          type="text"
          value={localNode.data?.label || ""}
          onChange={(e) => handleFieldChange("label", e.target.value)}
          placeholder="Node label"
        />
      </div>
      <div className="form-group">
        <label>Summary</label>
        <input
          type="text"
          value={localNode.data.summary || ""}
          onChange={(e) => handleFieldChange("summary", e.target.value)}
          placeholder="Short summary"
        />
      </div>
      <div className="form-group">
        <label>Description</label>
        <textarea
          value={localNode.data.description || ""}
          onChange={(e) => handleFieldChange("description", e.target.value)}
          placeholder="Detailed description"
          rows={4}
        />
      </div>
      <div className="form-group">
        <label>Duration</label>
        <input
          type="text"
          value={localNode.data.duration || ""}
          onChange={(e) => handleFieldChange("duration", e.target.value)}
          placeholder="e.g., 30 min"
        />
      </div>
      <div className="form-group">
        <label>Video URL</label>
        <input
          type="text"
          value={localNode.data.video || ""}
          onChange={(e) => handleFieldChange("video", e.target.value)}
          placeholder="YouTube or video URL"
        />
      </div>
      <div className="form-group">
        <label>Resources</label>
        {(localNode.data.resources || []).map((resource: { label: string; url: string }, idx: number) => (
          <div key={idx} style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
            <input
              type="text"
              value={resource.label || ""}
              onChange={(e) => handleResourceChange(idx, "label", e.target.value)}
              placeholder="Label"
              style={{ flex: 1 }}
            />
            <input
              type="text"
              value={resource.url || ""}
              onChange={(e) => handleResourceChange(idx, "url", e.target.value)}
              placeholder="URL"
              style={{ flex: 2 }}
            />
            <button onClick={() => removeResource(idx)} className="icon-button">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <button onClick={addResource} className="secondary-button">
          <Plus size={16} /> Add Resource
        </button>
      </div>
      <div className="form-group">
        <label>Unlock Password</label>
        <input
          type="text"
          value={localNode.data.unlock?.password || ""}
          onChange={(e) => handleFieldChange("unlock", { ...(localNode.data.unlock || {}), password: e.target.value })}
          placeholder="Optional password"
        />
      </div>
      <div className="form-group">
        <label>Unlock Date</label>
        <input
          type="date"
          value={localNode.data.unlock?.date || ""}
          onChange={(e) => handleFieldChange("unlock", { ...(localNode.data.unlock || {}), date: e.target.value })}
        />
      </div>
      <div className="form-group">
        <label>Unlock After</label>
        {(localNode.data.unlock?.after || []).map((id: string, idx: number) => (
          <div key={idx} style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
            {renderNodeSelect(id, newId => handleUnlockAfterChange(idx, newId))}
            <button onClick={() => removeUnlockAfter(idx)} className="icon-button">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <button onClick={addUnlockAfter} className="secondary-button">
          <Plus size={16} /> Add Unlock After
        </button>
      </div>
      {localNode.type === "topic" && <div className="form-group">
        <label>Completion Needs</label>
        {(localNode.data.completion?.needs || []).map((need: string, idx: number) => (
          <div key={idx} style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
            {renderNodeSelect(need, newId => handleCompletionNeedsChange(idx, newId))}
            <button onClick={() => removeCompletionNeed(idx)} className="icon-button">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <button onClick={addCompletionNeed} className="secondary-button">
          <Plus size={16} /> Add Need
        </button>
      </div>}
      {localNode.type === "topic" && <div className="form-group">
        <label>Completion Optional</label>
        {(localNode.data.completion?.optional || []).map((opt: string, idx: number) => (
          <div key={idx} style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
            {renderNodeSelect(opt, newId => handleCompletionOptionalChange(idx, newId))}
            <button onClick={() => removeCompletionOptional(idx)} className="icon-button">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <button onClick={addCompletionOptional} className="secondary-button">
          <Plus size={16} /> Add Optional
        </button>
      </div>}
    </div>
  );
}
