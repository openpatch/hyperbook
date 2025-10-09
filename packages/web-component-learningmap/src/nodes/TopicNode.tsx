import { Handle, Node, NodeResizer, Position } from "@xyflow/react";
import { NodeData } from "../types";
import StarCircle from "../icons/StarCircle";

export const TopicNode = ({ data, selected, isConnectable }: Node<NodeData>) => {
  return (
    <>
      {isConnectable && <NodeResizer isVisible={selected} />}
      {data.state === "mastered" && <StarCircle className="icon" />}
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
          style={{ visibility: !isConnectable ? "hidden" : "visible" }}
          position={Position[pos]}
          id={pos.toLowerCase()}
          isConnectable={true}
        />
      ))}

      {["Bottom", "Top", "Left", "Right"].map((pos) => (
        <Handle
          key={`${pos}-target`}
          type="target"
          style={{ visibility: !isConnectable ? "hidden" : "visible" }}
          position={Position[pos]}
          id={pos.toLowerCase()}
          isConnectable={true}
        />
      ))}
    </>
  );
};
