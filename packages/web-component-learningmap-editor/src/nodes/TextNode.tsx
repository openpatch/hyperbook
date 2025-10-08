import { Node } from "@xyflow/react";
import { TextNodeData } from "../types";

export const TextNode = ({ data }: Node<TextNodeData>) => {
  return (
    <>
      <div
        style={{
          fontSize: data.fontSize || 32,
          color: data.color || "#e5e7eb",
          fontWeight: "bold",
          transform: `rotate(${data.rotation || 0}deg)`
        }}
      >
        {data.text || "No Text"}
      </div>
    </>
  );
};
