import React, { useState, useEffect } from "react";
import { X, Trash2, Save } from "lucide-react";
import { Node, useReactFlow } from "@xyflow/react";
import { EditorDrawerTaskContent } from "./EditorDrawerTaskContent";
import { EditorDrawerTopicContent } from "./EditorDrawerTopicContent";
import { EditorDrawerImageContent } from "./EditorDrawerImageContent";
import { EditorDrawerTextContent } from "./EditorDrawerTextContent";
import { NodeData } from "./types";

interface EditorDrawerProps {
  node: Node<NodeData> | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (node: Node<NodeData>) => void;
  onDelete: () => void;
}

export const EditorDrawer: React.FC<EditorDrawerProps> = ({
  node,
  isOpen,
  onClose,
  onUpdate,
  onDelete,
}) => {
  const [localNode, setLocalNode] = useState<Node<NodeData> | null>(node);
  const { getNodes } = useReactFlow();
  const allNodes = getNodes();

  useEffect(() => {
    setLocalNode(node);
  }, [node]);

  if (!isOpen || !node || !localNode) return null;

  // Filter out the current node from selectable options
  const nodeOptions = allNodes.filter(n => n.id !== node.id && n.type === "task" || n.type === "topic");

  // Helper for dropdowns
  const renderNodeSelect = (value: string, onChange: (id: string) => void) => (
    <select value={value} onChange={e => onChange(e.target.value)}>
      <option value="">Select node...</option>
      {nodeOptions.map(n => (
        <option key={n.id} value={n.id}>
          {n.data.label || n.id}
        </option>
      ))}
    </select>
  );

  // Completion Needs
  const handleCompletionNeedsChange = (idx: number, id: string) => {
    if (!localNode) return;
    const needs = [...(localNode.data.completion?.needs || [])];
    needs[idx] = { id };
    handleFieldChange("completion", { ...(localNode.data.completion || {}), needs });
  };
  const addCompletionNeed = () => {
    if (!localNode) return;
    const needs = [...(localNode.data.completion?.needs || []), { id: "" }];
    handleFieldChange("completion", { ...(localNode.data.completion || {}), needs });
  };
  const removeCompletionNeed = (idx: number) => {
    if (!localNode) return;
    const needs = (localNode.data.completion?.needs || []).filter((_: any, i: number) => i !== idx);
    handleFieldChange("completion", { ...(localNode.data.completion || {}), needs });
  };

  // Completion Optional
  const handleCompletionOptionalChange = (idx: number, id: string) => {
    if (!localNode) return;
    const optional = [...(localNode.data.completion?.optional || [])];
    optional[idx] = { id };
    handleFieldChange("completion", { ...(localNode.data.completion || {}), optional });
  };
  const addCompletionOptional = () => {
    if (!localNode) return;
    const optional = [...(localNode.data.completion?.optional || []), { id: "" }];
    handleFieldChange("completion", { ...(localNode.data.completion || {}), optional });
  };
  const removeCompletionOptional = (idx: number) => {
    if (!localNode) return;
    const optional = (localNode.data.completion?.optional || []).filter((_: any, i: number) => i !== idx);
    handleFieldChange("completion", { ...(localNode.data.completion || {}), optional });
  };

  // Unlock After
  const handleUnlockAfterChange = (idx: number, id: string) => {
    if (!localNode) return;
    const after = [...(localNode.data.unlock?.after || [])];
    after[idx] = id;
    handleFieldChange("unlock", { ...(localNode.data.unlock || {}), after });
  };
  const addUnlockAfter = () => {
    if (!localNode) return;
    const after = [...(localNode.data.unlock?.after || []), ""];
    handleFieldChange("unlock", { ...(localNode.data.unlock || {}), after });
  };
  const removeUnlockAfter = (idx: number) => {
    if (!localNode) return;
    const after = (localNode.data.unlock?.after || []).filter((_: any, i: number) => i !== idx);
    handleFieldChange("unlock", { ...(localNode.data.unlock || {}), after });
  };

  const handleSave = () => {
    if (!localNode) return;
    onUpdate(localNode);
    onClose();
  };

  const handleFieldChange = (field: string, value: any) => {
    setLocalNode((prev: Node<NodeData> | null) => ({
      ...prev!,
      data: { ...prev!.data, [field]: value },
    }));
  };

  const handleResourceChange = (index: number, field: string, value: string) => {
    if (!localNode) return;
    const resources = [...(localNode.data.resources || [])];
    resources[index] = { ...resources[index], [field]: value };
    handleFieldChange("resources", resources);
  };

  const addResource = () => {
    if (!localNode) return;
    const resources = [...(localNode.data.resources || []), { label: "", url: "" }];
    handleFieldChange("resources", resources);
  };

  const removeResource = (index: number) => {
    if (!localNode) return;
    const resources = (localNode.data.resources || []).filter((_: any, i: number) => i !== index);
    handleFieldChange("resources", resources);
  };

  let content;
  if (localNode.type === "task") {
    content = (
      <>
        <div className="drawer-header">
          <h2 className="drawer-title">Edit Task</h2>
          <button onClick={onClose} className="close-button">
            <X size={20} />
          </button>
        </div>
        <EditorDrawerTaskContent
          localNode={localNode}
          handleFieldChange={handleFieldChange}
          handleResourceChange={handleResourceChange}
          addResource={addResource}
          removeResource={removeResource}
          handleUnlockAfterChange={handleUnlockAfterChange}
          addUnlockAfter={addUnlockAfter}
          removeUnlockAfter={removeUnlockAfter}
          renderNodeSelect={renderNodeSelect}
          handleCompletionNeedsChange={handleCompletionNeedsChange}
          addCompletionNeed={addCompletionNeed}
          removeCompletionNeed={removeCompletionNeed}
          handleCompletionOptionalChange={handleCompletionOptionalChange}
          addCompletionOptional={addCompletionOptional}
          removeCompletionOptional={removeCompletionOptional}
        />
      </>
    );
  } else if (localNode.type === "topic") {
    content = (
      <>
        <div className="drawer-header">
          <h2 className="drawer-title">Edit Topic</h2>
          <button onClick={onClose} className="close-button">
            <X size={20} />
          </button>
        </div>
        <EditorDrawerTopicContent
          localNode={localNode}
          handleFieldChange={handleFieldChange}
          handleResourceChange={handleResourceChange}
          addResource={addResource}
          removeResource={removeResource}
          handleUnlockAfterChange={handleUnlockAfterChange}
          addUnlockAfter={addUnlockAfter}
          removeUnlockAfter={removeUnlockAfter}
          renderNodeSelect={renderNodeSelect}
          handleCompletionNeedsChange={handleCompletionNeedsChange}
          addCompletionNeed={addCompletionNeed}
          removeCompletionNeed={removeCompletionNeed}
          handleCompletionOptionalChange={handleCompletionOptionalChange}
          addCompletionOptional={addCompletionOptional}
          removeCompletionOptional={removeCompletionOptional}
        />
      </>
    );
  } else if (localNode.type === "image") {
    content = (
      <>
        <div className="drawer-header">
          <h2 className="drawer-title">Edit Image</h2>
          <button onClick={onClose} className="close-button">
            <X size={20} />
          </button>
        </div>
        <EditorDrawerImageContent
          localNode={localNode}
          handleFieldChange={handleFieldChange}
        />
      </>
    );
  } else if (localNode.type === "text") {
    content = (
      <>
        <div className="drawer-header">
          <h2 className="drawer-title">Edit Text</h2>
          <button onClick={onClose} className="close-button">
            <X size={20} />
          </button>
        </div>
        <EditorDrawerTextContent
          localNode={localNode}
          handleFieldChange={handleFieldChange}
        />
      </>
    );
  }

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer">
        {content}
        <div className="drawer-footer">
          <button onClick={onDelete} className="danger-button">
            <Trash2 size={16} /> Delete Node
          </button>
          <button onClick={handleSave} className="primary-button">
            <Save size={16} /> Save Changes
          </button>
        </div>
      </div>
    </>
  );
};
