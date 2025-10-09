import { Node, NodeResizer } from "@xyflow/react";
import { ImageNodeData } from "../types";

export const ImageNode = ({ data, selected }: Node<ImageNodeData>) => {
  return (
    <>
      {data.data ? (
        <>
          <NodeResizer isVisible={selected} keepAspectRatio />
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", width: "100%", height: "100%", overflow: "hidden" }}>
            <img
              src={data.data}
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
              }}
            />
          </div>
        </>
      ) : (
        <span>No Image</span>
      )}
    </>
  );
};
