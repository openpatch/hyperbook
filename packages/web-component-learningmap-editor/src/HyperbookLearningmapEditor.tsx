import { useState, useCallback, useEffect } from "react";
import { getAutoLayoutedNodesElk } from "./autoLayoutElk";
import * as yaml from "js-yaml";
import {
  ReactFlow,
  Controls,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  Handle,
  Position,
  ColorMode,
  useReactFlow,
  Node,
  addEdge,
  Connection,
  Edge,
} from "@xyflow/react";
import {
  Save,
  Plus,
  Settings,
  Trash2,
  X,
} from "lucide-react";

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface UnlockCondition {
  after?: string[];
  date?: string;
  password?: string;
}

interface CompletionNeed {
  id: string;
  source?: string;
  target?: string;
}

interface Completion {
  needs?: CompletionNeed[];
  optional?: CompletionNeed[];
}

interface NodeData {
  label: string;
  description?: string;
  duration?: string;
  unlock?: UnlockCondition;
  completion?: Completion;
  video?: string;
  resources?: { label: string; url: string }[];
  summary?: string;
  [key: string]: any;
}

interface BackgroundConfig {
  color?: string;
  image?: {
    src: string;
    x?: number;
    y?: number;
  };
}

interface EdgeConfig {
  animated?: boolean;
  color?: string;
  width?: number;
  type?: string;
}

interface RoadmapData {
  nodes?: Node<NodeData>[];
  edges?: Edge[];
  background?: BackgroundConfig;
  edgeConfig?: EdgeConfig;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const parseRoadmapData = (roadmapData: string | RoadmapData): RoadmapData => {
  if (typeof roadmapData !== "string") {
    return roadmapData || {};
  }

  try {
    return JSON.parse(roadmapData);
  } catch {
    try {
      return yaml.load(roadmapData) as RoadmapData;
    } catch (err) {
      console.error("Failed to parse roadmap data:", err);
      return {};
    }
  }
};

const generateEdgesFromCompletionNeeds = (nodes: Node<NodeData>[], edgeConfig: EdgeConfig) => {
  const edges: Edge[] = [];
  nodes.forEach((node) => {
    const needs = node.data?.completion?.needs || [];
    needs.forEach((need: CompletionNeed) => {
      if (need.id) {
        edges.push({
          id: `${need.id}->${node.id}`,
          source: need.id,
          target: node.id,
          sourceHandle: need.source || "bottom",
          targetHandle: need.target || "top",
        });
      }
    });
    const optional = node.data?.completion?.optional || [];
    optional.forEach((opt: CompletionNeed) => {
      if (opt.id) {
        edges.push({
          id: `${opt.id}->${node.id}-optional`,
          source: opt.id,
          target: node.id,
          sourceHandle: opt.source || "bottom",
          targetHandle: opt.target || "top",
          style: { 
            strokeDasharray: "5,5", 
            strokeWidth: edgeConfig.width ?? 2, 
            stroke: edgeConfig.color ?? "#94a3b8" 
          },
        });
      }
    });
  });
  return edges;
};

// ============================================================================
// NODE COMPONENTS
// ============================================================================

const EditorNode = ({ data, type }: { data: NodeData; type: string }) => {
  return (
    <div
      className={`editor-node editor-node-${type}`}
      style={{
        padding: "16px 24px",
        borderRadius: type === "task" ? "16px" : "8px",
        border: "2px solid",
        borderColor: type === "task" ? "#3b82f6" : "#f59e42",
        background: type === "task" ? "#f0f7ff" : "#fffbe6",
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
        cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <div style={{ fontWeight: 600, fontSize: "14px" }}>
          {data.label || "Untitled"}
        </div>
      </div>
      {data.summary && (
        <div style={{ fontSize: "12px", color: "#4b5563", marginTop: "4px" }}>
          {data.summary}
        </div>
      )}

      {["Bottom", "Top", "Left", "Right"].map((pos) => (
        <Handle
          key={`${pos}-source`}
          type="source"
          position={Position[pos]}
          id={pos.toLowerCase()}
          isConnectable={true}
        />
      ))}

      {["Bottom", "Top", "Left", "Right"].map((pos) => (
        <Handle
          key={`${pos}-target`}
          type="target"
          position={Position[pos]}
          id={pos.toLowerCase()}
          isConnectable={true}
        />
      ))}
    </div>
  );
};

const BackgroundNode = ({ data }: { data: { image?: { src: string } } }) => {
  if (!data.image?.src) return null;
  return <img src={data.image.src} alt="Background" />;
};

// ============================================================================
// EDITOR DRAWER
// ============================================================================

const EditorDrawer = ({ 
  node, 
  isOpen, 
  onClose, 
  onUpdate, 
  onDelete 
}: { 
  node: Node<NodeData> | null; 
  isOpen: boolean; 
  onClose: () => void; 
  onUpdate: (node: Node<NodeData>) => void; 
  onDelete: () => void;
}) => {
  const [localNode, setLocalNode] = useState<Node<NodeData> | null>(node);

  useEffect(() => {
    setLocalNode(node);
  }, [node]);

  if (!isOpen || !node) return null;

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

  const handleUnlockAfterChange = (value: string) => {
    if (!localNode) return;
    const after = value.split(",").map((s) => s.trim()).filter(Boolean);
    handleFieldChange("unlock", { ...(localNode.data.unlock || {}), after });
  };

  const handleCompletionNeedsChange = (value: string) => {
    if (!localNode) return;
    const needs = value.split(",").map((s) => s.trim()).filter(Boolean).map((id) => ({ id }));
    handleFieldChange("completion", { ...(localNode.data.completion || {}), needs });
  };

  const handleCompletionOptionalChange = (value: string) => {
    if (!localNode) return;
    const optional = value.split(",").map((s) => s.trim()).filter(Boolean).map((id) => ({ id }));
    handleFieldChange("completion", { ...(localNode.data.completion || {}), optional });
  };

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer">
        <div className="drawer-header">
          <h2 className="drawer-title">Edit Node</h2>
          <button onClick={onClose} className="close-button">
            <X size={20} />
          </button>
        </div>

        <div className="drawer-content">
          <div className="form-group">
            <label>Node Type</label>
            <select
              value={node.type || "task"}
              onChange={(e) => setLocalNode({ ...localNode, type: e.target.value })}
            >
              <option value="task">Task</option>
              <option value="topic">Topic</option>
            </select>
          </div>

          <div className="form-group">
            <label>Label *</label>
            <input
              type="text"
              value={localNode.data.label || ""}
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
            <label>Unlock After (comma-separated node IDs)</label>
            <input
              type="text"
              value={(localNode.data.unlock?.after || []).join(", ")}
              onChange={(e) => handleUnlockAfterChange(e.target.value)}
              placeholder="e.g., node1, node2"
            />
          </div>

          <div className="form-group">
            <label>Completion Needs (comma-separated node IDs)</label>
            <input
              type="text"
              value={(localNode.data.completion?.needs || []).map((n: CompletionNeed) => n.id).join(", ")}
              onChange={(e) => handleCompletionNeedsChange(e.target.value)}
              placeholder="e.g., node1, node2"
            />
          </div>

          <div className="form-group">
            <label>Completion Optional (comma-separated node IDs)</label>
            <input
              type="text"
              value={(localNode.data.completion?.optional || []).map((n: CompletionNeed) => n.id).join(", ")}
              onChange={(e) => handleCompletionOptionalChange(e.target.value)}
              placeholder="e.g., node3, node4"
            />
          </div>
        </div>

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

// ============================================================================
// BACKGROUND SETTINGS DRAWER
// ============================================================================

const BackgroundDrawer = ({ 
  isOpen, 
  onClose, 
  background, 
  onUpdate 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  background: BackgroundConfig; 
  onUpdate: (bg: BackgroundConfig) => void;
}) => {
  const [localBg, setLocalBg] = useState<BackgroundConfig>(background);

  useEffect(() => {
    setLocalBg(background);
  }, [background]);

  if (!isOpen) return null;

  const handleSave = () => {
    onUpdate(localBg);
    onClose();
  };

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer">
        <div className="drawer-header">
          <h2 className="drawer-title">Background Settings</h2>
          <button onClick={onClose} className="close-button">
            <X size={20} />
          </button>
        </div>

        <div className="drawer-content">
          <div className="form-group">
            <label>Background Color</label>
            <input
              type="color"
              value={localBg?.color || "#ffffff"}
              onChange={(e) => setLocalBg({ ...localBg, color: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>Background Image URL</label>
            <input
              type="text"
              value={localBg?.image?.src || ""}
              onChange={(e) =>
                setLocalBg({
                  ...localBg,
                  image: { ...(localBg?.image || {}), src: e.target.value },
                })
              }
              placeholder="Image URL"
            />
          </div>

          <div className="form-group">
            <label>Image X Position</label>
            <input
              type="number"
              value={localBg?.image?.x || 0}
              onChange={(e) =>
                setLocalBg({
                  ...localBg,
                  image: { src: localBg?.image?.src || "", ...(localBg?.image || {}), x: Number(e.target.value) },
                })
              }
            />
          </div>

          <div className="form-group">
            <label>Image Y Position</label>
            <input
              type="number"
              value={localBg?.image?.y || 0}
              onChange={(e) =>
                setLocalBg({
                  ...localBg,
                  image: { src: localBg?.image?.src || "", ...(localBg?.image || {}), y: Number(e.target.value) },
                })
              }
            />
          </div>
        </div>

        <div className="drawer-footer">
          <button onClick={handleSave} className="primary-button">
            <Save size={16} /> Save Changes
          </button>
        </div>
      </div>
    </>
  );
};

// ============================================================================
// MAIN EDITOR COMPONENT
// ============================================================================

function HyperbookLearningmapEditorInner({ 
  roadmapData, 
  language = "en" 
}: { 
  roadmapData: string | RoadmapData; 
  language?: string;
}) {
  const { screenToFlowPosition } = useReactFlow();

  const [nodes, setNodes] = useNodesState<NodeData>([]);
  const [edges, setEdges] = useEdgesState<Edge>([]);
  const [colorMode] = useState<ColorMode>("light");
  const [selectedNode, setSelectedNode] = useState<Node<NodeData> | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [backgroundDrawerOpen, setBackgroundDrawerOpen] = useState(false);
  const [background, setBackground] = useState<BackgroundConfig>({ color: "#ffffff" });
  const [edgeConfig, setEdgeConfig] = useState<EdgeConfig>({});
  const [nextNodeId, setNextNodeId] = useState(1);

  const parsedRoadmap = parseRoadmapData(roadmapData);

  // Initialize from roadmap data
  useEffect(() => {
    async function loadRoadmap() {
      const nodesArr = Array.isArray(parsedRoadmap?.nodes) ? parsedRoadmap.nodes : [];
      const edgesArr = Array.isArray(parsedRoadmap?.edges) ? parsedRoadmap.edges : [];
      
      setBackground(parsedRoadmap?.background || { color: "#ffffff" });
      setEdgeConfig(parsedRoadmap?.edgeConfig || {});

      const rawNodes = nodesArr.map((n) => ({
        ...n,
        draggable: true,
        data: { ...n.data },
      }));

      const rawEdges: Edge[] = edgesArr.length > 0
        ? edgesArr as Edge[]
        : generateEdgesFromCompletionNeeds(rawNodes, edgeConfig);

      setEdges(rawEdges);

      const needsLayout = rawNodes.some((n: Node) => !n.position);
      if (needsLayout) {
        const autoNodes = await getAutoLayoutedNodesElk(rawNodes, rawEdges);
        setNodes(autoNodes);
      } else {
        setNodes(rawNodes);
      }

      // Calculate next node ID
      if (nodesArr.length > 0) {
        const maxId = Math.max(
          ...nodesArr
            .map((n) => parseInt(n.id.replace(/\D/g, ""), 10))
            .filter((id) => !isNaN(id))
        );
        setNextNodeId(maxId + 1);
      }
    }
    loadRoadmap();
  }, [roadmapData]);

  // Event handlers
  const onNodeClick = useCallback((_: any, node: Node) => {
    if (node.type === "background") return;
    setSelectedNode(node);
    setDrawerOpen(true);
  }, []);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge(connection, eds));
    },
    [setEdges]
  );

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setSelectedNode(null);
  }, []);

  const updateNode = useCallback(
    (updatedNode: Node) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === updatedNode.id ? updatedNode : n))
      );
      setSelectedNode(updatedNode);
    },
    [setNodes]
  );

  const deleteNode = useCallback(() => {
    if (!selectedNode) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
    setEdges((eds) =>
      eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id)
    );
    closeDrawer();
  }, [selectedNode, setNodes, setEdges, closeDrawer]);

  const addNewNode = useCallback(
    (type: "task" | "topic") => {
      const newNode: Node<NodeData> = {
        id: `node${nextNodeId}`,
        type,
        position: screenToFlowPosition({ x: 100, y: 100 }),
        data: {
          label: `New ${type}`,
          summary: "",
          description: "",
        },
      };
      setNodes((nds) => [...nds, newNode]);
      setNextNodeId((id) => id + 1);
    },
    [nextNodeId, screenToFlowPosition, setNodes]
  );

  const handleSave = useCallback(() => {
    const roadmapData: RoadmapData = {
      nodes: nodes.map((n) => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: n.data,
      })),
      edges: edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
        style: e.style,
      })),
      background,
      edgeConfig,
    };

    const root = document.querySelector("hyperbook-learningmap-editor");
    if (root) {
      root.dispatchEvent(new CustomEvent("change", { detail: roadmapData }));
    }
  }, [nodes, edges, background, edgeConfig]);

  // Create background node if configured
  const backgroundNode = background?.image?.src
    ? {
        id: "background-image",
        type: "background",
        position: { x: background.image.x ?? 0, y: background.image.y ?? 0 },
        data: { image: { src: background.image.src } },
        draggable: false,
        selectable: false,
        focusable: false,
        zIndex: -1,
      }
    : null;

  const displayNodes = [...(backgroundNode ? [backgroundNode] : []), ...nodes];

  const nodeTypes = {
    topic: (props: any) => <EditorNode {...props} type="topic" />,
    task: (props: any) => <EditorNode {...props} type="task" />,
    background: BackgroundNode,
  };

  const defaultEdgeOptions = {
    animated: edgeConfig.animated ?? false,
    style: {
      stroke: edgeConfig.color ?? "#94a3b8",
      strokeWidth: edgeConfig.width ?? 2,
    },
    type: edgeConfig.type ?? "default",
  };

  return (
    <div className="hyperbook-learningmap-editor-container">
      {/* Toolbar */}
      <div className="editor-toolbar">
        <div className="toolbar-group">
          <button onClick={() => addNewNode("task")} className="toolbar-button">
            <Plus size={16} /> Add Task
          </button>
          <button onClick={() => addNewNode("topic")} className="toolbar-button">
            <Plus size={16} /> Add Topic
          </button>
          <button onClick={() => setBackgroundDrawerOpen(true)} className="toolbar-button">
            <Settings size={16} /> Background
          </button>
        </div>
        <button onClick={handleSave} className="toolbar-button primary">
          <Save size={16} /> Save
        </button>
      </div>

      {/* Editor Canvas */}
      <div
        className="editor-canvas"
        style={{
          backgroundColor: background?.color || "#ffffff",
        }}
      >
        <ReactFlow
          nodes={displayNodes}
          edges={edges}
          onNodeClick={onNodeClick}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          proOptions={{ hideAttribution: true }}
          defaultEdgeOptions={defaultEdgeOptions}
          nodesDraggable={true}
          nodesConnectable={true}
          colorMode={colorMode}
        >
          <Controls />
        </ReactFlow>
      </div>

      {/* Drawers */}
      <EditorDrawer
        node={selectedNode}
        isOpen={drawerOpen}
        onClose={closeDrawer}
        onUpdate={updateNode}
        onDelete={deleteNode}
      />
      <BackgroundDrawer
        isOpen={backgroundDrawerOpen}
        onClose={() => setBackgroundDrawerOpen(false)}
        background={background}
        onUpdate={setBackground}
      />
    </div>
  );
}

export function HyperbookLearningmapEditor({ 
  roadmapData, 
  language 
}: { 
  roadmapData: string | RoadmapData; 
  language?: string;
}) {
  return (
    <ReactFlowProvider>
      <HyperbookLearningmapEditorInner
        language={language}
        roadmapData={roadmapData}
      />
    </ReactFlowProvider>
  );
}
