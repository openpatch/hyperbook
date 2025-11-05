hyperbook.textinput = (function () {
  // Debounce helper to reduce database writes
  const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  };

  const init = (root) => {
    let allTextInputs = root.querySelectorAll(".directive-textinput textarea[data-id]");
    
    allTextInputs.forEach((textarea) => {
      const id = textarea.getAttribute("data-id");
      
      // Load saved text from store
      store.textinput.get(id).then((result) => {
        if (result && result.text) {
          textarea.value = result.text;
        }
      }).catch((error) => {
        console.error("Failed to load textinput from store:", error);
      });
      
      // Save text to store on input with debouncing
      const saveToStore = debounce(() => {
        store.textinput.put({
          id: id,
          text: textarea.value,
        }).catch((error) => {
          console.error("Failed to save textinput to store:", error);
        });
      }, 500);
      
      textarea.addEventListener("input", saveToStore);
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
