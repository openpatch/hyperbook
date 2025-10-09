import { Node } from "@xyflow/react";
import { NodeData } from "./types";
import { X, Lock, CheckCircle } from "lucide-react";
import { Video } from "./Video";
import StarCircle from "./icons/StarCircle";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  onUpdate: (node: Node<NodeData>) => void;
  node: Node<NodeData>
}

export function Drawer({ open, onClose, onUpdate, node }: DrawerProps) {
  if (!open) return null;

  const locked = node.data?.state === 'locked' || false;
  const unlocked = node.data?.state === 'unlocked' || false;
  const completed = node.data?.state === 'completed' || false;
  const started = node.data?.state === 'started' || false;
  const mastered = node.data?.state === 'mastered' || false;

  const handleStateChange = (newState: 'locked' | 'unlocked' | 'started' | 'completed') => () => {
    if (node.type === "topic" || locked) return;

    onUpdate({
      ...node,
      data: {
        ...node.data,
        state: newState
      }
    });
  };

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <aside className="drawer">
        <header className="drawer-header">
          <div>
            <h2 className="drawer-title">{node.data?.label}</h2>
            {node.data?.duration && <div style={{ fontSize: 16, color: '#6b7280', marginTop: 4 }}>{node.data.duration}</div>}
          </div>
          <button className="close-button" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </header>
        <div className="drawer-content">
          {node.data?.description && <div className="drawer-description" style={{ marginBottom: 16 }}>{node.data?.description}</div>}
          {node.data?.video && <div className="drawer-video" style={{ marginBottom: 16 }}>
            <Video url={node.data?.video} />
          </div>}
          {node.data?.resources && node.data?.resources.length > 0 && (
            <div className="drawer-resources" style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Resources:</div>
              <ul>
                {node.data?.resources.map((r: any) => (
                  <li key={r.url}><a href={r.url} target="_blank" rel="noopener noreferrer">{r.label}</a></li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="drawer-footer">
          {locked &&
            <button className="drawer-button locked"><Lock /> Locked</button>
          }
          {unlocked && (
            <button className="drawer-button unlocked" onClick={handleStateChange("started")}>Mark as Started</button>
          )}
          {started && (
            <button className="drawer-button started" onClick={handleStateChange("completed")}>Mark as Completed</button>
          )}
          {completed && (
            <button className="drawer-button completed" disabled><CheckCircle /> Completed</button>
          )}
          {mastered && (
            <button className="drawer-button mastered" disabled><StarCircle /> Mastered</button>
          )}
        </div>
      </aside>
    </>
  );
}
