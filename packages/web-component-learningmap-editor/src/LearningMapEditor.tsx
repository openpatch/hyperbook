import { useState, useCallback, useEffect } from "react";
import {
  ReactFlow,
  Controls,
  useNodesState,
  useEdgesState,
  ColorMode,
  useReactFlow,
  Node,
  addEdge,
  Connection,
  Edge,
  Background,
} from "@xyflow/react";
import { EditorDrawer } from "./EditorDrawer";
import { EdgeDrawer } from "./EdgeDrawer";
import { TaskNode } from "./nodes/TaskNode";
import { TopicNode } from "./nodes/TopicNode";
import { ImageNode } from "./nodes/ImageNode";
import { TextNode } from "./nodes/TextNode";
import { RoadmapData, NodeData, ImageNodeData, TextNodeData, BackgroundConfig, EdgeConfig } from "./types";
import { BackgroundDrawer } from "./BackgroundDrawer";
import FloatingEdge from "./FloatingEdge";
import { EditorToolbar } from "./EditorToolbar";
import { parseRoadmapData } from "./helper";
import { LearningMap } from "./LearningMap";

const nodeTypes = {
  topic: TopicNode,
  task: TaskNode,
  image: ImageNode,
  text: TextNode,
};

const edgeTypes = {
  floating: FloatingEdge
};


export function LearningMapEditor({
  roadmapData,
  language = "en"
}: {
  roadmapData: string | RoadmapData;
  language?: string;
}) {
  const { screenToFlowPosition } = useReactFlow();

  const [previewMode, setPreviewMode] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [nodes, setNodes, onNodesChange] = useNodesState<NodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [colorMode] = useState<ColorMode>("light");
  const [selectedNode, setSelectedNode] = useState<Node<NodeData> | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [backgroundDrawerOpen, setBackgroundDrawerOpen] = useState(false);
  const [background, setBackground] = useState<BackgroundConfig>({ color: "#ffffff" });
  const [edgeConfig, setEdgeConfig] = useState<EdgeConfig>({});
  const [nextNodeId, setNextNodeId] = useState(1);

  // Debug settings state
  const [showCompletionNeeds, setShowCompletionNeeds] = useState(true);
  const [showCompletionOptional, setShowCompletionOptional] = useState(true);
  const [showUnlockAfter, setShowUnlockAfter] = useState(true);

  // Edge drawer state
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [edgeDrawerOpen, setEdgeDrawerOpen] = useState(false);

  // Track Shift key state
  const [shiftPressed, setShiftPressed] = useState(false);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Shift") setShiftPressed(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Shift") setShiftPressed(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

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

      setEdges(edgesArr);
      setNodes(rawNodes);

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

  useEffect(() => {
    const newEdges: Edge[] = edges.filter((e) => !e.id.startsWith("debug-"));
    if (debugMode) {
      nodes.forEach((node) => {
        if (showCompletionNeeds && node.type === "topic" && node.data?.completion?.needs) {
          node.data.completion.needs.forEach((needId: string) => {
            const edgeId = `debug-edge-${needId}-to-${node.id}`;
            newEdges.push({
              id: edgeId,
              target: needId,
              source: node.id,
              animated: true,
              style: { stroke: "#f97316", strokeWidth: 2, strokeDasharray: "5,5" },
              type: "floating",
            });
          });
        }
        if (showCompletionOptional && node.data?.completion?.optional) {
          node.data.completion.optional.forEach((optionalId: string) => {
            const edgeId = `debug-edge-optional-${optionalId}-to-${node.id}`;
            newEdges.push({
              id: edgeId,
              target: optionalId,
              source: node.id,
              animated: true,
              style: { stroke: "#eab308", strokeWidth: 2, strokeDasharray: "5,5" },
              type: "floating",
            });
          });
        }
      });
      nodes.forEach((node) => {
        if (showUnlockAfter && node.data.unlock?.after) {
          node.data.unlock.after.forEach((unlockId: string) => {
            const edgeId = `debug-edge-${unlockId}-to-${node.id}`;
            newEdges.push({
              id: edgeId,
              target: unlockId,
              source: node.id,
              animated: true,
              style: { stroke: "#10b981", strokeWidth: 2, strokeDasharray: "5,5" },
              type: "floating",
            });
          });
        }
      });
    }
    setEdges(newEdges);
  }, [nodes, setEdges, debugMode, showCompletionNeeds, showCompletionOptional, showUnlockAfter]);

  // Event handlers
  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNode(node);
    setDrawerOpen(true);
  }, []);

  const onEdgeClick = useCallback((_: any, edge: Edge) => {
    setSelectedEdge(edge);
    setEdgeDrawerOpen(true);
  }, []);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge(connection, eds));
    },
    [setEdges]
  );

  const toggleDebugMode = useCallback(() => {
    setDebugMode((mode) => !mode);
  }, [setDebugMode]);

  const togglePreviewMode = useCallback(() => {
    setPreviewMode((mode) => !mode);
  }, [setPreviewMode]);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setSelectedNode(null);
    setEdgeDrawerOpen(false);
    setSelectedEdge(null);
    setBackgroundDrawerOpen(false)
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

  const updateEdge = useCallback(
    (updatedEdge: Edge) => {
      setEdges((eds) =>
        eds.map((e) => (e.id === updatedEdge.id ? { ...e, ...updatedEdge } : e))
      );
      setSelectedEdge(updatedEdge);
    },
    [setEdges]
  );

  // Delete selected edge
  const deleteEdge = useCallback(() => {
    if (!selectedEdge) return;
    setEdges((eds) => eds.filter((e) => e.id !== selectedEdge.id));
    closeDrawer();
  }, [selectedEdge, setEdges, closeDrawer]);

  const deleteNode = useCallback(() => {
    if (!selectedNode) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
    setEdges((eds) =>
      eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id)
    );
    closeDrawer();
  }, [selectedNode, setNodes, setEdges, closeDrawer]);

  const addNewNode = useCallback(
    (type: "task" | "topic" | "image" | "text") => {
      if (type === "task") {
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
      } else if (type === "topic") {
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
      }
      else if (type === "image") {
        const newNode: Node<ImageNodeData> = {
          id: `background-node${nextNodeId}`,
          type,
          zIndex: -2,
          position: screenToFlowPosition({ x: 100, y: 100 }),
          data: {
            src: "",
          },
        };
        setNodes((nds) => [...nds, newNode]);
        setNextNodeId((id) => id + 1);
      } else if (type === "text") {
        const newNode: Node<TextNodeData> = {
          id: `background-node${nextNodeId}`,
          type,
          position: screenToFlowPosition({ x: 100, y: 100 }),
          zIndex: -1,
          data: {
            text: "Background Text",
            fontSize: 32,
            color: "#e5e7eb",
          },
        };
        setNodes((nds) => [...nds, newNode]);
        setNextNodeId((id) => id + 1);
      }
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
      edges: edges.filter((e) => !e.id.startsWith("debug-"))
        .map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle,
          targetHandle: e.targetHandle,
          animated: e.animated,
          type: e.type,
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

  const defaultEdgeOptions = {
    animated: edgeConfig.animated ?? false,
    style: {
      stroke: edgeConfig.color ?? "#94a3b8",
      strokeWidth: edgeConfig.width ?? 2,
    },
    type: edgeConfig.type ?? "default",
  };

  // Toolbar handler wrappers for EditorToolbar props
  const handleOpenBackgroundDrawer = useCallback(() => setBackgroundDrawerOpen(true), []);
  const handleSetShowCompletionNeeds = useCallback((checked: boolean) => setShowCompletionNeeds(checked), []);
  const handleSetShowCompletionOptional = useCallback((checked: boolean) => setShowCompletionOptional(checked), []);
  const handleSetShowUnlockAfter = useCallback((checked: boolean) => setShowUnlockAfter(checked), []);

  return (
    <div className="hyperbook-learningmap-editor-container">
      <EditorToolbar
        debugMode={debugMode}
        previewMode={previewMode}
        showCompletionNeeds={showCompletionNeeds}
        showCompletionOptional={showCompletionOptional}
        showUnlockAfter={showUnlockAfter}
        onToggleDebugMode={toggleDebugMode}
        onTogglePreviewMode={togglePreviewMode}
        onSetShowCompletionNeeds={handleSetShowCompletionNeeds}
        onSetShowCompletionOptional={handleSetShowCompletionOptional}
        onSetShowUnlockAfter={handleSetShowUnlockAfter}
        onAddNewNode={addNewNode}
        onOpenBackgroundDrawer={handleOpenBackgroundDrawer}
        onSave={handleSave}
      />
      {previewMode && <LearningMap roadmapData={{ nodes, edges, background, edgeConfig }} language={language} />}
      {!previewMode && <>
        <div
          className="editor-canvas"
          style={{
            backgroundColor: background?.color || "#ffffff",
          }}
        >
          <ReactFlow
            nodes={nodes.map(n => {
              const className = [];
              if (n.data?.color) {
                className.push(n.data.color);
              }
              return {
                ...n,
                className: className.join(" ")
              };
            })}
            edges={edges}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            onNodesChange={onNodesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            snapToGrid={!shiftPressed}
            nodeOrigin={[0.5, 0.5]}
            proOptions={{ hideAttribution: true }}
            defaultEdgeOptions={defaultEdgeOptions}
            nodesDraggable={true}
            nodesConnectable={true}
            colorMode={colorMode}
          >
            <Background />
            <Controls />
          </ReactFlow>
        </div>
        <EditorDrawer
          node={selectedNode}
          isOpen={drawerOpen}
          onClose={closeDrawer}
          onUpdate={updateNode}
          onDelete={deleteNode}
        />
        <EdgeDrawer
          edge={selectedEdge}
          isOpen={edgeDrawerOpen}
          onClose={closeDrawer}
          onUpdate={updateEdge}
          onDelete={deleteEdge}
        />
        <BackgroundDrawer
          isOpen={backgroundDrawerOpen}
          onClose={closeDrawer}
          background={background}
          onUpdate={setBackground}
        />
      </>
      }
    </div>
  );
}
