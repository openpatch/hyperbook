import { Node } from "@xyflow/react";
import { Plus, Trash2 } from "lucide-react";
import { NodeData } from "./types";
import { getTranslations } from "./translations";

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
  language?: string;
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
  language = "en",
}: Props) {
  const t = getTranslations(language);
  
  // Color options for the dropdown
  const colorOptions = [
    { value: "blue", label: t.blue, className: "react-flow__node-topic blue" },
    { value: "yellow", label: t.yellow, className: "react-flow__node-topic yellow" },
    { value: "lila", label: t.lila, className: "react-flow__node-topic lila" },
    { value: "pink", label: t.pink, className: "react-flow__node-topic pink" },
    { value: "teal", label: t.teal, className: "react-flow__node-topic teal" },
    { value: "red", label: t.red, className: "react-flow__node-topic red" },
    { value: "black", label: t.black, className: "react-flow__node-topic black" },
    { value: "white", label: t.white, className: "react-flow__node-topic white" },
  ];

  // Determine default color based on node type
  let defaultColor = "blue";
  if (localNode.type === "topic") defaultColor = "yellow";
  const selectedColor = localNode.data?.color || defaultColor;
  return (
    <div className="drawer-content">
      <div className="form-group">
        <label>{t.nodeColor}</label>
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
        <label>{t.labelRequired}</label>
        <input
          type="text"
          value={localNode.data?.label || ""}
          onChange={(e) => handleFieldChange("label", e.target.value)}
          placeholder={t.placeholderNodeLabel}
        />
      </div>
      <div className="form-group">
        <label>{t.summary}</label>
        <input
          type="text"
          value={localNode.data.summary || ""}
          onChange={(e) => handleFieldChange("summary", e.target.value)}
          placeholder={t.placeholderShortSummary}
        />
      </div>
      <div className="form-group">
        <label>{t.description}</label>
        <textarea
          value={localNode.data.description || ""}
          onChange={(e) => handleFieldChange("description", e.target.value)}
          placeholder={t.placeholderDetailedDescription}
          rows={4}
        />
      </div>
      <div className="form-group">
        <label>{t.duration}</label>
        <input
          type="text"
          value={localNode.data.duration || ""}
          onChange={(e) => handleFieldChange("duration", e.target.value)}
          placeholder="e.g., 30 min"
        />
      </div>
      <div className="form-group">
        <label>{t.videoURL}</label>
        <input
          type="text"
          value={localNode.data.video || ""}
          onChange={(e) => handleFieldChange("video", e.target.value)}
          placeholder={t.placeholderVideoURL}
        />
      </div>
      <div className="form-group">
        <label>{t.resources}</label>
        {(localNode.data.resources || []).map((resource: { label: string; url: string }, idx: number) => (
          <div key={idx} style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
            <input
              type="text"
              value={resource.label || ""}
              onChange={(e) => handleResourceChange(idx, "label", e.target.value)}
              placeholder={t.placeholderLabel}
              style={{ flex: 1 }}
            />
            <input
              type="text"
              value={resource.url || ""}
              onChange={(e) => handleResourceChange(idx, "url", e.target.value)}
              placeholder={t.placeholderURL}
              style={{ flex: 2 }}
            />
            <button onClick={() => removeResource(idx)} className="icon-button">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <button onClick={addResource} className="secondary-button">
          <Plus size={16} /> {t.addResource}
        </button>
      </div>
      <div className="form-group">
        <label>{t.unlockPassword}</label>
        <input
          type="text"
          value={localNode.data.unlock?.password || ""}
          onChange={(e) => handleFieldChange("unlock", { ...(localNode.data.unlock || {}), password: e.target.value })}
          placeholder={t.placeholderOptionalPassword}
        />
      </div>
      <div className="form-group">
        <label>{t.unlockDate}</label>
        <input
          type="date"
          value={localNode.data.unlock?.date || ""}
          onChange={(e) => handleFieldChange("unlock", { ...(localNode.data.unlock || {}), date: e.target.value })}
        />
      </div>
      <div className="form-group">
        <label>{t.unlockAfter}</label>
        {(localNode.data.unlock?.after || []).map((id: string, idx: number) => (
          <div key={idx} style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
            {renderNodeSelect(id, newId => handleUnlockAfterChange(idx, newId))}
            <button onClick={() => removeUnlockAfter(idx)} className="icon-button">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <button onClick={addUnlockAfter} className="secondary-button">
          <Plus size={16} /> {t.unlockAfter}
        </button>
      </div>
      {localNode.type === "topic" && <div className="form-group">
        <label>{t.completionNeeds}</label>
        {(localNode.data.completion?.needs || []).map((need: string, idx: number) => (
          <div key={idx} style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
            {renderNodeSelect(need, newId => handleCompletionNeedsChange(idx, newId))}
            <button onClick={() => removeCompletionNeed(idx)} className="icon-button">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <button onClick={addCompletionNeed} className="secondary-button">
          <Plus size={16} /> {t.completionNeeds}
        </button>
      </div>}
      {localNode.type === "topic" && <div className="form-group">
        <label>{t.completionOptional}</label>
        {(localNode.data.completion?.optional || []).map((opt: string, idx: number) => (
          <div key={idx} style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
            {renderNodeSelect(opt, newId => handleCompletionOptionalChange(idx, newId))}
            <button onClick={() => removeCompletionOptional(idx)} className="icon-button">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <button onClick={addCompletionOptional} className="secondary-button">
          <Plus size={16} /> {t.completionOptional}
        </button>
      </div>}
    </div>
  );
}
