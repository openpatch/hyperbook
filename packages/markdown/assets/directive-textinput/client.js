hyperbook.textinput = (function () {
  const init = (root) => {
    let allTextInputs = root.querySelectorAll(".directive-textinput textarea[data-id]");
    
    allTextInputs.forEach((textarea) => {
      const id = textarea.getAttribute("data-id");
      
      // Load saved text from store
      store.textinput.get(id).then((result) => {
        if (result && result.text) {
          textarea.value = result.text;
        }
      });
      
      // Save text to store on input
      textarea.addEventListener("input", () => {
        store.textinput.put({
          id: id,
          text: textarea.value,
        });
      });
    });
  };

  init(document.body);

  // Observe for new textinputs added to the DOM
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1) {
          // Element node
          init(node);
        }
      });
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });

  return {
    init,
  };
})();
