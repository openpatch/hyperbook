import { Controls, Edge, Node, ReactFlow, useEdgesState, useNodesState } from "@xyflow/react";
import { ImageNode } from "./nodes/ImageNode";
import { TaskNode } from "./nodes/TaskNode";
import { TextNode } from "./nodes/TextNode";
import { TopicNode } from "./nodes/TopicNode";
import { BackgroundConfig, EdgeConfig, NodeData, RoadmapData } from "./types";
import { useCallback, useEffect, useState } from "react";
import { parseRoadmapData } from "./helper";
import { Drawer } from "./Drawer";

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


export function LearningMap({
  roadmapData,
  onChange,
  language = "en"
}: {
  roadmapData: string | RoadmapData;
  language?: string;
  onChange?: (state: Record<string, { state: string }>) => void;
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState<NodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNode, setSelectedNode] = useState<Node<NodeData> | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [background, setBackground] = useState<BackgroundConfig>({ color: "#ffffff" });
  const [edgeConfig, setEdgeConfig] = useState<EdgeConfig>({});

  const parsedRoadmap = parseRoadmapData(roadmapData);

  useEffect(() => {
    async function loadRoadmap() {
      const nodesArr = Array.isArray(parsedRoadmap?.nodes) ? parsedRoadmap.nodes : [];
      const edgesArr = Array.isArray(parsedRoadmap?.edges) ? parsedRoadmap.edges : [];

      setBackground(parsedRoadmap?.background || { color: "#ffffff" });
      setEdgeConfig(parsedRoadmap?.edgeConfig || {});

      let rawNodes = nodesArr.map((n) => ({
        ...n,
        draggable: false,
        connectable: false,
        selectable: isInteractableNode(n),
        focusable: isInteractableNode(n),
      }));

      rawNodes = updateNodesStates(rawNodes);

      setEdges(edgesArr);
      setNodes(rawNodes);
    }
    loadRoadmap();
  }, [roadmapData]);

  const onNodeClick = useCallback((_: any, node: Node) => {
    if (!isInteractableNode(node)) return;
    setSelectedNode(node);
    setDrawerOpen(true);
  }, []);

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
    const minimalState: Record<string, { state: string }> = {};
    nodes.forEach((n) => {
      if (n.data.state) {
        minimalState[n.id] = { state: n.data.state };
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
    animated: edgeConfig.animated ?? false,
    style: {
      stroke: edgeConfig.color ?? "#94a3b8",
      strokeWidth: edgeConfig.width ?? 2,
    },
    type: edgeConfig.type ?? "default",
  };

  return (
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
          className.push(n.data?.state);
          return {
            ...n,
            className: className.join(" "),
          };
        })}
        edges={edges}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onNodesChange={onNodesChange}
        nodeTypes={nodeTypes}
        fitView
        nodeOrigin={[0.5, 0.5]}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={defaultEdgeOptions}
        nodesDraggable={false}
        nodesConnectable={false}
      >
        <Controls showInteractive={false} />
      </ReactFlow>
      <Drawer node={selectedNode} open={drawerOpen} onClose={closeDrawer} onUpdate={updateNode} />
    </div>
  )
}
