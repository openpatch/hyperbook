import React from "react";
import { Menu, MenuButton, MenuItem } from "@szhsin/react-menu";
import "@szhsin/react-menu/dist/index.css";
import '@szhsin/react-menu/dist/transitions/zoom.css';
import { Save, Plus, Bug, Settings, Eye } from "lucide-react";

interface EditorToolbarProps {
  debugMode: boolean;
  previewMode: boolean;
  showCompletionNeeds: boolean;
  showCompletionOptional: boolean;
  showUnlockAfter: boolean;
  onToggleDebugMode: () => void;
  onTogglePreviewMode: () => void;
  onSetShowCompletionNeeds: (checked: boolean) => void;
  onSetShowCompletionOptional: (checked: boolean) => void;
  onSetShowUnlockAfter: (checked: boolean) => void;
  onAddNewNode: (type: "task" | "topic" | "image" | "text") => void;
  onOpenBackgroundDrawer: () => void;
  onSave: () => void;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  debugMode,
  previewMode,
  showCompletionNeeds,
  showCompletionOptional,
  showUnlockAfter,
  onTogglePreviewMode,
  onToggleDebugMode,
  onSetShowCompletionNeeds,
  onSetShowCompletionOptional,
  onSetShowUnlockAfter,
  onAddNewNode,
  onOpenBackgroundDrawer,
  onSave,
}) => (
  <div className="editor-toolbar">
    <div className="toolbar-group">
      <Menu menuButton={<MenuButton disabled={previewMode} className="toolbar-button"><Plus size={16} /> <span className="toolbar-label">Nodes</span></MenuButton>}>
        <MenuItem onClick={() => onAddNewNode("task")}>Add Task</MenuItem>
        <MenuItem onClick={() => onAddNewNode("topic")}>Add Topic</MenuItem>
        <MenuItem onClick={() => onAddNewNode("image")}>Add Image</MenuItem>
        <MenuItem onClick={() => onAddNewNode("text")}>Add Text</MenuItem>
      </Menu>
      <button disabled={previewMode} onClick={onOpenBackgroundDrawer} className="toolbar-button">
        <Settings size={16} /> <span className="toolbar-label">Background</span>
      </button>
    </div>
    <div className="toolbar-group">
      <Menu menuButton={<MenuButton disabled={previewMode} className={`toolbar-button${debugMode ? " active" : ""}`} title="Debug"><Bug size={16} /> <span className="toolbar-label">Debug</span></MenuButton>}>
        <MenuItem type="checkbox" checked={debugMode} onClick={onToggleDebugMode}>
          Enable Debug Mode
        </MenuItem>
        <MenuItem type="checkbox" checked={showCompletionNeeds} onClick={e => onSetShowCompletionNeeds(e.checked ?? false)} disabled={!debugMode}>
          Show Completion Needs Edges
        </MenuItem>
        <MenuItem type="checkbox" checked={showCompletionOptional} onClick={e => onSetShowCompletionOptional(e.checked ?? false)} disabled={!debugMode}>
          Show Completion Optional Edges
        </MenuItem>
        <MenuItem type="checkbox" checked={showUnlockAfter} onClick={e => onSetShowUnlockAfter(e.checked ?? false)} disabled={!debugMode}>
          Show Unlock After Edges
        </MenuItem>
      </Menu>
      <button onClick={onTogglePreviewMode} className={`toolbar-button${previewMode ? " active" : ""}`}>
        <Eye size={16} /> <span className="toolbar-label">Preview</span>
      </button>
      <button onClick={onSave} className="toolbar-button primary">
        <Save size={16} /> <span className="toolbar-label">Save</span>
      </button>
    </div>
  </div>
);
