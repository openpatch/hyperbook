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
  ControlButton,
  OnNodesChange,
  OnEdgesChange,
  getNodesBounds,
  getViewportForBounds,
  Panel,
  OnSelectionChangeFunc,
  useEdges,
} from "@xyflow/react";
import { toSvg } from "html-to-image";
import { EditorDrawer } from "./EditorDrawer";
import { EdgeDrawer } from "./EdgeDrawer";
import { TaskNode } from "./nodes/TaskNode";
import { TopicNode } from "./nodes/TopicNode";
import { ImageNode } from "./nodes/ImageNode";
import { TextNode } from "./nodes/TextNode";
import { RoadmapData, NodeData, ImageNodeData, TextNodeData, Settings } from "./types";
import { SettingsDrawer } from "./SettingsDrawer";
import FloatingEdge from "./FloatingEdge";
import { EditorToolbar } from "./EditorToolbar";
import { parseRoadmapData } from "./helper";
import { LearningMap } from "./LearningMap";
import { Info, Redo, Undo, RotateCw, ShieldAlert } from "lucide-react";
import useUndoable from "./useUndoable";
import { MultiNodePanel } from "./MultiNodePanel";
import { getTranslations } from "./translations";

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
  language = "en",
  onChange,
}: {
  roadmapData: string | RoadmapData;
  language?: string;
  onChange?: (data: RoadmapData) => void;
}) {
  const t = getTranslations(language);
  
  const keyboardShortcuts = [
    { action: t.shortcuts.save, shortcut: "Ctrl+S" },
    { action: t.shortcuts.undo, shortcut: "Ctrl+Z" },
    { action: t.shortcuts.redo, shortcut: "Ctrl+Y or Ctrl+Shift+Z" },
    { action: t.shortcuts.addTaskNode, shortcut: "Ctrl+A" },
    { action: t.shortcuts.addTopicNode, shortcut: "Ctrl+O" },
    { action: t.shortcuts.addImageNode, shortcut: "Ctrl+I" },
    { action: t.shortcuts.addTextNode, shortcut: "Ctrl+X" },
    { action: t.shortcuts.deleteNodeEdge, shortcut: "Delete" },
    { action: t.shortcuts.togglePreviewMode, shortcut: "Ctrl+P" },
    { action: t.shortcuts.toggleDebugMode, shortcut: "Ctrl+D" },
    { action: t.shortcuts.selectMultipleNodes, shortcut: "Ctrl+Click or Shift+Drag" },
    { action: t.shortcuts.showHelp, shortcut: "Ctrl+? or Help Button" },
  ];

  const { screenToFlowPosition, getViewport, setViewport } = useReactFlow();
  const [roadmapState, setRoadmapState, { undo, redo, canUndo, canRedo, reset, resetInitialState }] = useUndoable<RoadmapData>({
    settings: {},
    version: 1,
  });

  const [saved, setSaved] = useState(true);
  const [didUndoRedo, setDidUndoRedo] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [nodes, setNodes, onNodesChange] = useNodesState<NodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [settings, setSettings] = useState<Settings>({ background: { color: "#ffffff" } });

  const [helpOpen, setHelpOpen] = useState(false);
  const [colorMode] = useState<ColorMode>("light");
  const [selectedNodeId, setSelectedNodeId] = useState<Node<NodeData> | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [settingsDrawerOpen, setSettingsDrawerOpen] = useState(false);
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
    const parsedRoadmap = parseRoadmapData(roadmapData);
    loadRoadmapStateIntoReactFlowState(parsedRoadmap);
    resetInitialState(parsedRoadmap);
  }, [roadmapData])

  const loadRoadmapStateIntoReactFlowState = useCallback((roadmapState: RoadmapData) => {
    const nodesArr = Array.isArray(roadmapState?.nodes) ? roadmapState.nodes : [];
    const edgesArr = Array.isArray(roadmapState?.edges) ? roadmapState.edges : [];

    setSettings(roadmapState?.settings || { background: { color: "#ffffff" } });

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
  }, [setNodes, setEdges, setSettings]);

  useEffect(() => {
    if (didUndoRedo) {
      setDidUndoRedo(false);
      loadRoadmapStateIntoReactFlowState(roadmapState);
    }
  }, [roadmapState, didUndoRedo, loadRoadmapStateIntoReactFlowState]);

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
    setSelectedNodeId(node.id);
    setDrawerOpen(true);
  }, []);

  const onEdgeClick = useCallback((_: any, edge: Edge) => {
    setSelectedEdge(edge);
    setEdgeDrawerOpen(true);
  }, []);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge(connection, eds));
      setSaved(false);
    },
    [setEdges, setSaved]
  );

  const toggleDebugMode = useCallback(() => {
    setDebugMode((mode) => !mode);
  }, [setDebugMode]);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setSelectedNodeId(null);
    setEdgeDrawerOpen(false);
    setSelectedEdge(null);
    setSettingsDrawerOpen(false)
  }, []);

  const updateNode = useCallback(
    (updatedNode: Node) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === updatedNode.id ? updatedNode : n))
      );
      setSaved(false);
    },
    [setNodes, setSaved]
  );

  const updateNodes = useCallback(
    (updatedNodes: Node[]) => {
      setNodes((nds) => nds.map(n => {
        const updated = updatedNodes.find(un => un.id === n.id);
        return updated ? updated : n;
      }));
      setSaved(false);
    },
    [setNodes, setSaved]
  );

  const updateEdge = useCallback(
    (updatedEdge: Edge) => {
      setEdges((eds) =>
        eds.map((e) => (e.id === updatedEdge.id ? { ...e, ...updatedEdge } : e))
      );
      setSelectedEdge(updatedEdge);
      setSaved(false);
    },
    [setEdges, setSelectedEdge, setSaved]
  );

  // Delete selected edge
  const deleteEdge = useCallback(() => {
    if (!selectedEdge) return;
    setEdges((eds) => eds.filter((e) => e.id !== selectedEdge.id));
    setSaved(false);
    closeDrawer();
  }, [selectedEdge, setEdges, closeDrawer]);

  const deleteNode = useCallback(() => {
    if (!selectedNodeId) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedNodeId));
    setEdges((eds) =>
      eds.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId)
    );
    setSaved(false);
    closeDrawer();
  }, [selectedNodeId, setNodes, setEdges, closeDrawer, setSaved]);

  const addNewNode = useCallback(
    (type: "task" | "topic" | "image" | "text") => {
      const centerPos = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
      if (type === "task") {
        const newNode: Node<NodeData> = {
          id: `node${nextNodeId}`,
          type,
          position: centerPos,
          data: {
            label: t.newTask,
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
          position: centerPos,
          data: {
            label: t.newTopic,
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
          position: centerPos,
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
          position: centerPos,
          zIndex: -1,
          data: {
            text: t.backgroundTextDefault,
            fontSize: 32,
            color: "#e5e7eb",
          },
        };
        setNodes((nds) => [...nds, newNode]);
        setNextNodeId((id) => id + 1);
      }
      setSaved(false);
    },
    [nextNodeId, screenToFlowPosition, setNodes, setSaved, t]
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
      settings,
      version: 1
    };

    setRoadmapState(roadmapData);
    setSaved(true);

    if (onChange) {
      onChange(roadmapData);
      return;
    } else {
      const root = document.querySelector("hyperbook-learningmap-editor");
      if (root) {
        root.dispatchEvent(new CustomEvent("change", { detail: roadmapData }));
      }
    }
  }, [nodes, edges, settings]);

  const togglePreviewMode = useCallback(() => {
    handleSave();
    setPreviewMode((mode) => {
      const newMode = !mode;
      if (newMode) {
        setDebugMode(false);
        closeDrawer();
      }
      return newMode;
    });
  }, [setPreviewMode, handleSave]);

  const handleDownload = useCallback(() => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(roadmapState, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `${roadmapState.settings.title ?? new Date().toString()}.learningmap.json`);
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  }, [roadmapState]);

  const defaultEdgeOptions = {
    animated: false,
    style: {
      stroke: "#94a3b8",
      strokeWidth: 2,
    },
    type: "default",
  };

  const handleExportSVG = useCallback(async () => {
    const nodesBounds = getNodesBounds(nodes);
    const imageWidth = nodesBounds.width;
    const imageHeight = nodesBounds.height;
    let viewport = getViewportForBounds(nodesBounds, imageWidth, imageHeight, 0.1, 5);

    const dom = document.querySelector(".react-flow__viewport") as HTMLElement;
    if (!dom) return;

    toSvg(dom, {
      backgroundColor: settings?.background?.color || "#ffffff",
      width: imageWidth,
      height: imageHeight,
      style: {
        transform: `translate(${viewport.x / 2.0}px, ${viewport.y / 2.0}px) scale(${viewport.zoom})`,
        width: `${imageWidth}px`,
        height: `${imageHeight}px`,
      }
    }).then((dataUrl) => {
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataUrl);
      downloadAnchorNode.setAttribute("download", "roadmap.svg");
      document.body.appendChild(downloadAnchorNode); // required for firefox
      downloadAnchorNode.click();
      downloadAnchorNode.remove();

      // Restore old viewport
    }).catch((err) => {
      alert(t.failedToExportSVG + err.message);
    });
  }, [nodes, roadmapState, t]);

  const handleOpen = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (!file) return;

      if (!window.confirm(t.openFileWarning)) {
        return;
      }

      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const content = evt.target?.result;
          if (typeof content === 'string') {
            const json = JSON.parse(content);
            setRoadmapState(json);
            loadRoadmapStateIntoReactFlowState(json);
          }
        } catch (err) {
          alert(t.failedToLoadFile);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, [setRoadmapState, setDidUndoRedo, t]);

  // Toolbar handler wrappers for EditorToolbar props
  const handleOpenSettingsDrawer = useCallback(() => setSettingsDrawerOpen(true), []);
  const handleSetShowCompletionNeeds = useCallback((checked: boolean) => setShowCompletionNeeds(checked), []);
  const handleSetShowCompletionOptional = useCallback((checked: boolean) => setShowCompletionOptional(checked), []);
  const handleSetShowUnlockAfter = useCallback((checked: boolean) => setShowUnlockAfter(checked), []);

  const handleNodesChange: OnNodesChange = useCallback(
    (changes) => {
      setSaved(false);
      onNodesChange(changes);
    },
    [onNodesChange, setSaved]
  );

  const handleEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      setSaved(false);
      onEdgesChange(changes);
    },
    [onEdgesChange, setSaved]
  );

  const handleUndo = useCallback(() => {
    if (canUndo) {
      undo();
      setDidUndoRedo(true);
    }
  }, [canUndo, undo]);

  const handleRedo = useCallback(() => {
    if (canRedo) {
      redo();
      setDidUndoRedo(true);
    }
  }, [canRedo, redo]);

  const handleReset = useCallback(() => {
    reset();
    setDidUndoRedo(true);
  }, [reset]);

  const handleSelectionChange: OnSelectionChangeFunc = useCallback(
    ({ nodes: selectedNodes }) => {
      if (selectedNodes.length > 1) {
        setSelectedNodeIds(selectedNodes.map(n => n.id));
      } else {
        setSelectedNodeIds([]);
      }
    },
    [setSelectedNodeIds]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Shift") setShiftPressed(true);
      //save shortcut
      if ((e.ctrlKey || e.metaKey) && e.key === 's' && !e.shiftKey) {
        e.preventDefault();
        handleSave();
      }
      // undo shortcut
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      // redo shortcut
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
        e.preventDefault();
        handleRedo();
      }
      // add task node shortcut
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a' && !e.shiftKey) {
        e.preventDefault();
        addNewNode("task");
      }
      // add topic node shortcut
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o' && !e.shiftKey) {
        e.preventDefault();
        addNewNode("topic");
      }
      // add image node shortcut
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i' && !e.shiftKey) {
        e.preventDefault();
        addNewNode("image");
      }
      // add text node shortcut
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x' && !e.shiftKey) {
        e.preventDefault();
        addNewNode("text");
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === '?' || (e.shiftKey && e.key === '/'))) {
        e.preventDefault();
        setHelpOpen(h => !h);
      }
      //preview toggle shortcut
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p' && !e.shiftKey) {
        e.preventDefault();
        togglePreviewMode();
      }
      //debug toggle shortcut
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd' && !e.shiftKey) {
        e.preventDefault();
        toggleDebugMode();
      }
      // Dismiss with Escape
      if (helpOpen && e.key === 'Escape') {
        setHelpOpen(false);
      }
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
  }, [handleSave, handleUndo, handleRedo, addNewNode, helpOpen, setHelpOpen, togglePreviewMode, toggleDebugMode]);

  return (
    <>
      <EditorToolbar
        saved={saved}
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
        onOpenSettingsDrawer={handleOpenSettingsDrawer}
        onSave={handleSave}
        onDownlad={handleDownload}
        onOpen={handleOpen}
        onExportSVG={handleExportSVG}
        language={language}
      />
      {previewMode && <LearningMap roadmapData={roadmapState} language={language} />}
      {!previewMode && <>
        <div
          className="editor-canvas"
          style={{
            backgroundColor: settings?.background?.color || "#ffffff",
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
            onEdgesChange={handleEdgesChange}
            onNodeDoubleClick={onNodeClick}
            onEdgeDoubleClick={onEdgeClick}
            onNodesChange={handleNodesChange}
            onConnect={onConnect}
            onSelectionChange={handleSelectionChange}
            nodeTypes={nodeTypes}
            selectionOnDrag={false}
            edgeTypes={edgeTypes}
            fitView
            snapToGrid={!shiftPressed}
            proOptions={{ hideAttribution: true }}
            defaultEdgeOptions={defaultEdgeOptions}
            nodesDraggable={true}
            elevateNodesOnSelect={false}
            nodesConnectable={true}
            colorMode={colorMode}
          >
            <Background />
            <Controls>
              <ControlButton title={t.undo} disabled={!canUndo} onClick={handleUndo}>
                <Undo />
              </ControlButton>
              <ControlButton title={t.redo} disabled={!canRedo} onClick={handleRedo}>
                <Redo />
              </ControlButton>
              <ControlButton title={t.reset} onClick={handleReset}>
                <RotateCw />
              </ControlButton>
              <ControlButton title={t.help} onClick={() => setHelpOpen(true)}>
                <Info />
              </ControlButton>
            </Controls>
            {!saved && <Panel position="top-right" title={t.unsavedChanges} onClick={() => { handleSave(); }}>
              <ShieldAlert size={32} color="red" />
            </Panel>}
            {selectedNodeIds.length > 1 && <MultiNodePanel nodes={nodes.filter(n => selectedNodeIds.includes(n.id))} onUpdate={updateNodes} />}
          </ReactFlow>
        </div>
        <EditorDrawer
          node={nodes.find(n => n.id === selectedNodeId)}
          isOpen={drawerOpen}
          onClose={closeDrawer}
          onUpdate={updateNode}
          onDelete={deleteNode}
          language={language}
        />
        <EdgeDrawer
          edge={selectedEdge}
          isOpen={edgeDrawerOpen}
          onClose={closeDrawer}
          onUpdate={updateEdge}
          onDelete={deleteEdge}
          language={language}
        />
        <SettingsDrawer
          isOpen={settingsDrawerOpen}
          onClose={closeDrawer}
          settings={settings}
          onUpdate={setSettings}
          language={language}
        />
        <dialog
          className="help"
          open={helpOpen}
          onClose={() => setHelpOpen(false)}
        >
          <h2>{t.keyboardShortcuts}</h2>
          <table>
            <thead>
              <tr>
                <th>{t.action}</th>
                <th>{t.shortcut}</th>
              </tr>
            </thead>
            <tbody>
              {keyboardShortcuts.map((item) => (
                <tr key={item.action}>
                  <td>{item.action}</td>
                  <td>{item.shortcut}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="primary-button" onClick={() => setHelpOpen(false)}>{t.close}</button>
        </dialog>
      </>
      }
    </>
  );
}
