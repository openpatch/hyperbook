import { Node } from "@xyflow/react";
import { NodeData } from "./types";
import { X, Lock, CheckCircle } from "lucide-react";
import { Video } from "./Video";
import StarCircle from "./icons/StarCircle";
import { getTranslations } from "./translations";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  onUpdate: (node: Node<NodeData>) => void;
  node: Node<NodeData>;
  nodes: Node<NodeData>[];
  onNodeClick: (_: any, node: Node<NodeData>, focus: boolean) => void;
  language?: string;
}

function getUnlockConditions(node: Node<NodeData>, nodes: Node<NodeData>[]): Node<NodeData>[] {
  const unmetNeeds: Node<NodeData>[] = [];
  if (node.data?.unlock?.after) {
    node.data.unlock.after.forEach((depId: string) => {
      const depNode = nodes.find(n => n.id === depId);
      if (depNode && depNode.data?.state !== 'completed' && depNode.data?.state !== 'mastered') {
        unmetNeeds.push(depNode);
      }
    });
  }
  return unmetNeeds;
}

function getCompletionNeeds(node: Node<NodeData>, nodes: Node<NodeData>[]): Node<NodeData>[] {
  const unmetNeeds: Node<NodeData>[] = [];
  if (node.data?.completion?.needs) {
    node.data.completion.needs.forEach((needId: string) => {
      const needNode = nodes.find(n => n.id === needId);
      if (needNode && needNode.data?.state !== 'completed' && needNode.data?.state !== 'mastered') {
        unmetNeeds.push(needNode);
      }
    });
  }
  return unmetNeeds;
}

function getCompletionOptional(node: Node<NodeData>, nodes: Node<NodeData>[]): Node<NodeData>[] {
  const unmetOptional: Node<NodeData>[] = [];
  if (node.data?.completion?.optional) {
    node.data.completion.optional.forEach((optId: string) => {
      const optNode = nodes.find(n => n.id === optId);
      if (optNode && optNode.data?.state !== 'completed' && optNode.data?.state !== 'mastered') {
        unmetOptional.push(optNode);
      }
    });
  }
  return unmetOptional;
}

export function Drawer({ open, onClose, onUpdate, node, nodes, onNodeClick, language = "en" }: DrawerProps) {
  const t = getTranslations(language);

  if (!open) return null;

  const locked = node.data?.state === 'locked' || false;
  const unlocked = node.data?.state === 'unlocked' || false;
  const completed = node.data?.state === 'completed' || false;
  const started = node.data?.state === 'started' || false;
  const mastered = node.data?.state === 'mastered' || false;

  const unlockConditions = getUnlockConditions(node, nodes);
  const completionNeeds = getCompletionNeeds(node, nodes);
  const completionOptional = getCompletionOptional(node, nodes);

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
              <div style={{ fontWeight: 600, marginBottom: 8 }}>{t.resourcesLabel}</div>
              <ul>
                {node.data?.resources.map((r: any) => (
                  <li key={r.url}><a href={r.url} target="_blank" rel="noopener noreferrer">{r.label}</a></li>
                ))}
              </ul>
            </div>
          )}
          {unlockConditions.length > 0 && (
            <div className="drawer-unlock-conditions" style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>{t.unlockConditionsMessage}</div>
              <ul>
                {unlockConditions.map(n => (
                  <li key={n.id}>
                    <button className="link-button" onClick={() => { onNodeClick(null, n, true); }}>
                      {n.data?.label || n.id} - {n.data?.state}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!locked && completionNeeds.length > 0 && (
            <div className="drawer-completion-needs" style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>{t.completionNeedsMessage}</div>
              <ul>
                {completionNeeds.map(n => (
                  <li key={n.id}>
                    <button className="link-button" onClick={() => { onNodeClick(null, n, true); }}>
                      {n.data?.label || n.id} - {n.data?.state}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="drawer-footer">
          {node.type === "topic" ? (
            <>
              {!locked && completionNeeds.length > 0 && (
                <button className="drawer-button needs" disabled>{t.finishNeedsToComplete}</button>
              )}
              {!locked && completionNeeds.length === 0 && completionOptional.length > 0 && (
                <button className="drawer-button optional" disabled>{t.finishOptionalToMaster}</button>
              )}
              {!locked && completionNeeds.length === 0 && completionOptional.length === 0 && (
                <button className="drawer-button completed" disabled><CheckCircle /> {t.mastered}</button>
              )}
              {locked && (
                <button className="drawer-button locked"><Lock /> {t.locked}</button>
              )}
            </>
          ) : (
            <>
              {locked &&
                <button className="drawer-button locked"><Lock /> {t.locked}</button>
              }
              {unlocked && (
                <button className="drawer-button unlocked" onClick={handleStateChange("started")}>{t.markAsStarted}</button>
              )}
              {started && (
                <button className="drawer-button started" onClick={handleStateChange("completed")}>{t.markAsCompleted}</button>
              )}
              {completed && (
                <button className="drawer-button completed" disabled><CheckCircle /> {t.completedLabel}</button>
              )}
              {mastered && (
                <button className="drawer-button mastered" disabled><StarCircle /> {t.mastered}</button>
              )}
            </>
          )}
        </div>
      </aside>
    </>
  );
}
