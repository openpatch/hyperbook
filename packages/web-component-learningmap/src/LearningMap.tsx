import { Controls, Edge, Node, Panel, ReactFlow, useEdgesState, useNodesState, useReactFlow } from "@xyflow/react";
import { ImageNode } from "./nodes/ImageNode";
import { TaskNode } from "./nodes/TaskNode";
import { TextNode } from "./nodes/TextNode";
import { TopicNode } from "./nodes/TopicNode";
import { NodeData, RoadmapData, RoadmapState, Settings } from "./types";
import { useCallback, useEffect, useState } from "react";
import { parseRoadmapData } from "./helper";
import { Drawer } from "./Drawer";
import { ProgressTracker } from "./ProgressTracker";
import { getTranslations } from "./translations";

const nodeTypes = {
  topic: TopicNode,
  task: TaskNode,
  image: ImageNode,
  text: TextNode,
};

const getStateMap = (nodes: Node<NodeData>[]) => {
  const stateMap: Record<string, string> = {};
  nodes.forEach(n => {
    if (n.data?.state) {
      stateMap[n.id] = n.data.state;
    }
  });
  return stateMap;
}

const isCompleteState = (state: string) => state === 'completed' || state === 'mastered';

const updateNodesStates = (nodes: Node<NodeData>[]) => {
  for (let i = 0; i < 2; i++) {
    const stateMap = getStateMap(nodes);
    for (const node of nodes) {
      node.data.state = node.data?.state || 'locked';
      // check unlock conditions
      if (node.data?.unlock?.after) {
        const unlocked = node.data.unlock.after.every((depId: string) => isCompleteState(stateMap[depId]));
        if (unlocked) {
          if (node.data.state === "locked") {
            node.data.state = 'unlocked';
          }
        } else {
          node.data.state = 'locked';
        }
      }
      if (node.data?.unlock?.date) {
        const unlockDate = new Date(node.data.unlock.date);
        const now = new Date();
        if (now >= unlockDate) {
          if (node.data.state === "locked") {
            node.data.state = 'unlocked';
          }
        } else {
          node.data.state = 'locked';
        }
      }
      if (!node.data?.unlock?.after && !node.data?.unlock?.date) {
        if (node.data.state === "locked") {
          node.data.state = 'unlocked';
        }
      }
      if (node.type != "topic") continue;
      if (node.data?.completion?.needs) {
        const noNeeds = node.data.completion.needs.every((need: string) => isCompleteState(stateMap[need]));
        if (node.data.state === "unlocked" && noNeeds) {
          node.data.state = 'completed';
        }
      } else if (!node.data?.completion?.needs && node.data.state === "unlocked") {
        node.data.state = 'completed';
      }
      if (node.data?.completion?.optional) {
        const noOptional = node.data.completion.optional.every((opt: string) => isCompleteState(stateMap[opt]));
        if (node.data.state === "completed" && noOptional) {
          node.data.state = 'mastered';
        }
      } else if (!node.data?.completion?.optional && node.data.state === "completed") {
        node.data.state = 'mastered';
      }
    }
  }

  return nodes;
};

const isInteractableNode = (node: Node) => {
  return node.type === "task" || node.type === "topic";
}

const countCompletedNodes = (nodes: Node<NodeData>[]) => {
  let completed = 0;
  let mastered = 0;
  let total = 0;
  nodes.forEach(n => {
    if (n.type === "task" || n.type === "topic") {
      total++;
      if (n.data?.state === 'completed') {
        completed++;
      }
      else if (n.data?.state === 'mastered') {
        completed++;
        mastered++;
      }
    }
  });
  return { completed, mastered, total };
}

export function LearningMap({
  roadmapData,
  onChange,
  language = "en",
  initialState
}: {
  roadmapData: string | RoadmapData;
  language?: string;
  onChange?: (state: RoadmapState) => void;
  initialState?: RoadmapState;
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState<NodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNode, setSelectedNode] = useState<Node<NodeData> | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>();
  const { fitView, getViewport, setViewport } = useReactFlow();

  // Use language from settings if available, otherwise use prop
  const effectiveLanguage = settings?.language || language;
  const t = getTranslations(effectiveLanguage);

  const { completed, mastered, total } = countCompletedNodes(nodes);

  const parsedRoadmap = parseRoadmapData(roadmapData);

  useEffect(() => {
    async function loadRoadmap() {
      const nodesArr = Array.isArray(parsedRoadmap?.nodes) ? parsedRoadmap.nodes : [];
      const edgesArr = Array.isArray(parsedRoadmap?.edges) ? parsedRoadmap.edges : [];

      setSettings(parsedRoadmap?.settings || {});

      let rawNodes = nodesArr.map((n) => {
        return {
          ...n,
          draggable: false,
          connectable: false,
          selectable: isInteractableNode(n),
          focusable: isInteractableNode(n),
          data: {
            ...n.data,
            state: initialState?.nodes?.[n.id]?.state,
          }
        }
      });

      rawNodes = updateNodesStates(rawNodes);

      setViewport({
        x: initialState?.x || 0,
        y: initialState?.y || 0,
        zoom: initialState?.zoom || 1,
      });
      setEdges(edgesArr);
      setNodes(rawNodes);
    }
    loadRoadmap();
  }, [roadmapData, initialState]);

  const onNodeClick = useCallback((_: any, node: Node, focus: boolean = false) => {
    if (!isInteractableNode(node)) return;
    setSelectedNode(node);
    setDrawerOpen(true);

    if (focus) {
      fitView({ nodes: [node], duration: 150 });
    }
  }, [fitView]);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setSelectedNode(null);
  }, []);

  const updateNode = useCallback(
    (updatedNode: Node) => {
      setNodes((nds) => {
        let newNodes = nds.map((n) => (n.id === updatedNode.id ? updatedNode : n))
        newNodes = updateNodesStates(newNodes);
        return newNodes;
      }
      );
      setSelectedNode(updatedNode);
    },
    [setNodes]
  );

  useEffect(() => {
    const viewport = getViewport();
    const minimalState: RoadmapState = { nodes: {}, x: viewport.x, y: viewport.y, zoom: viewport.zoom };
    nodes.forEach((n) => {
      if (n.data.state && n.type === "task") {
        minimalState.nodes[n.id] = { state: n.data.state };
      }
    });
    if (onChange) {
      onChange(minimalState);
    } else {
      const root = document.querySelector("hyperbook-learningmap");
      if (root) {
        root.dispatchEvent(new CustomEvent("change", { detail: minimalState }));
      }
    }
  }, [nodes]);

  const defaultEdgeOptions = {
    animated: false,
    style: {
      stroke: "#94a3b8",
      strokeWidth: 2,
    },
    type: "default",
  };

  return (
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
          className.push(n.data?.state);
          return {
            ...n,
            selected: selectedNode?.id === n.id,
            className: className.join(" "),
          };
        })}
        edges={edges}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onNodesChange={onNodesChange}
        nodeTypes={nodeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={defaultEdgeOptions}
        nodesDraggable={false}
        nodesConnectable={false}
      >
        {settings?.title && (
          <Panel position="bottom-right">
            <div className="map-title">
              {settings.title}
            </div>
          </Panel>
        )}
        <Panel position="top-center" className="progress-panel">
          <ProgressTracker completed={completed} total={total} mastered={mastered} language={effectiveLanguage} />
        </Panel>
        <Controls showInteractive={false} />
      </ReactFlow>
      <Drawer node={selectedNode} open={drawerOpen} onClose={closeDrawer} onUpdate={updateNode} nodes={nodes} onNodeClick={onNodeClick} language={effectiveLanguage} />
    </div>
  )
}
