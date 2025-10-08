import { Controls, Edge, Node, ReactFlow, useEdgesState, useNodesState } from "@xyflow/react";
import { ImageNode } from "./nodes/ImageNode";
import { TaskNode } from "./nodes/TaskNode";
import { TextNode } from "./nodes/TextNode";
import { TopicNode } from "./nodes/TopicNode";
import { BackgroundConfig, EdgeConfig, NodeData, RoadmapData } from "./types";
import { useCallback, useEffect, useState } from "react";
import { parseRoadmapData } from "./helper";

const nodeTypes = {
  topic: TopicNode,
  task: TaskNode,
  image: ImageNode,
  text: TextNode,
};

export function LearningMap({
  roadmapData,
  language = "en"
}: {
  roadmapData: string | RoadmapData;
  language?: string;
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

      const rawNodes = nodesArr.map((n) => ({
        ...n,
        draggable: false,
        data: { ...n.data },
      }));

      setEdges(edgesArr);
      setNodes(rawNodes);
    }
    loadRoadmap();
  }, [roadmapData]);

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNode(node);
    setDrawerOpen(true);
  }, []);

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

  const handleSave = useCallback(() => {
    const root = document.querySelector("hyperbook-learningmap-editor");
    if (root) {
      root.dispatchEvent(new CustomEvent("change", { detail: roadmapData }));
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
          return {
            ...n,
            className: className.join(" "),
            data: {
              ...n.data,
            }
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
    </div>
  )
}
