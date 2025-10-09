import ELK from "elkjs/lib/elk.bundled.js";
import type { Node, Edge } from "@xyflow/react";

export async function getAutoLayoutedNodesElk(
  nodes: Node[],
  edges: Edge[],
  nodeWidth = 320,
  nodeHeight = 120
) {
  const elk = new ELK();
  const elkNodes = nodes.map((node: Node) => ({
    id: node.id,
    width: nodeWidth,
    height: nodeHeight,
    ...node,
  }));
  const elkEdges = edges.map((edge: Edge) => ({
    id: edge.id,
    sources: [edge.source],
    targets: [edge.target],
  }));
  const elkGraph = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "DOWN",
      "elk.layered.spacing.nodeNodeBetweenLayers": "100",
      "elk.spacing.nodeNode": "80",
    },
    children: elkNodes,
    edges: elkEdges,
  };
  const layout: any = await elk.layout(elkGraph);
  return nodes.map((node: Node) => {
    if (node.position) return node;
    const layoutNode = layout.children.find((n: any) => n.id === node.id);
    return {
      ...node,
      position: { x: layoutNode.x, y: layoutNode.y },
      autoPositioned: true,
    };
  });
}
