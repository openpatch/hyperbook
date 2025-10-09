// Translations for the learningmap editor component

export interface Translations {
  // Toolbar
  nodes: string;
  addTask: string;
  addTopic: string;
  addImage: string;
  addText: string;
  settings: string;
  debug: string;
  enableDebugMode: string;
  showCompletionNeedsEdges: string;
  showCompletionOptionalEdges: string;
  showUnlockAfterEdges: string;
  preview: string;
  save: string;
  download: string;
  open: string;
  exportAsSVG: string;
  
  // Control buttons
  undo: string;
  redo: string;
  reset: string;
  help: string;
  unsavedChanges: string;
  
  // Keyboard shortcuts
  keyboardShortcuts: string;
  action: string;
  shortcut: string;
  close: string;
  shortcuts: {
    save: string;
    undo: string;
    redo: string;
    addTaskNode: string;
    addTopicNode: string;
    addImageNode: string;
    addTextNode: string;
    deleteNodeEdge: string;
    togglePreviewMode: string;
    toggleDebugMode: string;
    selectMultipleNodes: string;
    showHelp: string;
  };
  
  // Drawer titles
  editTask: string;
  editTopic: string;
  editImage: string;
  editText: string;
  backgroundSettings: string;
  editEdge: string;
  
  // Form labels
  nodeColor: string;
  label: string;
  labelRequired: string;
  summary: string;
  description: string;
  duration: string;
  videoURL: string;
  resources: string;
  addResource: string;
  unlockPassword: string;
  unlockDate: string;
  unlockAfter: string;
  completionNeeds: string;
  completionOptional: string;
  backgroundColor: string;
  text: string;
  fontSize: string;
  color: string;
  image: string;
  width: string;
  height: string;
  rotation: string;
  opacity: string;
  edgeColor: string;
  edgeWidth: string;
  edgeType: string;
  animated: string;
  
  // Placeholders
  placeholderNodeLabel: string;
  placeholderShortSummary: string;
  placeholderDetailedDescription: string;
  placeholderVideoURL: string;
  placeholderLabel: string;
  placeholderURL: string;
  placeholderOptionalPassword: string;
  placeholderBackgroundText: string;
  selectNode: string;
  
  // Buttons
  deleteNode: string;
  saveChanges: string;
  deleteEdge: string;
  
  // Messages
  openFileWarning: string;
  failedToLoadFile: string;
  failedToExportSVG: string;
  
  // Color options
  blue: string;
  yellow: string;
  lila: string;
  pink: string;
  teal: string;
  red: string;
  black: string;
  white: string;
  
  // Node defaults
  newTask: string;
  newTopic: string;
  backgroundTextDefault: string;
  noText: string;
  untitled: string;
  
  // Multi-node panel
  alignLeftHorizontal: string;
  alignCenterHorizontal: string;
  alignRightHorizontal: string;
  alignTopVertical: string;
  alignCenterVertical: string;
  alignBottomVertical: string;
  distributeHorizontally: string;
  distributeVertically: string;
  
  // Edge types
  default: string;
  straight: string;
  step: string;
  smoothstep: string;
  floating: string;
  
  // Viewer component (LearningMap)
  resourcesLabel: string;
  unlockConditionsMessage: string;
  completionNeedsMessage: string;
  locked: string;
  markAsStarted: string;
  markAsCompleted: string;
  completedLabel: string;
  mastered: string;
  completedTitle: string;
  masteredTitle: string;
  
  // Language settings
  languageLabel: string;
  languageEnglish: string;
  languageGerman: string;
}

const en: Translations = {
  // Toolbar
  nodes: "Nodes",
  addTask: "Add Task",
  addTopic: "Add Topic",
  addImage: "Add Image",
  addText: "Add Text",
  settings: "Settings",
  debug: "Debug",
  enableDebugMode: "Enable Debug Mode",
  showCompletionNeedsEdges: "Show Completion Needs Edges",
  showCompletionOptionalEdges: "Show Completion Optional Edges",
  showUnlockAfterEdges: "Show Unlock After Edges",
  preview: "Preview",
  save: "Save",
  download: "Download",
  open: "Open",
  exportAsSVG: "Export as SVG",
  
  // Control buttons
  undo: "Undo",
  redo: "Redo",
  reset: "Reset",
  help: "Help",
  unsavedChanges: "Unsaved Changes (Click to save or press Ctrl+S)",
  
  // Keyboard shortcuts
  keyboardShortcuts: "Keyboard Shortcuts",
  action: "Action",
  shortcut: "Shortcut",
  close: "Close",
  shortcuts: {
    save: "Save",
    undo: "Undo",
    redo: "Redo",
    addTaskNode: "Add Task Node",
    addTopicNode: "Add Topic Node",
    addImageNode: "Add Image Node",
    addTextNode: "Add Text Node",
    deleteNodeEdge: "Delete Node/Edge",
    togglePreviewMode: "Toggle Preview Mode",
    toggleDebugMode: "Toggle Debug Mode",
    selectMultipleNodes: "Select Multiple Nodes",
    showHelp: "Show Help",
  },
  
  // Drawer titles
  editTask: "Edit Task",
  editTopic: "Edit Topic",
  editImage: "Edit Image",
  editText: "Edit Text",
  backgroundSettings: "Background Settings",
  editEdge: "Edit Edge",
  
  // Form labels
  nodeColor: "Node Color",
  label: "Label",
  labelRequired: "Label *",
  summary: "Summary",
  description: "Description",
  duration: "Duration",
  videoURL: "Video URL",
  resources: "Resources",
  addResource: "Add Resource",
  unlockPassword: "Unlock Password",
  unlockDate: "Unlock Date",
  unlockAfter: "Unlock After",
  completionNeeds: "Completion Needs",
  completionOptional: "Completion Optional",
  backgroundColor: "Background Color",
  text: "Text",
  fontSize: "Font Size",
  color: "Color",
  image: "Image",
  width: "Width",
  height: "Height",
  rotation: "Rotation",
  opacity: "Opacity",
  edgeColor: "Color",
  edgeWidth: "Width",
  edgeType: "Type",
  animated: "Animated",
  
  // Placeholders
  placeholderNodeLabel: "Node label",
  placeholderShortSummary: "Short summary",
  placeholderDetailedDescription: "Detailed description",
  placeholderVideoURL: "YouTube or video URL",
  placeholderLabel: "Label",
  placeholderURL: "URL",
  placeholderOptionalPassword: "Optional password",
  placeholderBackgroundText: "Background Text",
  selectNode: "Select node...",
  
  // Buttons
  deleteNode: "Delete Node",
  saveChanges: "Save Changes",
  deleteEdge: "Delete Edge",
  
  // Messages
  openFileWarning: "Opening a file will replace your current map. Continue?",
  failedToLoadFile: "Failed to load the file. Please make sure it is a valid roadmap JSON file.",
  failedToExportSVG: "Failed to export SVG: ",
  
  // Color options
  blue: "Blue",
  yellow: "Yellow",
  lila: "Lila",
  pink: "Pink",
  teal: "Teal",
  red: "Red",
  black: "Black",
  white: "White",
  
  // Node defaults
  newTask: "New task",
  newTopic: "New topic",
  backgroundTextDefault: "Background Text",
  noText: "No Text",
  untitled: "Untitled",
  
  // Multi-node panel
  alignLeftHorizontal: "Align Left Horizontal",
  alignCenterHorizontal: "Align Center Horizontal",
  alignRightHorizontal: "Align Right Horizontal",
  alignTopVertical: "Align Top Vertical",
  alignCenterVertical: "Align Center Vertical",
  alignBottomVertical: "Align Bottom Vertical",
  distributeHorizontally: "Distribute Horizontally",
  distributeVertically: "Distribute Vertically",
  
  // Edge types
  default: "Default",
  straight: "Straight",
  step: "Step",
  smoothstep: "Smooth Step",
  floating: "Floating",
  
  // Viewer component (LearningMap)
  resourcesLabel: "Resources:",
  unlockConditionsMessage: "Complete the following nodes first to unlock this one:",
  completionNeedsMessage: "The following nodes need to be completed or mastered before this one is completed:",
  locked: "Locked",
  markAsStarted: "Mark as Started",
  markAsCompleted: "Mark as Completed",
  completedLabel: "Completed",
  mastered: "Mastered",
  completedTitle: "Completed",
  masteredTitle: "Mastered",
  
  // Language settings
  languageLabel: "Language",
  languageEnglish: "English",
  languageGerman: "German",
};

const de: Translations = {
  // Toolbar
  nodes: "Knoten",
  addTask: "Aufgabe hinzufügen",
  addTopic: "Thema hinzufügen",
  addImage: "Bild hinzufügen",
  addText: "Text hinzufügen",
  settings: "Einstellungen",
  debug: "Debug",
  enableDebugMode: "Debug-Modus aktivieren",
  showCompletionNeedsEdges: "Abschluss-Benötigte Kanten anzeigen",
  showCompletionOptionalEdges: "Abschluss-Optionale Kanten anzeigen",
  showUnlockAfterEdges: "Entsperr-Nach Kanten anzeigen",
  preview: "Vorschau",
  save: "Speichern",
  download: "Herunterladen",
  open: "Öffnen",
  exportAsSVG: "Als SVG exportieren",
  
  // Control buttons
  undo: "Rückgängig",
  redo: "Wiederholen",
  reset: "Zurücksetzen",
  help: "Hilfe",
  unsavedChanges: "Ungespeicherte Änderungen (Klicken zum Speichern oder Strg+S drücken)",
  
  // Keyboard shortcuts
  keyboardShortcuts: "Tastaturkürzel",
  action: "Aktion",
  shortcut: "Tastenkombination",
  close: "Schließen",
  shortcuts: {
    save: "Speichern",
    undo: "Rückgängig",
    redo: "Wiederholen",
    addTaskNode: "Aufgaben-Knoten hinzufügen",
    addTopicNode: "Themen-Knoten hinzufügen",
    addImageNode: "Bild-Knoten hinzufügen",
    addTextNode: "Text-Knoten hinzufügen",
    deleteNodeEdge: "Knoten/Kante löschen",
    togglePreviewMode: "Vorschau-Modus umschalten",
    toggleDebugMode: "Debug-Modus umschalten",
    selectMultipleNodes: "Mehrere Knoten auswählen",
    showHelp: "Hilfe anzeigen",
  },
  
  // Drawer titles
  editTask: "Aufgabe bearbeiten",
  editTopic: "Thema bearbeiten",
  editImage: "Bild bearbeiten",
  editText: "Text bearbeiten",
  backgroundSettings: "Hintergrund-Einstellungen",
  editEdge: "Kante bearbeiten",
  
  // Form labels
  nodeColor: "Knotenfarbe",
  label: "Bezeichnung",
  labelRequired: "Bezeichnung *",
  summary: "Zusammenfassung",
  description: "Beschreibung",
  duration: "Dauer",
  videoURL: "Video-URL",
  resources: "Ressourcen",
  addResource: "Ressource hinzufügen",
  unlockPassword: "Entsperr-Passwort",
  unlockDate: "Entsperr-Datum",
  unlockAfter: "Entsperren nach",
  completionNeeds: "Abschluss benötigt",
  completionOptional: "Abschluss optional",
  backgroundColor: "Hintergrundfarbe",
  text: "Text",
  fontSize: "Schriftgröße",
  color: "Farbe",
  image: "Bild",
  width: "Breite",
  height: "Höhe",
  rotation: "Drehung",
  opacity: "Deckkraft",
  edgeColor: "Farbe",
  edgeWidth: "Breite",
  edgeType: "Typ",
  animated: "Animiert",
  
  // Placeholders
  placeholderNodeLabel: "Knotenbezeichnung",
  placeholderShortSummary: "Kurze Zusammenfassung",
  placeholderDetailedDescription: "Detaillierte Beschreibung",
  placeholderVideoURL: "YouTube oder Video-URL",
  placeholderLabel: "Bezeichnung",
  placeholderURL: "URL",
  placeholderOptionalPassword: "Optionales Passwort",
  placeholderBackgroundText: "Hintergrundtext",
  selectNode: "Knoten auswählen...",
  
  // Buttons
  deleteNode: "Knoten löschen",
  saveChanges: "Änderungen speichern",
  deleteEdge: "Kante löschen",
  
  // Messages
  openFileWarning: "Das Öffnen einer Datei ersetzt Ihre aktuelle Karte. Fortfahren?",
  failedToLoadFile: "Datei konnte nicht geladen werden. Bitte stellen Sie sicher, dass es sich um eine gültige Roadmap-JSON-Datei handelt.",
  failedToExportSVG: "SVG-Export fehlgeschlagen: ",
  
  // Color options
  blue: "Blau",
  yellow: "Gelb",
  lila: "Lila",
  pink: "Rosa",
  teal: "Türkis",
  red: "Rot",
  black: "Schwarz",
  white: "Weiß",
  
  // Node defaults
  newTask: "Neue Aufgabe",
  newTopic: "Neues Thema",
  backgroundTextDefault: "Hintergrundtext",
  noText: "Kein Text",
  untitled: "Ohne Titel",
  
  // Multi-node panel
  alignLeftHorizontal: "Horizontal links ausrichten",
  alignCenterHorizontal: "Horizontal zentrieren",
  alignRightHorizontal: "Horizontal rechts ausrichten",
  alignTopVertical: "Vertikal oben ausrichten",
  alignCenterVertical: "Vertikal zentrieren",
  alignBottomVertical: "Vertikal unten ausrichten",
  distributeHorizontally: "Horizontal verteilen",
  distributeVertically: "Vertikal verteilen",
  
  // Edge types
  default: "Standard",
  straight: "Gerade",
  step: "Stufe",
  smoothstep: "Weiche Stufe",
  floating: "Schwebend",
  
  // Viewer component (LearningMap)
  resourcesLabel: "Ressourcen:",
  unlockConditionsMessage: "Vervollständige zuerst die folgenden Knoten, um diesen freizuschalten:",
  completionNeedsMessage: "Die folgenden Knoten müssen abgeschlossen oder gemeistert werden, bevor dieser abgeschlossen ist:",
  locked: "Gesperrt",
  markAsStarted: "Als begonnen markieren",
  markAsCompleted: "Als abgeschlossen markieren",
  completedLabel: "Abgeschlossen",
  mastered: "Gemeistert",
  completedTitle: "Abgeschlossen",
  masteredTitle: "Gemeistert",
  
  // Language settings
  languageLabel: "Sprache",
  languageEnglish: "Englisch",
  languageGerman: "Deutsch",
};

export const translations: Record<string, Translations> = {
  en,
  de,
};

export function getTranslations(language: string = "en"): Translations {
  return translations[language] || translations.en;
}
