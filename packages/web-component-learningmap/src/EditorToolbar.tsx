import React from "react";
import { Menu, MenuButton, MenuItem, SubMenu } from "@szhsin/react-menu";
import "@szhsin/react-menu/dist/index.css";
import '@szhsin/react-menu/dist/transitions/zoom.css';
import { Save, Plus, Bug, Settings, Eye, Menu as MenuI, FolderOpen, Download, ImageDown } from "lucide-react";

interface EditorToolbarProps {
  saved: boolean;
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
  onOpenSettingsDrawer: () => void;
  onSave: () => void;
  onDownlad: () => void;
  onOpen: () => void;
  onExportSVG: () => void;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  saved,
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
  onOpenSettingsDrawer,
  onSave,
  onDownlad,
  onOpen,
  onExportSVG
}) => (
  <div className="editor-toolbar">
    <div className="toolbar-group">
      <Menu menuButton={<MenuButton disabled={previewMode} className="toolbar-button"><Plus size={16} /> <span className="toolbar-label">Nodes</span></MenuButton>}>
        <MenuItem onClick={() => onAddNewNode("task")}>Add Task</MenuItem>
        <MenuItem onClick={() => onAddNewNode("topic")}>Add Topic</MenuItem>
        <MenuItem onClick={() => onAddNewNode("image")}>Add Image</MenuItem>
        <MenuItem onClick={() => onAddNewNode("text")}>Add Text</MenuItem>
      </Menu>
      <button disabled={previewMode} onClick={onOpenSettingsDrawer} className="toolbar-button">
        <Settings size={16} /> <span className="toolbar-label">Settings</span>
      </button>
    </div>
    <div className="toolbar-group">
      <Menu menuButton={<MenuButton className="toolbar-button"><MenuI /></MenuButton>}>
        <SubMenu className={`${debugMode ? "active" : ""}`} label={<><Bug size={16} /> <span>Debug</span></>}>
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
        </SubMenu>
        <MenuItem onClick={onTogglePreviewMode} className={`${previewMode ? "active" : ""}`}>
          <Eye size={16} /> <span>Preview</span>
        </MenuItem>
        <MenuItem onClick={onSave} className={!saved ? "active" : ""} disabled={saved}>
          <Save size={16} /> <span>Save{!saved ? "*" : ""}</span>
        </MenuItem>
        <MenuItem onClick={onDownlad}>
          <Download size={16} /> <span>Download</span>
        </MenuItem>
        <MenuItem onClick={onOpen}>
          <FolderOpen size={16} /> <span>Open</span>
        </MenuItem>
        {false && <MenuItem onClick={onExportSVG}>
          <ImageDown size={16} /> <span>Export as SVG</span>
        </MenuItem>}
      </Menu>
    </div>
  </div>
);
