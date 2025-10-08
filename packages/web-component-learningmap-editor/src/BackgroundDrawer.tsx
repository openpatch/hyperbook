import React, { useState, useEffect } from "react";
import { X, Save } from "lucide-react";
import { BackgroundConfig } from "./types";
import { ColorSelector } from "./ColorSelector";

interface BackgroundDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  background: BackgroundConfig;
  onUpdate: (bg: BackgroundConfig) => void;
}

export const BackgroundDrawer: React.FC<BackgroundDrawerProps> = ({
  isOpen,
  onClose,
  background,
  onUpdate,
}) => {
  const [localBg, setLocalBg] = useState<BackgroundConfig>(background);

  useEffect(() => {
    setLocalBg(background);
  }, [background]);

  if (!isOpen) return null;

  const handleSave = () => {
    onUpdate(localBg);
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
            <ColorSelector
              label="Background Color"
              value={localBg?.color || "#ffffff"}
              onChange={color => setLocalBg({ ...localBg, color })}
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
