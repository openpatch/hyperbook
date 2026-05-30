import { PYTAMARO_URI_BEGIN, PYTAMARO_URI_END } from "./constants.js";
import { pytamaroStdoutCarry, pytamaroCanvasTargets } from "./state.js";

export const getOutput = (id) => {
  return document.getElementById(id)?.getElementsByClassName("output")[0];
};

export const getCanvas = (id) => {
  return document.getElementById(id)?.getElementsByClassName("canvas")[0];
};

export const setPytamaroCanvasTarget = (id, enabled) => {
  if (enabled) {
    pytamaroCanvasTargets.add(id);
  } else {
    pytamaroCanvasTargets.delete(id);
  }
};

export const renderPytamaroDataUri = (id, container, dataUri) => {
  if (id && pytamaroCanvasTargets.has(id)) {
    const canvas = getCanvas(id);
    const context = canvas?.getContext?.("2d");
    if (canvas && context) {
      const img = new Image();
      img.onload = () => {
        const width = Math.max(1, img.naturalWidth || img.width);
        const height = Math.max(1, img.naturalHeight || img.height);
        canvas.width = width;
        canvas.height = height;
        context.clearRect(0, 0, width, height);
        context.drawImage(img, 0, 0, width, height);
      };
      img.onerror = () => {
        appendOutputErrorLine(id, "Failed to render pytamaro graphic.");
      };
      img.src = dataUri;
      return;
    }
  }

  const img = document.createElement("img");
  img.src = dataUri;
  img.style.maxWidth = "100%";
  img.style.display = "block";
  container.appendChild(img);
};

/**
 * Renders a message that may contain pytamaro data URI image markers into
 * the given container, creating <img> elements for each embedded image.
 */
export const renderOutputSegments = (container, message, id = null) => {
  let remaining = String(message);
  while (remaining.length > 0) {
    const beginIdx = remaining.indexOf(PYTAMARO_URI_BEGIN);
    if (beginIdx === -1) {
      container.appendChild(document.createTextNode(remaining));
      break;
    }
    if (beginIdx > 0) {
      container.appendChild(document.createTextNode(remaining.slice(0, beginIdx)));
    }
    const afterBegin = remaining.slice(beginIdx + PYTAMARO_URI_BEGIN.length);
    const endIdx = afterBegin.indexOf(PYTAMARO_URI_END);
    if (endIdx === -1) {
      container.appendChild(document.createTextNode(remaining.slice(beginIdx)));
      break;
    }
    const dataUri = afterBegin.slice(0, endIdx);
    renderPytamaroDataUri(id, container, dataUri);
    remaining = afterBegin.slice(endIdx + PYTAMARO_URI_END.length);
  }
};

export const getTrailingPrefixLength = (text, marker) => {
  const max = Math.min(text.length, marker.length - 1);
  for (let len = max; len > 0; len -= 1) {
    if (text.endsWith(marker.slice(0, len))) {
      return len;
    }
  }
  return 0;
};

export const appendText = (output, text) => {
  if (!text) return;
  output.appendChild(document.createTextNode(text));
};

export const appendOutputLine = (id, message) => {
  const output = getOutput(id);
  if (!output) return;
  const msg = String(message ?? "");
  const carry = pytamaroStdoutCarry.get(id) || "";
  let combined = carry + msg;
  pytamaroStdoutCarry.delete(id);

  // Fast path for regular stdout chunks.
  if (!combined.includes(PYTAMARO_URI_BEGIN) && carry.length === 0) {
    const partialBeginLength = getTrailingPrefixLength(combined, PYTAMARO_URI_BEGIN);
    if (partialBeginLength > 0) {
      const visible = combined.slice(0, combined.length - partialBeginLength);
      appendText(output, visible);
      pytamaroStdoutCarry.set(id, combined.slice(combined.length - partialBeginLength));
    } else {
      appendText(output, combined);
    }
    return;
  }

  while (combined.length > 0) {
    const beginIdx = combined.indexOf(PYTAMARO_URI_BEGIN);
    if (beginIdx === -1) {
      const partialBeginLength = getTrailingPrefixLength(combined, PYTAMARO_URI_BEGIN);
      const visible = combined.slice(0, combined.length - partialBeginLength);
      appendText(output, visible);
      if (partialBeginLength > 0) {
        pytamaroStdoutCarry.set(id, combined.slice(combined.length - partialBeginLength));
      }
      break;
    }

    appendText(output, combined.slice(0, beginIdx));
    const afterBegin = combined.slice(beginIdx + PYTAMARO_URI_BEGIN.length);
    const endIdx = afterBegin.indexOf(PYTAMARO_URI_END);
    if (endIdx === -1) {
      // Keep incomplete marker and continue when the next stdout chunk arrives.
      pytamaroStdoutCarry.set(id, combined.slice(beginIdx));
      break;
    }

    const dataUri = afterBegin.slice(0, endIdx);
    renderPytamaroDataUri(id, output, dataUri);
    combined = afterBegin.slice(endIdx + PYTAMARO_URI_END.length);
  }
};

export const appendOutputErrorLine = (id, message) => {
  const output = getOutput(id);
  if (!output) return;
  const line = document.createElement("span");
  line.classList.add("error-line");
  line.textContent = String(message);
  output.appendChild(line);
};

// ─── Python Friendly Error Messages ────────────────────────────────────────
// Loaded from python-friendly-error-messages.js (built from npm package)

if (window.PythonFriendlyErrorMessages) {
  const { loadCopydeckFor, registerAdapter, pyodideAdapter } = window.PythonFriendlyErrorMessages;
  loadCopydeckFor("en");
  registerAdapter("pyodide", pyodideAdapter);
}

export const appendFriendlyError = (output, errorString, code) => {
  if (!output) return;
  let result = null;
  if (window.PythonFriendlyErrorMessages) {
    try {
      result = window.PythonFriendlyErrorMessages.friendlyExplain({
        error: String(errorString),
        code,
        runtime: "pyodide",
      });
    } catch {}
  }
  if (result?.html) {
    const div = document.createElement("div");
    div.classList.add("pfem");
    div.innerHTML = result.html;
    output.appendChild(div);
  } else {
    const span = document.createElement("span");
    span.classList.add("error-line");
    span.textContent = String(errorString);
    output.appendChild(span);
  }
};

// ───────────────────────────────────────────────────────────────────────────

export const appendOutput = (output, message, isError = false, id = null) => {
  if (!output || message === undefined || message === null) return;
  if (isError) {
    const line = document.createElement("span");
    line.classList.add("error-line");
    line.textContent = String(message);
    output.appendChild(line);
    return;
  }
  const msg = String(message);
  if (msg.includes(PYTAMARO_URI_BEGIN)) {
    renderOutputSegments(output, msg, id);
    return;
  }
  output.appendChild(document.createTextNode(msg));
};

export const clearPytamaroStdoutCarry = (id) => {
  pytamaroStdoutCarry.delete(id);
  pytamaroCanvasTargets.delete(id);
};
