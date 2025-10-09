import React, { useState, useEffect } from "react";
import { X, Save } from "lucide-react";
import { Settings } from "./types";
import { ColorSelector } from "./ColorSelector";

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  settings: Settings;
  onUpdate: (s: Settings) => void;
}

export const SettingsDrawer: React.FC<SettingsDrawerProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdate,
}) => {
  const [localSettings, setLocalSettings] = useState<Settings>(settings);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  if (!isOpen) return null;

  const handleSave = () => {
    onUpdate(localSettings);
    onClose();
  };

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer">
        <div className="drawer-header">
          <h2 className="drawer-title">Background Settings</h2>
          <button onClick={onClose} className="close-button">
            <X size={20} />
          </button>
        </div>

        <div className="drawer-content">
          <div className="form-group">
            <label>Label *</label>
            <input
              type="text"
              value={localSettings?.title || ""}
              onChange={(e) => setLocalSettings(settings => ({ ...settings, title: e.target.value }))}
              placeholder="Node label"
            />
          </div>
          <div className="form-group">
            <ColorSelector
              label="Background Color"
              value={localSettings?.background?.color || "#ffffff"}
              onChange={color => setLocalSettings(settings => ({ ...settings, background: { ...settings.background, color } }))}
            />
          </div>
        </div>

        <div className="drawer-footer">
          <button onClick={handleSave} className="primary-button">
            <Save size={16} /> Save Changes
          </button>
        </div>
      </div>
    </>
  );
};
