import { Node, Panel } from "@xyflow/react";
import { NodeData } from "./types";
import { FC } from "react";
import { AlignCenterVertical, AlignCenterHorizontal, AlignEndHorizontal, AlignEndVertical, AlignStartVertical, AlignStartHorizontal, RulerDimensionLine, AlignVerticalDistributeCenter, AlignHorizontalDistributeCenter } from "lucide-react";

interface Props {
  nodes: Node<NodeData>[];
  onUpdate: (nodes: Node<NodeData>[]) => void;
}

export const MultiNodePanel: FC<Props> = ({ nodes, onUpdate }) => {

  const alignLeftVertical = () => {
    if (nodes.length < 2) return;
    const minX = Math.min(...nodes.map(n => n.position.x));
    const updatedNodes = nodes.map(n => ({
      ...n,
      position: { ...n.position, x: minX }
    }));
    onUpdate(updatedNodes);
  };

  const alignCenterVertical = () => {
    if (nodes.length < 2) return;
    const avgX = nodes.reduce((sum, n) => sum + n.position.x + (n.width || n.measured.width) / 2, 0) / nodes.length;
    const updatedNodes = nodes.map(n => ({
      ...n,
      position: { ...n.position, x: avgX - (n.width || n.measured.width) / 2 }
    }));
    onUpdate(updatedNodes);
  };

  const alignRightVertical = () => {
    if (nodes.length < 2) return;
    const maxX = Math.max(...nodes.map(n => n.position.x + (n.width || 0)));
    const updatedNodes = nodes.map(n => ({
      ...n,
      position: { ...n.position, x: maxX - (n.width || n.measured.width) }
    }));
    onUpdate(updatedNodes);
  };

  const alignLeft = () => {
    if (nodes.length < 2) return;
    const minY = Math.min(...nodes.map(n => n.position.y));
    const updatedNodes = nodes.map(n => ({
      ...n,
      position: { ...n.position, y: minY }
    }));
    onUpdate(updatedNodes);
  };

  const alignCenter = () => {
    if (nodes.length < 2) return;
    const avgY = nodes.reduce((sum, n) => sum + n.position.y + (n.height || n.measured.height) / 2, 0) / nodes.length;
    const updatedNodes = nodes.map(n => ({
      ...n,
      position: { ...n.position, y: avgY - (n.height || n.measured.height) / 2 }
    }));
    onUpdate(updatedNodes);
  };

  const alignRight = () => {
    if (nodes.length < 2) return;
    const maxY = Math.max(...nodes.map(n => n.position.y + (n.height || 0)));
    const updatedNodes = nodes.map(n => ({
      ...n,
      position: { ...n.position, y: maxY - (n.height || n.measured.height) }
    }));
    onUpdate(updatedNodes);
  };

  const distributeVertical = () => {
    if (nodes.length < 3) return;
    // Improved vertical distribution: ensures equal gaps between nodes regardless of node heights
    const sortedNodes = [...nodes].sort((a, b) => a.position.y - b.position.y);
    const minY = sortedNodes[0].position.y;
    const totalNodesHeight = sortedNodes.reduce((sum, n) => sum + (n.height || n.measured.height), 0);
    const maxY = sortedNodes[sortedNodes.length - 1].position.y;
    const availableSpace = (maxY - minY) + (sortedNodes[sortedNodes.length - 1].height || sortedNodes[sortedNodes.length - 1].measured.height) - totalNodesHeight;
    const gap = sortedNodes.length > 1 ? availableSpace / (sortedNodes.length - 1) : 0;
    let currentY = minY;
    const updatedNodes = sortedNodes.map((n, i) => {
      const updatedNode = {
        ...n,
        position: { ...n.position, y: currentY }
      };
      currentY += (n.height || n.measured.height) + gap;
      return updatedNode;
    });
    onUpdate(updatedNodes);
  };

  const distributeHorizontal = () => {
    if (nodes.length < 3) return;
    const sortedNodes = [...nodes].sort((a, b) => a.position.x - b.position.x);
    const minX = sortedNodes[0].position.x;
    const totalNodesWidth = sortedNodes.reduce((sum, n) => sum + (n.width || n.measured.width), 0);
    const maxX = sortedNodes[sortedNodes.length - 1].position.x;
    const availableSpace = (maxX - minX) + (sortedNodes[sortedNodes.length - 1].width || sortedNodes[sortedNodes.length - 1].measured.width) - totalNodesWidth;
    const gap = sortedNodes.length > 1 ? availableSpace / (sortedNodes.length - 1) : 0;
    let currentX = minX;
    const updatedNodes = sortedNodes.map((n, i) => {
      const updatedNode = {
        ...n,
        position: { ...n.position, x: currentX }
      };
      currentX += (n.width || n.measured.width) + gap;
      return updatedNode;
    });
    onUpdate(updatedNodes);
  };

  const sameWidth = () => {
    if (nodes.length < 2) return;
    const maxWidth = Math.max(...nodes.map(n => n.width || n.measured.width));
    const updatedNodes = nodes.map(n => ({
      ...n,
      width: maxWidth
    }));
    onUpdate(updatedNodes);
  };

  const sameHeight = () => {
    if (nodes.length < 2) return;
    const maxHeight = Math.max(...nodes.map(n => n.height || n.measured.height));
    const updatedNodes = nodes.map(n => ({
      ...n,
      height: maxHeight
    }));
    onUpdate(updatedNodes);
  };

  return <Panel position="bottom-center" className="multi-node-panel">
    <button title="Align Left Horizontal" onClick={alignLeft}><AlignStartHorizontal /></button>
    <button title="Align Center Horizontal" onClick={alignCenter}><AlignCenterHorizontal /></button>
    <button title="Align Right Horizontal" onClick={alignRight}><AlignEndHorizontal /></button>
    <button title="Align Top Vertical" onClick={alignLeftVertical}><AlignStartVertical /></button>
    <button title="Align Center Vertical" onClick={alignCenterVertical}><AlignCenterVertical /></button>
    <button title="Align Bottom Vertical" onClick={alignRightVertical}><AlignEndVertical /></button>
    {nodes.length > 2 && <button title="Distribute Vertical" onClick={distributeVertical}><AlignVerticalDistributeCenter /></button>}
    {nodes.length > 2 && <button title="Distribute Horizontal" onClick={distributeHorizontal}><AlignHorizontalDistributeCenter /></button>}
    <button title="Same Width" onClick={sameWidth}><RulerDimensionLine /></button>
    <button title="Same Height" onClick={sameHeight}><RulerDimensionLine style={{ transform: "rotate(90deg)" }} /></button>
  </Panel>;
}
