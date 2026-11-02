export const getOutput = (id) =>
  document.getElementById(id)?.getElementsByClassName("output")[0];

/** Appends printed text to the output panel; errors get their own line style. */
export const appendOutput = (output, text, isError = false) => {
  if (!output || !text) return;
  if (isError) {
    const span = document.createElement("span");
    span.className = "error-line";
    span.textContent = text;
    output.appendChild(span);
  } else {
    output.appendChild(document.createTextNode(text));
  }
  output.scrollTop = output.scrollHeight;
};

export const appendOutputLine = (id, text, isError = false) => {
  const output = getOutput(id);
  appendOutput(output, text.endsWith("\n") ? text : `${text}\n`, isError);
};

export const clearOutput = (output) => {
  if (output) output.innerHTML = "";
};
