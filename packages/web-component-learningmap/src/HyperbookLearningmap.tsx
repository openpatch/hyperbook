import { useState, useCallback, useEffect } from "react";
import { getAutoLayoutedNodesElk } from "./autoLayoutElk";
import * as yaml from "js-yaml";
import {
  ReactFlow,
  Controls,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  Handle,
  Position,
  ColorMode,
  useReactFlow,
  Node,
  useOnViewportChange,
} from "@xyflow/react";
import {
  CheckCircle2,
  Circle,
  Lock,
  Clock,
  Compass,
  Star
} from "lucide-react";

interface UnlockCondition {
  after?: string[];      // Node IDs that must be completed
  date?: string;         // ISO date string for unlock
  password?: string;     // Password required to unlock
}

interface CompletionNeed {
  id: string;
  source?: string;
  target?: string;
}

interface Completion {
  needs?: CompletionNeed[];
  optional?: CompletionNeed[];
}

interface TopicNodeData {
  label: string;
  description?: string;
  duration?: string;
  position?: { x: number; y: number };
  unlock?: UnlockCondition;
  completion?: Completion;
  video?: string;
  resources?: { label: string; url: string }[];
  summary?: string;
  [key: string]: any;
}

interface TaskNodeData {
  label: string;
  description?: string;
  duration?: string;
  position?: { x: number; y: number };
  unlock?: UnlockCondition;
  video?: string;
  resources?: { label: string; url: string }[];
  summary?: string;
  [key: string]: any;
}

type LearningNodeData = TaskNodeData | TopicNodeData;

// ============================================================================
// VIDEO UTILS
// ============================================================================

function isYoutubeUrl(url: string) {
  return (
    typeof url === "string" &&
    (url.includes("youtube.com/watch?v=") || url.includes("youtu.be/"))
  );
}

function getYoutubeEmbedUrl(url: string) {
  if (url.includes("youtube.com/watch?v=")) {
    const videoId = url.split("v=")[1].split("&")[0];
    return `https://www.youtube-nocookie.com/embed/${videoId}`;
  }
  if (url.includes("youtu.be/")) {
    const videoId = url.split("youtu.be/")[1].split("?")[0];
    return `https://www.youtube-nocookie.com/embed/${videoId}`;
  }
  return url;
}

function getVideoMimeType(url: string) {
  if (url.endsWith(".webm")) return "video/webm";
  if (url.endsWith(".mp4")) return "video/mp4";
  return "video/mp4";
}

// ============================================================================
// CONSTANTS & TYPES
// ============================================================================

const TEXTS = {
  en: {
    trackJourney: "Track your learning journey",
    progress: "Progress",
    completed: "Completed",
    available: "Available",
    locked: "Locked",
    topicsCompleted: "{completed} of {total} completed",
    markAsComplete: "Mark as Complete",
    markAsIncomplete: "Mark as Incomplete",
    unlock: "Unlock",
    unlocked: "Unlocked",
    lockedBtn: "Locked",
    resources: "Resources",
    optional: "Optional",
    passwordPlaceholder: "Password",
    incorrectPassword: "Incorrect password",
    startTask: "Start the Task",
    inProgressLegend: "In Progress",
    unlockPasswordHint: "Enter password to unlock this node.",
    unlockDateHint: "This node unlocks after {date}.",
    unlockAfterHint: "Complete these first:",
    unlockClose: "Close",
    unlockButton: "Unlock",
    task: "Task"
  },
  // ...other languages unchanged...
  de: {
    trackJourney: "Verfolge deinen Lernfortschritt",
    progress: "Fortschritt",
    completed: "Abgeschlossen",
    available: "Verfügbar",
    locked: "Gesperrt",
    topicsCompleted: "{completed} von {total} abgeschlossen",
    markAsComplete: "Als abgeschlossen markieren",
    markAsIncomplete: "Als nicht abgeschlossen markieren",
    unlock: "Entsperren",
    unlocked: "Entsperrt",
    lockedBtn: "Gesperrt",
    resources: "Ressourcen",
    optional: "Optional",
    passwordPlaceholder: "Passwort",
    incorrectPassword: "Falsches Passwort",
    startTask: "Starte die Aufgabe",
    inProgressLegend: "In Bearbeitung",
    unlockPasswordHint: "Passwort eingeben, um dieses Thema zu entsperren.",
    unlockDateHint: "Dieses Thema wird nach dem {date} freigeschaltet.",
    unlockAfterHint: "Folgende zuerst abschließen:",
    unlockClose: "Schließen",
    unlockButton: "Entsperren",
    task: "Aufgabe"
  },
  // ...other languages unchanged...
  es: {
    trackJourney: "Sigue tu trayectoria de aprendizaje",
    progress: "Progreso",
    completed: "Completado",
    available: "Disponible",
    locked: "Bloqueado",
    topicsCompleted: "{completed} de {total} completados",
    markAsComplete: "Marcar como completado",
    markAsIncomplete: "Marcar como incompleto",
    unlock: "Desbloquear",
    unlocked: "Desbloqueado",
    lockedBtn: "Bloqueado",
    resources: "Recursos",
    optional: "Opcional",
    passwordPlaceholder: "Ingresa la contraseña",
    incorrectPassword: "Contraseña incorrecta",
    startTask: "Iniciar la tarea",
    inProgressLegend: "En progreso",
    unlockPasswordHint: "Ingresa la contraseña para desbloquear este nodo.",
    unlockDateHint: "Este nodo se desbloquea después de {date}.",
    unlockAfterHint: "Completa estos primero:",
    unlockClose: "Cerrar",
    unlockButton: "Desbloquear",
    task: "Tarea"
  },
  fr: {
    trackJourney: "Suivez votre parcours d'apprentissage",
    progress: "Progrès",
    completed: "Terminé",
    available: "Disponible",
    locked: "Verrouillé",
    topicsCompleted: "{completed} sur {total} terminés",
    markAsComplete: "Marquer comme terminé",
    markAsIncomplete: "Marquer comme incomplet",
    unlock: "Déverrouiller",
    unlocked: "Déverrouillé",
    lockedBtn: "Verrouillé",
    resources: "Ressources",
    optional: "Optionnel",
    passwordPlaceholder: "Entrez le mot de passe",
    incorrectPassword: "Mot de passe incorrect",
    startTask: "Commencer la tâche",
    inProgressLegend: "En cours",
    unlockPasswordHint: "Entrez le mot de passe pour déverrouiller ce nœud.",
    unlockDateHint: "Ce nœud se déverrouille après le {date}.",
    unlockAfterHint: "Terminez ceux-ci d'abord :",
    unlockClose: "Fermer",
    unlockButton: "Déverrouiller",
    task: "Tâche"
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const parseRoadmapData = (roadmapData: string) => {
  if (typeof roadmapData !== "string") {
    return roadmapData;
  }

  try {
    return JSON.parse(roadmapData);
  } catch {
    try {
      return yaml.load(roadmapData);
    } catch (err) {
      console.error("Failed to parse roadmap data:", err);
      return {};
    }
  }
};

const generateEdgesFromCompletionNeeds = (nodes: Node<LearningNodeData>[], edgeConfig) => {
  const edges = [];
  nodes.forEach((node) => {
    const needs = node.data?.completion?.needs || [];
    needs.forEach((need: CompletionNeed) => {
      if (need.id) {
        edges.push({
          id: `${need.id}->${node.id}`,
          source: need.id,
          target: node.id,
          sourceHandle: need.source || "bottom",
          targetHandle: need.target || "top",
        });
      }
    });
    const optional = node.data?.completion?.optional || [];
    optional.forEach((opt: CompletionNeed) => {
      if (opt.id) {
        edges.push({
          id: `${opt.id}->${node.id}-optional`,
          source: opt.id,
          target: node.id,
          sourceHandle: opt.source || "bottom",
          targetHandle: opt.target || "top",
          style: { strokeDasharray: "5,5", strokeWidth: edgeConfig.width ?? 2, stroke: edgeConfig.color ?? "#94a3b8" },
        });
      }
    });
  });
  return edges;
};

const areUnlockAfterCompleted = (node: Node<any>, stateLookup: Record<string, { state: string }>) => {
  const unlockAfter = node.data?.unlock?.after || [];
  return unlockAfter.every((id: string) => stateLookup[id]?.state === "completed");
};

const isUnlockDatePassed = (node: Node<LearningNodeData>) => {
  const unlockDate = node.data?.unlock?.date;
  if (!unlockDate) return true;
  return new Date() >= new Date(unlockDate);
};

const isUnlockedByPassword = (node: Node<LearningNodeData>, savedPassword: boolean) => {
  const password = node.data?.unlock?.password;
  if (!password) return true;
  return savedPassword;
};

const getLockedStyle = (isLocked: boolean) => {
  return isLocked
    ? {
      background: "#f3f4f6",
      color: "#a1a1aa",
      borderColor: "#d1d5db",
      boxShadow: "none",
    }
    : {};
};

function areCompletionNeedsMet(node: Node<LearningNodeData>, nodesArr: Node<LearningNodeData>[]) {
  const needs = node.data?.completion?.needs || [];
  if (needs.length === 0) return true;
  return needs.every((need: CompletionNeed) => {
    const neededNode = nodesArr.find(n => n.id === need.id);
    return neededNode?.data?.state === "completed" || neededNode?.data?.state === "fully-completed";
  });
}

function getTopicNodeStatus(node: Node<LearningNodeData>, stateLookup: Record<string, { state: string }>) {
  if (node.type !== "topic") return node.data.state;

  const needs = node.data?.completion?.needs || [];
  const optional = node.data?.completion?.optional || [];

  const needsStates = needs.map((n: { id: string }) => stateLookup[n.id]?.state);
  const optionalStates = optional.map((n: { id: string }) => stateLookup[n.id]?.state);

  const anyStartedOrCompleted = [...needsStates, ...optionalStates].some(
    s => s === "started" || s === "completed" || s === "fully-completed"
  );
  const allNeedsCompleted = needs.length > 0 && needsStates.every(s => s === "completed" || s === "fully-completed");
  const allOptionalCompleted = optional.length === 0 || optionalStates.every(s => s === "completed" || s === "fully-completed");
  const allNeedsAndOptionalCompleted = allNeedsCompleted && allOptionalCompleted;

  if (allNeedsAndOptionalCompleted) return "fully-completed";
  if (allNeedsCompleted) return "completed";
  if (anyStartedOrCompleted) return "started";
  return undefined;
}

function getAllOptionalNodeIds(nodes: Node<LearningNodeData>[]) {
  const ids = [];
  nodes.forEach(n => {
    if (n.type === "topic" && Array.isArray(n.data?.completion?.optional)) {
      n.data.completion.optional.forEach((opt: { id: string }) => {
        if (opt.id) ids.push(opt.id);
      });
    }
  });
  return ids;
}

// ============================================================================
// UNLOCK ICON & POPUP
// ============================================================================

function getLocaleFromLanguage(language: string): string {
  // Map your language code to a locale string
  switch (language) {
    case "de": return "de-DE";
    case "es": return "es-ES";
    case "fr": return "fr-FR";
    case "en":
    default: return "en-US";
  }
}

function getUnlockInfo(unlock: UnlockCondition, t, language = "en") {
  if (!unlock) return null;
  if (unlock.password) {
    return { icon: <Lock className="node-icon" />, hint: t.unlockPasswordHint, type: "password" };
  }
  if (unlock.date) {
    // Format date according to locale
    const locale = getLocaleFromLanguage(language);
    const dateObj = new Date(unlock.date);
    const formattedDate = isNaN(dateObj.getTime())
      ? unlock.date
      : dateObj.toLocaleDateString(locale, { year: "numeric", month: "long", day: "numeric" });
    return { icon: <Clock className="node-icon" />, hint: t.unlockDateHint.replace("{date}", formattedDate), type: "date" };
  }
  if (unlock.after && unlock.after.length > 0) {
    return { icon: <Compass className="node-icon" />, hint: t.unlockAfterHint, type: "after" };
  }
  return null;
}

// ============================================================================
// NODE COMPONENTS
// ============================================================================

const LearningNode = ({ data, type, language }) => {
  const t = TEXTS[language] || TEXTS.en;

  const isCompleted = data.state === "completed";
  const isFullyCompleted = data.state === "fully-completed";
  const isLocked = data.locked;
  const isStarted = data.state === "started";
  const isOptional = data.isOptional;

  const unlockInfo = getUnlockInfo(data.unlock, t, language);

  const lockedStyle = getLockedStyle(isLocked);
  const startedStyle = isStarted ? { borderColor: "#f59e42" } : {};

  return (
    <div
      className={`learning-node${isLocked ? " locked" : ""} ${(isCompleted || isFullyCompleted) ? "completed" : isStarted ? "started" : "available"}${isOptional ? " optional" : ""}`}
      style={{ ...startedStyle, ...lockedStyle, position: "relative" }}
    >
      <div className="node-header" style={{ display: "flex", alignItems: "center", flexDirection: "column" }}>
        {type === "task" && (
          <div
            className="node-task-label"
            style={{
              fontSize: "11px",
              color: isLocked ? "#a1a1aa" : "#1f2937",
              marginBottom: "1px",
            }}
          >
            {t.task}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center" }}>
          {unlockInfo ? (
            unlockInfo.icon
          ) : (isCompleted || isFullyCompleted) ? (
            <CheckCircle2 className="node-icon" style={{ color: "#16a34a" }} />
          ) : isStarted ? (
            <Circle className="node-icon" style={{ color: "#f59e42" }} />
          ) : (
            <Circle className="node-icon" style={{ color: "#4b5563" }} />
          )}
          <div
            className="node-label"
            style={{ color: isLocked ? "#a1a1aa" : "#1f2937", marginLeft: "0.5em" }}
          >
            {data.label}
          </div>
        </div>
      </div>

      {isFullyCompleted && (
        <Star
          className="node-star-icon"
          style={{
            position: "absolute",
            top: -12,
            right: -12,
            color: "#f59e42",
            background: "white",
            borderRadius: "50%",
            boxShadow: "0 2px 8px rgba(245, 158, 66, 0.15)",
            zIndex: 2,
            width: 32,
            height: 32,
            border: "2px solid #f59e42"
          }}
        />
      )}

      {data.summary && (
        <div
          className="node-description"
          style={{ color: isLocked ? "#a1a1aa" : "#4b5563" }}
        >
          {data.summary}
        </div>
      )}

      {["Bottom", "Top", "Left", "Right"].map((pos) => (
        <Handle
          key={`${pos}-source`}
          type="source"
          position={Position[pos]}
          id={pos.toLowerCase()}
          isConnectable={false}
        />
      ))}

      {["Bottom", "Top", "Left", "Right"].map((pos) => (
        <Handle
          key={`${pos}-target`}
          type="target"
          position={Position[pos]}
          id={pos.toLowerCase()}
          isConnectable={false}
        />
      ))}
    </div>
  );
};

const BackgroundNode = ({ data }) => {
  if (!data.image?.src) return null;
  return <img src={data.image.src} alt="Background" />;
};

const DebugNode = ({ data }) => {
  const { screenToFlowPosition } = useReactFlow();
  const [mousePos, setMousePos] = useState(null);

  if (!data?.bounds) return null;

  const handleMouseMove = (e: any) => {
    const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    setMousePos(flowPos);
  };

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div>
      <div><strong>Debug Node</strong></div>
      <div>Position: x={data.bounds.x}, y={data.bounds.y}</div>
      <div>
        Mouse Position:
        {mousePos
          ? `x=${mousePos.x.toFixed(2)}, y=${mousePos.y.toFixed(2)}`
          : 'Move mouse over node'}
      </div>
      <div>Size: width={data.bounds.width}, height={data.bounds.height}</div>
    </div>
  );
};

// ============================================================================
// DRAWER COMPONENTS
// ============================================================================

const NodeDrawer = ({ node, isOpen, onClose, onPasswordUnlock, onToggleComplete, language = "en", setNode }) => {
  const t = TEXTS[language] || TEXTS.en;
  if (!isOpen || !node) return null;

  const { getNodes } = useReactFlow();
  const nodesArr = getNodes();

  const { state, locked: isLocked, completion, unlock, label, duration, description, video, resources } = node.data;

  // Check completion needs
  const unmetNeeds = (completion?.needs || [])
    .map((need) => {
      const n = nodesArr.find((n) => n.id === need.id);
      const completed = n?.data?.state === "completed" || n?.data?.state === "fully-completed";
      return !completed ? (n?.data?.label || need.id) : null;
    })
    .filter(Boolean);

  const needsMet = unmetNeeds.length === 0;

  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState(false);

  // Password unlock handler
  const handlePasswordUnlock = (e: any) => {
    e.preventDefault();
    if (passwordInput === unlock.password) {
      onPasswordUnlock();
      setPasswordError(false);
    } else {
      setPasswordError(true);
    }
  };

  let buttonText = t.startTask;
  if (state === "started") buttonText = t.markAsComplete;
  if (state === "completed" || state === "fully-completed") buttonText = t.completed;

  const buttonStyle = state === "started" ? { backgroundColor: "#f59e42", color: "#fff" } : {};
  const unlockInfo = getUnlockInfo(unlock, t, language);

  let content = null
  if (!isLocked) {
    content = (
      <>
        {description && (
          <div className="drawer-description">
            {description.split("\n").map((text: string, idx: number) => (
              <p key={idx}>{text}</p>
            ))}
          </div>
        )}

        {video && (
          <div className="drawer-video">
            {isYoutubeUrl(video) ? (
              <iframe
                width="100%"
                height="315"
                src={getYoutubeEmbedUrl(video)}
                title="YouTube video player"
                allowFullScreen
              />
            ) : (
              <video width="100%" height="315" controls>
                <source src={video} type={getVideoMimeType(video)} />
                Your browser does not support the video tag.
              </video>
            )}
          </div>
        )}

        {Array.isArray(resources) && resources.length > 0 && (
          <div className="drawer-resources">
            <h3>{t.resources}</h3>
            <ul>
              {resources.map((res, idx) => (
                <li key={idx}>
                  <a href={res.url} target="_blank" rel="noopener noreferrer">
                    {res.label || res.url}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!needsMet && (
          <div style={{ marginBottom: "1em", color: "#f59e42", fontWeight: "bold" }}>
            <h3>{t.unlockAfterHint}</h3>
            <ul>
              {unmetNeeds.map((label, idx) => (
                <li key={idx}>{label}</li>
              ))}
            </ul>
          </div>
        )}
      </>
    )
  } else if (unlockInfo.type === "password") {
    content = (
      <div style={{ marginTop: "1em" }}>
        <p>
          {unlockInfo.hint}
        </p>
        <input
          type="password"
          className="drawer-password-input"
          placeholder={t.passwordPlaceholder}
          value={passwordInput}
          onChange={(e) => setPasswordInput(e.target.value)}
          style={{ marginRight: "0.5em" }}
        />
        <button onClick={handlePasswordUnlock}>{t.unlockButton}</button>
        {passwordError && (
          <div style={{ color: "red", marginTop: "0.5em" }}>{t.incorrectPassword}</div>
        )}
      </div>
    )
  } else if (unlockInfo.type === "date") {

    content = (
      <div style={{ marginTop: "1em" }}>
        <p>
          {unlockInfo.hint}
        </p>
      </div>
    )
  } else if (unlockInfo.type === "after") {
    const needsList = unlock?.after
      ? unlock.after.map((id) => {
        const n = nodesArr.find((n) => n.id === id);
        const completed = n?.data?.state === "completed" || n?.data?.state === "fully-completed";
        return { label: n?.data?.label || id, completed };
      })
      : [];

    content = needsList.length > 0 && (
      <div style={{ marginTop: "1em" }}>
        <p>
          {unlockInfo.hint}
        </p>
        <ul>
          {needsList.map((need, idx) => (
            <li key={idx} style={{ textDecoration: need.completed ? "line-through" : "none" }}>
              {need.label}
            </li>
          ))}
        </ul>
      </div>
    )

  }

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer">
        <div className="drawer-header">
          <h2 className="drawer-title">{label}</h2>
          {duration && <div className="drawer-duration">⏱️ {duration}</div>}
        </div>

        <div className="drawer-content">
          {content}
        </div>

        <div className="drawer-footer">
          <button
            onClick={node.type === "topic" ? undefined : onToggleComplete}
            disabled={isLocked || !needsMet}
            className={`complete-button ${state === "completed" || state === "fully-completed" ? "completed" : ""} ${isLocked || !needsMet ? "locked" : ""}`}
            style={buttonStyle}
          >
            {isLocked ? (
              <>
                <Lock size={20} /> {t.lockedBtn}
              </>
            ) : !needsMet ? (
              <>
                <Lock size={20} /> {t.lockedBtn}
              </>
            ) : state === "completed" || state === "fully-completed" ? (
              <>
                <CheckCircle2 size={20} /> {buttonText}
              </>
            ) : (
              <>
                <Circle size={20} /> {buttonText}
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

function HyperbookLearningmapInner({ roadmapData, nodeState, language = "en", x = 0, y = 0, zoom = 1 }) {
  const t = TEXTS[language] || TEXTS.en;
  const { getNodesBounds, setViewport } = useReactFlow();

  const [nodes, setNodes] = useNodesState([]);
  const [edges, setEdges] = useEdgesState([]);
  const [colorMode, setColorMode] = useState<ColorMode>("light");
  const [selectedNode, setSelectedNode] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showDebugNode, setShowDebugNode] = useState(false);
  const [unlockedPasswords, setUnlockedPasswords] = useState({});

  const parsedRoadmap = parseRoadmapData(roadmapData);
  const nodesArr = Array.isArray(parsedRoadmap?.nodes) ? parsedRoadmap.nodes : [];
  const edgesArr = Array.isArray(parsedRoadmap?.edges) ? parsedRoadmap.edges : [];
  const completedMap = nodeState || {};


  // Edge configuration
  const edgeConfig = parsedRoadmap?.edges || {};
  const defaultEdgeOptions = {
    animated: edgeConfig.animated ?? false,
    style: {
      stroke: edgeConfig.color ?? "#94a3b8",
      strokeWidth: edgeConfig.width ?? 2,
    },
    type: edgeConfig.type ?? "default",
    selectable: false,
  };

  // Create background node if configured
  const createBackgroundNode = () => {
    if (!parsedRoadmap?.background?.image) return null;
    const img = parsedRoadmap.background.image;
    return {
      id: "background-image",
      type: "background",
      position: { x: img.x ?? 0, y: img.y ?? 0 },
      data: { image: { src: img.src } },
      draggable: false,
      selectable: false,
      focusable: false,
      zIndex: -1,
    };
  };

  // Create debug node
  const createDebugNode = (currentNodes: Node[]) => {
    if (!showDebugNode || !currentNodes.length) return null;
    const filteredNodes = currentNodes.filter((n) => n.type !== "debug");
    const bounds = getNodesBounds(filteredNodes);
    return {
      id: "debug-node",
      type: "debug",
      position: { x: bounds.x, y: bounds.y },
      data: { bounds },
      style: {
        outline: "2px solid red",
        background: "rgba(255,255,255,0.8)",
        fontSize: "32px",
        width: bounds.width,
        height: bounds.height,
      },
      draggable: false,
      selectable: false,
      focusable: false,
      zIndex: 999,
    };
  };

  const updateNodes = (nodes: Node<LearningNodeData>[]): Node<LearningNodeData>[] => {
    let stateLookup: Record<string, { state: string }> = Object.fromEntries(
      nodes.map((n) => [n.id, { state: n.data.state }])
    );

    let recalculatedNodes = nodes.map((node) => {
      let locked = false;
      if (node.data?.unlock) {
        if (node.data.unlock.after && node.data.unlock.after.length > 0) {
          if (!areUnlockAfterCompleted(node, stateLookup)) locked = true;
        }
        if (node.data.unlock.date) {
          if (!isUnlockDatePassed(node)) locked = true;
        }
        if (node.data.unlock.password) {
          if (!isUnlockedByPassword(node, node.data?.password)) locked = true;
        }
      }

      return {
        ...node,
        data: {
          ...node.data,
          locked,
          state: locked ? undefined : node.data.state,
          password: locked ? false : node.data.password
        },
      };
    });

    stateLookup = Object.fromEntries(
      recalculatedNodes.map((n) => [n.id, { state: n.data.state }])
    );

    recalculatedNodes = recalculatedNodes.map((node) => {
      if (node.type === "topic") {
        const state = getTopicNodeStatus(node, stateLookup);
        return {
          ...node,
          data: {
            ...node.data,
            state,
          },
        };
      }
      return node;
    });

    const minimalState = {};
    recalculatedNodes.forEach((n) => {
      if (n.data.state) {
        minimalState[n.id] = { state: n.data.state, password: n.data.password };
      }
    });

    const root = document.querySelector("hyperbook-learningmap");
    if (root) {
      root.dispatchEvent(new CustomEvent("change", { detail: minimalState }));
    }


    return recalculatedNodes;

  }

  useOnViewportChange({
    onChange: (viewport) => {
      const root = document.querySelector("hyperbook-learningmap");
      if (root) {
        root.dispatchEvent(new CustomEvent("viewport-change", {
          detail: {
            x: viewport.x,
            y: viewport.y,
            zoom: viewport.zoom,
          }
        }));
      }
    }
  });

  // Initialize layout
  useEffect(() => {
    async function layoutNodes() {
      const rawNodes = ((nodes: Node<LearningNodeData>[]) => {
        const stateLookup = Object.fromEntries(
          nodes.map((n: Node) => [n.id, completedMap[n.id] || {}])
        );

        const allOptionalIds = getAllOptionalNodeIds(nodes);

        return nodes.map((node: Node<LearningNodeData>) => {
          const nodeStateObj = completedMap[node.id] || {};
          let state = nodeStateObj.state;
          const password = nodeStateObj.password;

          // Unlock logic
          let locked = false;
          if (node.data?.unlock) {
            if (node.data.unlock.after && node.data.unlock.after.length > 0) {
              if (!areUnlockAfterCompleted(node, stateLookup)) locked = true;
            }
            if (node.data.unlock.date) {
              if (!isUnlockDatePassed(node)) locked = true;
            }
            if (node.data.unlock.password) {
              if (!isUnlockedByPassword(node, password)) locked = true;
            }
          }
          //
          // Calculate topic node status
          if (node.type === "topic") {
            state = getTopicNodeStatus(node, stateLookup);
          }

          return {
            ...node,
            draggable: false,
            data: {
              ...node.data,
              state: locked ? undefined : state,
              password: locked ? false : password,
              locked,
              isOptional: allOptionalIds.includes(node.id),
            },
          };
        });
      })(nodesArr);
      const rawEdges = edgesArr.length > 0
        ? edgesArr
        : generateEdgesFromCompletionNeeds(rawNodes, edgeConfig);

      setEdges(rawEdges);

      const needsLayout = rawNodes.some((n: Node) => !n.position);
      if (needsLayout) {
        const autoNodes = await getAutoLayoutedNodesElk(rawNodes, rawEdges);
        setNodes(autoNodes);
      } else {
        setNodes(rawNodes);
      }

      setViewport({ x, y, zoom });
    }
    layoutNodes();
    // eslint-disable-next-line
  }, [roadmapData, nodeState, x, y, zoom, unlockedPasswords, setViewport]);

  // Debug mode keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.code === "Space") {
        setShowDebugNode((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Event handlers
  const onNodeClick = useCallback((_: any, node: Node) => {
    if (node.type === "debug" || node.type === "background") return;
    setSelectedNode(node);
    setDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setSelectedNode(null);
  }, []);

  const passwordNodeUnlock = useCallback(() => {
    if (!selectedNode) return;

    setNodes(nds => {
      const newNds = nds.map(n => {
        if (n.id == selectedNode.id) {
          return {
            ...n,
            data: {
              ...n.data,
              locked: false,
              password: true
            }
          }
        }

        return n;
      })
      return updateNodes(newNds);
    })

  }, [selectedNode, parsedRoadmap])

  const toggleNodeComplete = useCallback(() => {
    if (!selectedNode || selectedNode.data.locked) return;

    // Prevent completion if needs are not met
    const nodesArr = nodes;
    if (!areCompletionNeedsMet(selectedNode, nodesArr)) return;

    setNodes((nds) => {
      const newNds = nds.map((n) => {
        if (n.id === selectedNode.id) {
          let newState: string;
          if (!n.data.state) {
            newState = "started";
          } else if (n.data.state === "started") {
            newState = "completed";
          } else if (n.data.state === "completed") {
            newState = undefined;
          }

          const updatedNode = {
            ...n,
            data: { ...n.data, state: newState },
          };

          setSelectedNode(updatedNode);

          return updatedNode;
        }
        return n;
      });

      return updateNodes(newNds);
    });
  }, [selectedNode, parsedRoadmap]);

  // Prepare nodes for display
  const backgroundNode = createBackgroundNode();
  const debugNode = createDebugNode(nodes);
  const displayNodes = [
    ...(backgroundNode ? [backgroundNode] : []),
    ...nodes,
    ...(debugNode ? [debugNode] : []),
  ];

  // Calculate progress
  // Progress calculation (ignore optional nodes)
  const nonOptionalNodes = nodes.filter(n => {
    // Exclude nodes that are only referenced as optional in any topic
    const allOptionalIds = getAllOptionalNodeIds(nodes);
    return !allOptionalIds.includes(n.id);
  });

  const completedCount = nonOptionalNodes.filter(n => n.data?.state === "completed" || n.data?.state === "fully-completed").length;
  const totalNodes = nonOptionalNodes.length;
  const progress = totalNodes > 0 ? Math.round((completedCount / totalNodes) * 100) : 0;

  // Star counter
  const fullyCompleteCount = nodes.filter(n => n.type === "topic" && n.data?.state === "fully-completed").length;
  const totalOptionalCount = getAllOptionalNodeIds(nodes).length;

  // Node types
  const nodeTypes = {
    topic: (props) => <LearningNode {...props} type="topic" language={language} />,
    task: (props) => <LearningNode {...props} type="task" language={language} />,
    background: BackgroundNode,
    debug: DebugNode,
  };

  return (
    <div className="hyperbook-learningmap-container">
      {/* Header */}
      <div className="learningmap-header">
        <div className="progress-section">
          <div className="progress-header">
            <span className="progress-label">{t.progress}</span>
            <span className="progress-value">{progress}%</span>
            <span className="star-counter" style={{ marginLeft: "1em", display: "flex", alignItems: "center", gap: "4px" }}>
              <Star style={{ color: "#f59e42", width: 18, height: 18 }} />
              {fullyCompleteCount} / {totalOptionalCount}
            </span>
          </div>
          <div className="progress-bar-container">
            <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="progress-text">
            {t.topicsCompleted
              .replace("{completed}", completedCount)
              .replace("{total}", totalNodes)}
          </div>
        </div>
      </div>

      {/* Roadmap */}
      <div
        className="learningmap-roadmap"
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          backgroundColor: parsedRoadmap?.background?.color || "#ffffff",
        }}
      >
        <ReactFlow
          nodes={displayNodes}
          edges={edges}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          proOptions={{ hideAttribution: true }}
          className="roadmap-flow"
          defaultEdgeOptions={defaultEdgeOptions}
          nodesDraggable={false}
          nodesConnectable={false}
          colorMode={colorMode}
        >
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>

      {/* Legend */}
      <div className="learningmap-footer">
        <div className="legend-panel">
          <div className="legend-item">
            <Circle className="legend-icon legend-icon-available" />
            <span>{t.available}</span>
          </div>
          <div className="legend-item">
            <Circle className="legend-icon legend-icon-inprogress" style={{ color: "#f59e42" }} />
            <span>{t.inProgressLegend}</span>
          </div>
          <div className="legend-item">
            <CheckCircle2 className="legend-icon legend-icon-completed" color="#16a34a" />
            <span>{t.completed}</span>
          </div>
          <div className="legend-item">
            <Circle className="legend-icon legend-icon-locked" />
            <span>{t.locked}</span>
          </div>
        </div>
      </div>

      {/* Drawers */}
      <NodeDrawer
        node={selectedNode}
        setNode={setSelectedNode}
        isOpen={drawerOpen}
        onClose={closeDrawer}
        onPasswordUnlock={passwordNodeUnlock}
        onToggleComplete={toggleNodeComplete}
        language={language}
      />
    </div>
  );
}

export function HyperbookLearningmap({ roadmapData, nodeState, language, x, y, zoom }) {
  return (
    <ReactFlowProvider>
      <HyperbookLearningmapInner
        language={language}
        roadmapData={roadmapData}
        nodeState={nodeState}
        x={x}
        y={y}
        zoom={zoom}
      />
    </ReactFlowProvider>
  );
}
