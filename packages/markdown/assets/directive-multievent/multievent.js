var multievent = {
  $id: function (ID) {
    return document.getElementById(ID);
  },
  zZahl: function (von, bis, kommastellen) {
    kommastellen = typeof kommastellen == "undefined" ? 0 : kommastellen;
    if (von >= 1) {
      var vonX = von;
      var bisY = bis - von;
      var minus = 0;
    } else {
      var vonX = 1;
      var bisY = bis + Math.abs(von);
      var minus = Math.abs(von) + 1;
    }
    var Zahl =
      bis - von != 0
        ? (((Math.random() * Math.pow(10, 12)) % bisY) + vonX - minus).toFixed(
            kommastellen,
          )
        : von;
    return Zahl;
  },
  misch: function (Arr) {
    var MischObj = Arr;
    var tmp, rand;
    for (var i = 0; i < MischObj.length; i++) {
      zufall = Math.floor(Math.random() * MischObj.length);
      tmp = MischObj[zufall];
      MischObj.splice(zufall, 1);
      MischObj.push(tmp);
    }
    return MischObj;
  },
  orig: [],
  /**
   * Where MathLive and the Compute Engine load from. The build writes it to
   * the multievents that hold math fields (data-mathfield): the book's own
   * copy, a CDN or the host's. Without it, the book's local copy.
   */
  matheQuelle: function () {
    var lokal = (window.HYPERBOOK_ASSETS || "/") + "directive-mathfield/";
    var quelle = {
      mathlive: lokal + "mathlive.min.mjs",
      engine: lokal + "compute-engine/compute-engine.js",
    };
    var SK = document.querySelector(".multievent[data-mathfield]");
    if (SK) {
      try {
        var gesetzt = JSON.parse(SK.getAttribute("data-mathfield"));
        if (gesetzt.mathlive) quelle.mathlive = gesetzt.mathlive;
        if (gesetzt.engine) quelle.engine = gesetzt.engine;
      } catch (e) {}
    }
    return quelle;
  },
  /**
   * A field for mathematical answers ({m{…}}) is a <math-field> rendered by
   * MathLive, loaded once, when a multievent with math fields is built. The
   * fonts it draws with are the KaTeX fonts Hyperbook ships anyway; sounds
   * stay off.
   */
  ladeMathe: function () {
    if (!multievent._matheFeld) {
      multievent._matheFeld = import(multievent.matheQuelle().mathlive)
        .then(function (mathlive) {
          mathlive.MathfieldElement.fontsDirectory =
            window.HYPERBOOK_ASSETS + "math/fonts/";
          mathlive.MathfieldElement.soundsDirectory = null;
          // The decimal separator the reader's book uses, read from the page
          // language: a comma in a German book, so `1,5` is a number. It
          // also reads the point, so `1.5` stays one there.
          try {
            var teil = new Intl.NumberFormat(
              document.documentElement.lang || undefined,
            )
              .formatToParts(1.5)
              .find(function (t) {
                return t.type == "decimal";
              });
            if (teil && teil.value) {
              mathlive.MathfieldElement.decimalSeparator = teil.value;
            }
          } catch (e) {}
          return true;
        })
        .catch(function (e) {
          console.warn("MathLive could not be loaded:", e);
          return false;
        });
    }
    return multievent._matheFeld;
  },
  /**
   * The Compute Engine decides whether an answer is the same maths as the
   * solution. It is more than a megabyte, so it is loaded once, on the first
   * evaluation of a math field.
   */
  matheEngine: function () {
    if (!multievent._matheEngine) {
      multievent._matheEngine = import(multievent.matheQuelle().engine).then(function (modul) {
        var engine = new modul.ComputeEngine();
        // `{,}` a reader in a comma locale writes becomes a decimal; a typed
        // point is understood there too, and a comma stays a pair.
        engine.latexOptions = Object.assign({}, engine.latexOptions, {
          decimalSeparator: "{,}",
        });
        return engine;
      });
    }
    return multievent._matheEngine;
  },
  /**
   * Whether the answer is the same maths as one of the accepted solutions:
   * equal by the Compute Engine's rules — `2x+3` is `3+2x`, `\frac{1}{2}` is
   * `0.5` — or, where it cannot decide, the same value: `1.414…` counts for
   * `\sqrt{2}`.
   */
  matheRichtig: async function (ist, akzeptiert) {
    var engine;
    try {
      engine = await multievent.matheEngine();
    } catch (e) {
      return false;
    }
    for (var i = 0; i < akzeptiert.length; i++) {
      var soll = akzeptiert[i].replace(/^\s+/, "").replace(/\s+$/, "");
      if (soll == "") continue;
      try {
        var a = engine.parse(ist);
        var b = engine.parse(soll);
        if (!a.isValid || !b.isValid) continue;
        if (a.isEqual(b) === true) return true;
        var aWert = a.N().re;
        var bWert = b.N().re;
        if (
          typeof aWert == "number" &&
          typeof bWert == "number" &&
          isFinite(aWert) &&
          isFinite(bWert)
        ) {
          var masse = Math.max(Math.abs(aWert), Math.abs(bWert));
          if (Math.abs(aWert - bWert) <= 1e-9 * Math.max(1, masse)) {
            return true;
          }
        }
      } catch (e) {}
    }
    return false;
  },
  /**
   * The accepted answers of a math field, split on `|` — but not on one
   * inside braces, so `\frac{1}{2}|0.5` is two answers.
   */
  matheAlternativen: function (wert) {
    var teile = [];
    var tiefe = 0;
    var aktuell = "";
    wert = wert || "";
    for (var i = 0; i < wert.length; i++) {
      var z = wert[i];
      if (z == "\\") {
        aktuell += z + (wert[i + 1] || "");
        i++;
        continue;
      }
      if (z == "{") tiefe++;
      if (z == "}" && tiefe > 0) tiefe--;
      if (z == "|" && tiefe == 0) {
        teile.push(aktuell);
        aktuell = "";
        continue;
      }
      aktuell += z;
    }
    teile.push(aktuell);
    return teile
      .map(function (t) {
        return t.replace(/^\s+/, "").replace(/\s+$/, "");
      })
      .filter(function (t) {
        return t != "";
      });
  },
  /**
   * Judges the blanks of a fill-in-the-blank formula (`\placeholder{…}`):
   * each blank against its own accepted answers from data-luecken. MathLive
   * marks every blank right or wrong and locks the right ones. True when all
   * are right; null while MathLive has not arrived, so nothing is judged.
   */
  lueckenRichtig: async function (feld) {
    if (
      typeof feld.getPromptValue != "function" ||
      typeof feld.setPromptState != "function"
    ) {
      return null;
    }
    var luecken = {};
    try {
      luecken = JSON.parse(feld.getAttribute("data-luecken")) || {};
    } catch (e) {}
    var alleRichtig = true;
    for (var id in luecken) {
      // a blank without an answer is not asked for
      if (!luecken[id] || luecken[id].length == 0) continue;
      var ist = (feld.getPromptValue(id) || "")
        .replace(/^\s+/, "")
        .replace(/\s+$/, "");
      var richtig =
        ist != "" && (await multievent.matheRichtig(ist, luecken[id]));
      feld.setPromptState(id, richtig ? "correct" : "incorrect", richtig);
      if (!richtig) alleRichtig = false;
    }
    return alleRichtig;
  },
  /**
   * The key a multievent's state is saved under: its directive id (data-id),
   * like every other element, so a platform can tell whose task it is. Pages
   * built before the id existed have none and keep the old key.
   */
  storeKey: function (clNr) {
    var SK = document.getElementsByClassName("multievent")[clNr];
    var id = SK && SK.getAttribute("data-id");
    return id || multievent.legacyStoreKey(clNr);
  },
  /** The old key: the element's position on the page and the page's path. */
  legacyStoreKey: function (clNr) {
    return "multievent_" + clNr + "_" + window.location.pathname;
  },
  saveState: async function (clNr) {
    var SK = document.getElementsByClassName("multievent")[clNr];
    if (!SK) return;
    
    var state = {
      vNr: multievent.vNr[clNr],
      gesamtwertung: multievent.gesamtwertung[clNr],
      gewertet: multievent.gewertet[clNr],
      inputs: [],
      buttons: [],
      textareas: []
    };
    
    // Save input values and states
    var inputs = SK.getElementsByTagName("input");
    for (var i = 0; i < inputs.length; i++) {
      state.inputs.push({
        type: inputs[i].type,
        value: inputs[i].value,
        checked: inputs[i].checked,
        disabled: inputs[i].disabled,
        id: inputs[i].id,
        name: inputs[i].getAttribute("name"),
        dataAttributes: {
          markiert: inputs[i].getAttribute("data-markiert"),
          gemischt: inputs[i].getAttribute("data-gemischt"),
          BuchstSind: inputs[i].getAttribute("data-BuchstSind"),
          Nummer: inputs[i].getAttribute("data-Nummer"),
          BegriffeSind: inputs[i].getAttribute("data-BegriffeSind"),
          Fehler: inputs[i].getAttribute("data-Fehler")
        },
        style: {
          backgroundColor: inputs[i].style.backgroundColor,
          backgroundImage: inputs[i].style.backgroundImage,
          backgroundSize: inputs[i].style.backgroundSize,
          color: inputs[i].style.color
        },
        parentStyle: inputs[i].parentNode ? {
          backgroundColor: inputs[i].parentNode.style.backgroundColor,
          backgroundImage: inputs[i].parentNode.style.backgroundImage,
          backgroundSize: inputs[i].parentNode.style.backgroundSize
        } : null,
        siblingHTML: {
          prev: inputs[i].previousSibling ? inputs[i].previousSibling.innerHTML : null,
          next: inputs[i].nextSibling ? inputs[i].nextSibling.innerHTML : null
        }
      });
    }
    
    // Save button states
    var buttons = SK.getElementsByClassName("butAnAus");
    for (var i = 0; i < buttons.length; i++) {
      state.buttons.push({
        id: buttons[i].id,
        markiert: buttons[i].getAttribute("data-markiert"),
        gewertet: buttons[i].getAttribute("data-gewertet"),
        style: {
          backgroundColor: buttons[i].style.backgroundColor,
          backgroundImage: buttons[i].style.backgroundImage,
          color: buttons[i].style.color,
          border: buttons[i].style.border,
          outline: buttons[i].style.outline,
          outlineOffset: buttons[i].style.outlineOffset,
          display: buttons[i].style.display
        },
        nextSiblingHTML: buttons[i].nextSibling ? buttons[i].nextSibling.innerHTML : null
      });
    }
    
    // Save word search button states
    var suchButtons = SK.getElementsByClassName("MuEvSuBut");
    state.suchButtons = [];
    for (var i = 0; i < suchButtons.length; i++) {
      state.suchButtons.push({
        id: suchButtons[i].id,
        markiert: suchButtons[i].getAttribute("data-markiert"),
        gewertet: suchButtons[i].getAttribute("data-gewertet"),
        spielAus: suchButtons[i].getAttribute("data-spielAus"),
        style: {
          backgroundColor: suchButtons[i].style.backgroundColor,
          fontWeight: suchButtons[i].style.fontWeight,
          border: suchButtons[i].style.border,
          outline: suchButtons[i].style.outline,
          outlineOffset: suchButtons[i].style.outlineOffset,
          borderRadius: suchButtons[i].style.borderRadius
        },
        parentStyle: suchButtons[i].parentNode ? {
          backgroundColor: suchButtons[i].parentNode.style.backgroundColor
        } : null
      });
    }
    
    // Save HangMan (Hangman) display elements
    var haManAusg = SK.getElementsByClassName("MulEvHaManAusg");
    state.haManAusg = [];
    for (var i = 0; i < haManAusg.length; i++) {
      state.haManAusg.push({
        id: haManAusg[i].id,
        innerHTML: haManAusg[i].innerHTML
      });
    }
    
    var haManFehl = SK.getElementsByClassName("MulEvHaManFehl");
    state.haManFehl = [];
    for (var i = 0; i < haManFehl.length; i++) {
      state.haManFehl.push({
        id: haManFehl[i].id,
        innerHTML: haManFehl[i].innerHTML,
        style: {
          textDecoration: haManFehl[i].style.textDecoration
        }
      });
    }
    
    // Save evaluation button state
    var evalButton = document.getElementById("MuEvAuswButB" + clNr);
    if (evalButton) {
      state.evalButton = {
        borderStyle: evalButton.style.border,
        borderRadius: evalButton.style.borderRadius
      };
    }
    
    var versucheSpan = document.getElementById("MultieventVersuche" + clNr);
    if (versucheSpan) {
      state.versucheStyle = {
        fontWeight: versucheSpan.style.fontWeight
      };
    }
    
    // Save hint visibility
    var hinweisRichtig = SK.querySelectorAll(".Multieventhinweis[data-typ='richtig']");
    state.hinweisRichtig = [];
    for (var i = 0; i < hinweisRichtig.length; i++) {
      state.hinweisRichtig.push({
        display: hinweisRichtig[i].style.display
      });
    }
    
    var hinweisFalsch = SK.querySelectorAll(".Multieventhinweis[data-typ='falsch']");
    state.hinweisFalsch = [];
    for (var i = 0; i < hinweisFalsch.length; i++) {
      state.hinweisFalsch.push({
        display: hinweisFalsch[i].style.display
      });
    }
    
    // Save textarea values
    var textareas = SK.getElementsByTagName("textarea");
    for (var i = 0; i < textareas.length; i++) {
      state.textareas.push({
        value: textareas[i].value
      });
    }
    
    // Save select values
    var selects = SK.getElementsByTagName("select");
    state.selects = [];
    // Save math field values
    state.mathFields = [];
    var mathFields = SK.getElementsByTagName("math-field");
    for (var i = 0; i < selects.length; i++) {
      state.selects.push({
        selectedIndex: selects[i].selectedIndex,
        disabled: selects[i].disabled,
        style: {
          backgroundColor: selects[i].style.backgroundColor,
          backgroundImage: selects[i].style.backgroundImage,
          backgroundSize: selects[i].style.backgroundSize,
          color: selects[i].style.color
        }
      });
    }

    for (var i = 0; i < mathFields.length; i++) {
      state.mathFields.push({
        value: mathFields[i].value,
        readOnly: mathFields[i].readOnly,
        style: {
          backgroundColor: mathFields[i].style.backgroundColor,
          backgroundImage: mathFields[i].style.backgroundImage,
          backgroundSize: mathFields[i].style.backgroundSize,
          color: mathFields[i].style.color
        }
      });
    }
    
    await hyperbook.store.db.multievent.put({
      id: multievent.storeKey(clNr),
      state: JSON.stringify(state)
    });
  },
  loadState: async function (clNr) {
    try {
      var key = multievent.storeKey(clNr);
      var record = await hyperbook.store.db.multievent.get(key);
      var legacyKey = multievent.legacyStoreKey(clNr);
      if (!record && key !== legacyKey) {
        // Saved before multievents had ids: move it to the id, once.
        var legacy = await hyperbook.store.db.multievent.get(legacyKey);
        if (legacy) {
          await hyperbook.store.db.transaction("rw", hyperbook.store.db.multievent, async function () {
            await hyperbook.store.db.multievent.put({ id: key, state: legacy.state });
            await hyperbook.store.db.multievent.delete(legacyKey);
          });
          record = { id: key, state: legacy.state };
        }
      }
      if (!record) return false;
      
      var state = JSON.parse(record.state);
      var SK = document.getElementsByClassName("multievent")[clNr];
      if (!SK) return false;
      
      // Restore version number and evaluation state
      if (state.vNr !== undefined) multievent.vNr[clNr] = state.vNr;
      if (state.gesamtwertung !== undefined) multievent.gesamtwertung[clNr] = state.gesamtwertung;
      if (state.gewertet !== undefined) multievent.gewertet[clNr] = state.gewertet;
      
      // Restore inputs
      var inputs = SK.getElementsByTagName("input");
      for (var i = 0; i < inputs.length && i < state.inputs.length; i++) {
        if (state.inputs[i].type === inputs[i].type) {
          inputs[i].value = state.inputs[i].value;
          inputs[i].checked = state.inputs[i].checked;
          inputs[i].disabled = state.inputs[i].disabled;
          
          // Restore data attributes
          if (state.inputs[i].dataAttributes) {
            var attrs = state.inputs[i].dataAttributes;
            if (attrs.markiert) inputs[i].setAttribute("data-markiert", attrs.markiert);
            if (attrs.gemischt) inputs[i].setAttribute("data-gemischt", attrs.gemischt);
            if (attrs.BuchstSind) inputs[i].setAttribute("data-BuchstSind", attrs.BuchstSind);
            if (attrs.Nummer) inputs[i].setAttribute("data-Nummer", attrs.Nummer);
            if (attrs.BegriffeSind) inputs[i].setAttribute("data-BegriffeSind", attrs.BegriffeSind);
            if (attrs.Fehler) inputs[i].setAttribute("data-Fehler", attrs.Fehler);
          }
          
          // Restore input styles
          if (state.inputs[i].style) {
            if (state.inputs[i].style.backgroundColor) inputs[i].style.backgroundColor = state.inputs[i].style.backgroundColor;
            if (state.inputs[i].style.backgroundImage) inputs[i].style.backgroundImage = state.inputs[i].style.backgroundImage;
            if (state.inputs[i].style.backgroundSize) inputs[i].style.backgroundSize = state.inputs[i].style.backgroundSize;
            if (state.inputs[i].style.color) inputs[i].style.color = state.inputs[i].style.color;
          }
          
          // Restore parent node styles (for radio/checkbox groups)
          if (state.inputs[i].parentStyle && inputs[i].parentNode) {
            if (state.inputs[i].parentStyle.backgroundColor) 
              inputs[i].parentNode.style.backgroundColor = state.inputs[i].parentStyle.backgroundColor;
            if (state.inputs[i].parentStyle.backgroundImage) 
              inputs[i].parentNode.style.backgroundImage = state.inputs[i].parentStyle.backgroundImage;
            if (state.inputs[i].parentStyle.backgroundSize) 
              inputs[i].parentNode.style.backgroundSize = state.inputs[i].parentStyle.backgroundSize;
          }
          
          // Restore sibling HTML (for error indicators)
          if (state.inputs[i].siblingHTML) {
            if (state.inputs[i].siblingHTML.prev !== null && inputs[i].previousSibling) {
              inputs[i].previousSibling.innerHTML = state.inputs[i].siblingHTML.prev;
            }
            if (state.inputs[i].siblingHTML.next !== null && inputs[i].nextSibling) {
              inputs[i].nextSibling.innerHTML = state.inputs[i].siblingHTML.next;
            }
          }
        }
      }
      
      // Restore buttons
      var buttons = SK.getElementsByClassName("butAnAus");
      for (var i = 0; i < buttons.length && i < state.buttons.length; i++) {
        if (state.buttons[i].id === buttons[i].id) {
          buttons[i].setAttribute("data-markiert", state.buttons[i].markiert);
          buttons[i].setAttribute("data-gewertet", state.buttons[i].gewertet);
          
          // Restore button styles
          if (state.buttons[i].style) {
            if (state.buttons[i].style.backgroundColor) buttons[i].style.backgroundColor = state.buttons[i].style.backgroundColor;
            if (state.buttons[i].style.backgroundImage) buttons[i].style.backgroundImage = state.buttons[i].style.backgroundImage;
            if (state.buttons[i].style.color) buttons[i].style.color = state.buttons[i].style.color;
            if (state.buttons[i].style.border) buttons[i].style.border = state.buttons[i].style.border;
            if (state.buttons[i].style.outline) buttons[i].style.outline = state.buttons[i].style.outline;
            if (state.buttons[i].style.outlineOffset) buttons[i].style.outlineOffset = state.buttons[i].style.outlineOffset;
            if (state.buttons[i].style.display) buttons[i].style.display = state.buttons[i].style.display;
          }
          
          // Restore next sibling HTML
          if (state.buttons[i].nextSiblingHTML !== null && buttons[i].nextSibling) {
            buttons[i].nextSibling.innerHTML = state.buttons[i].nextSiblingHTML;
          }
        }
      }
      
      // Restore textareas
      var textareas = SK.getElementsByTagName("textarea");
      for (var i = 0; i < textareas.length && i < state.textareas.length; i++) {
        textareas[i].value = state.textareas[i].value;
      }
      
      // Restore selects
      var selects = SK.getElementsByTagName("select");
      if (state.selects) {
        for (var i = 0; i < selects.length && i < state.selects.length; i++) {
          selects[i].selectedIndex = state.selects[i].selectedIndex;
          selects[i].disabled = state.selects[i].disabled;
          
          // Restore select styles
          if (state.selects[i].style) {
            if (state.selects[i].style.backgroundColor) selects[i].style.backgroundColor = state.selects[i].style.backgroundColor;
            if (state.selects[i].style.backgroundImage) selects[i].style.backgroundImage = state.selects[i].style.backgroundImage;
            if (state.selects[i].style.backgroundSize) selects[i].style.backgroundSize = state.selects[i].style.backgroundSize;
            if (state.selects[i].style.color) selects[i].style.color = state.selects[i].style.color;
          }
        }
      }

      // Restore math fields. The value lands on the field whether its
      // element is a MathLive field yet or not; if not, it is also kept in
      // data-PendingLatex and applied when MathLive has arrived.
      if (state.mathFields) {
        var mathFields = SK.getElementsByTagName("math-field");
        for (var i = 0; i < mathFields.length && i < state.mathFields.length; i++) {
          mathFields[i].value = state.mathFields[i].value;
          mathFields[i].setAttribute("data-PendingLatex", state.mathFields[i].value);
          mathFields[i].readOnly = state.mathFields[i].readOnly;
          if (state.mathFields[i].style) {
            if (state.mathFields[i].style.backgroundColor) mathFields[i].style.backgroundColor = state.mathFields[i].style.backgroundColor;
            if (state.mathFields[i].style.backgroundImage) mathFields[i].style.backgroundImage = state.mathFields[i].style.backgroundImage;
            if (state.mathFields[i].style.backgroundSize) mathFields[i].style.backgroundSize = state.mathFields[i].style.backgroundSize;
            if (state.mathFields[i].style.color) mathFields[i].style.color = state.mathFields[i].style.color;
          }
        }
        multievent.ladeMathe().then(function (geladen) {
          if (!geladen) return;
          var aktueller = SK.getElementsByTagName("math-field");
          for (var j = 0; j < aktueller.length; j++) {
            var latex = aktueller[j].getAttribute("data-PendingLatex");
            if (latex !== null) {
              aktueller[j].value = latex;
              aktueller[j].removeAttribute("data-PendingLatex");
            }
          }
        });
      }
      
      // Restore word search buttons
      if (state.suchButtons) {
        var suchButtons = SK.getElementsByClassName("MuEvSuBut");
        for (var i = 0; i < suchButtons.length && i < state.suchButtons.length; i++) {
          if (state.suchButtons[i].id === suchButtons[i].id) {
            suchButtons[i].setAttribute("data-markiert", state.suchButtons[i].markiert);
            suchButtons[i].setAttribute("data-gewertet", state.suchButtons[i].gewertet);
            suchButtons[i].setAttribute("data-spielAus", state.suchButtons[i].spielAus);
            
            // Restore word search button styles
            if (state.suchButtons[i].style) {
              if (state.suchButtons[i].style.backgroundColor) suchButtons[i].style.backgroundColor = state.suchButtons[i].style.backgroundColor;
              if (state.suchButtons[i].style.fontWeight) suchButtons[i].style.fontWeight = state.suchButtons[i].style.fontWeight;
              if (state.suchButtons[i].style.border) suchButtons[i].style.border = state.suchButtons[i].style.border;
              if (state.suchButtons[i].style.outline) suchButtons[i].style.outline = state.suchButtons[i].style.outline;
              if (state.suchButtons[i].style.outlineOffset) suchButtons[i].style.outlineOffset = state.suchButtons[i].style.outlineOffset;
              if (state.suchButtons[i].style.borderRadius) suchButtons[i].style.borderRadius = state.suchButtons[i].style.borderRadius;
            }
            
            // Restore parent styles
            if (state.suchButtons[i].parentStyle && suchButtons[i].parentNode) {
              if (state.suchButtons[i].parentStyle.backgroundColor) 
                suchButtons[i].parentNode.style.backgroundColor = state.suchButtons[i].parentStyle.backgroundColor;
            }
          }
        }
      }
      
      // Restore HangMan display elements
      if (state.haManAusg) {
        var haManAusg = SK.getElementsByClassName("MulEvHaManAusg");
        for (var i = 0; i < haManAusg.length && i < state.haManAusg.length; i++) {
          if (state.haManAusg[i].id === haManAusg[i].id) {
            haManAusg[i].innerHTML = state.haManAusg[i].innerHTML;
          }
        }
      }
      
      if (state.haManFehl) {
        var haManFehl = SK.getElementsByClassName("MulEvHaManFehl");
        for (var i = 0; i < haManFehl.length && i < state.haManFehl.length; i++) {
          if (state.haManFehl[i].id === haManFehl[i].id) {
            haManFehl[i].innerHTML = state.haManFehl[i].innerHTML;
            if (state.haManFehl[i].style && state.haManFehl[i].style.textDecoration) {
              haManFehl[i].style.textDecoration = state.haManFehl[i].style.textDecoration;
            }
          }
        }
      }
      
      // Restore evaluation button state
      if (state.evalButton) {
        var evalButton = document.getElementById("MuEvAuswButB" + clNr);
        if (evalButton) {
          if (state.evalButton.borderStyle) evalButton.style.border = state.evalButton.borderStyle;
          if (state.evalButton.borderRadius) evalButton.style.borderRadius = state.evalButton.borderRadius;
        }
      }
      
      if (state.versucheStyle) {
        var versucheSpan = document.getElementById("MultieventVersuche" + clNr);
        if (versucheSpan && state.versucheStyle.fontWeight) {
          versucheSpan.style.fontWeight = state.versucheStyle.fontWeight;
        }
      }
      
      // Restore hint visibility
      if (state.hinweisRichtig) {
        var hinweisRichtig = SK.querySelectorAll(".Multieventhinweis[data-typ='richtig']");
        for (var i = 0; i < hinweisRichtig.length && i < state.hinweisRichtig.length; i++) {
          if (state.hinweisRichtig[i].display) {
            hinweisRichtig[i].style.display = state.hinweisRichtig[i].display;
          }
        }
      }
      
      if (state.hinweisFalsch) {
        var hinweisFalsch = SK.querySelectorAll(".Multieventhinweis[data-typ='falsch']");
        for (var i = 0; i < hinweisFalsch.length && i < state.hinweisFalsch.length; i++) {
          if (state.hinweisFalsch[i].display) {
            hinweisFalsch[i].style.display = state.hinweisFalsch[i].display;
          }
        }
      }
      
      // Update attempt counter display
      if (state.gesamtwertung !== undefined && state.gesamtwertung > 0) {
        var versucheEl = document.getElementById("MultieventVersuche" + clNr);
        if (versucheEl) {
          versucheEl.innerHTML = state.gesamtwertung;
        }
      }
      
      return true;
    } catch (e) {
      console.error("Error loading multievent state:", e);
      return false;
    }
  },
  butAnAus: function (butID) {
    var but = document.getElementById(butID);
    var markiert = but.getAttribute("data-markiert");
    var gewertet = but.getAttribute("data-gewertet");

    if (gewertet == 0) {
      if (markiert == "0") {
        but.style.outline = "4px dotted green";
        but.style.outlineOffset = "-3px";
        but.setAttribute("data-markiert", "1");
      } else {
        but.style.outline = "none";
        but.setAttribute("data-markiert", "0");
      }
      
      // Save state after button toggle
      var clIndex = but.closest(".multievent");
      if (clIndex) {
        var index = Array.from(document.getElementsByClassName("multievent")).indexOf(clIndex);
        multievent.saveState(index);
      }
    }
  },
  vNr: [],
  init: function () {
    document.getElementsByTagName("body")[0].style.fontFamily = "sans-serif";
    var Ergebnisse = document.createElement("div");
    Ergebnisse.id = "MultieventErgebnisse";
    Ergebnisse.style =
      "font-family:sans-serif;position:fixed; top:1em;right:1em;background-color:white;border:2px solid silver;text-align:center;padding:0.5em;border-radius:6px;display:none;z-index:1000;";
    var first = document.getElementsByTagName("body")[0].firstChild;
    document.getElementsByTagName("body")[0].insertBefore(Ergebnisse, first);

    var SK = document.getElementsByClassName("multievent");
    for (var i = 0; i < SK.length; i++) {
      multievent.orig[i] = SK[i].innerHTML;
      var VersNr = multievent.zZahl(-1, 9);
      multievent.vNr[i] = parseInt(VersNr);
      multievent.los(i).then(function(index) {
        return multievent.loadState(index);
      }.bind(null, i));
    }
  },
  los: async function (clNr) {
    multievent.gesamtwertung[clNr] = 0;
    var SK = document.getElementsByClassName("multievent"); /*Suchklasse*/
    multievent.vNr[clNr]++;
    multievent.gewertet[clNr] = 0;
    // The interactive elements are built at page build: the compiler turned
    // every {x{…}} marker into its input, dropdown or grid. All that is left
    // here is to restore the pristine markup, add the evaluation bar, and run
    // the passes that depend on this multievent's position on the page.
    SK[clNr].innerHTML =
      multievent.orig[clNr] +
      "<p id='MuEvAuswButP" +
      clNr +
      "' align='center'><button id='MuEvAuswButB" +
      clNr +
      "' onclick='multievent.Auswertung(\"" +
      clNr +
      "\")'>&#10004; <small id='MultieventVersuche" +
      clNr +
      "'>0</small></button> <span id='MuEvNeuButP" +
      clNr +
      "' align='center'><button onclick='multievent.los(" +
      clNr +
      ")' title='Neu'>&crarr;</button></span></p>";
    var Inp = SK[clNr].getElementsByTagName("input");
    var InpZ = SK[clNr].getElementsByClassName("multiEvInpYZ");
    var SpanY = SK[clNr].getElementsByClassName("multiEvSpanY");
    var SelIst = SK[clNr].getElementsByTagName("select");
    var Textarea = SK[clNr].getElementsByTagName("Textarea");
    var butAU = SK[clNr].getElementsByClassName("butAnAus");
    var MuKwTable = SK[clNr].getElementsByClassName("MultiKwrTable");
    var MuKwTr = SK[clNr].getElementsByClassName("MultiKwrTr");
    var MuSuTable = SK[clNr].getElementsByClassName("MultiEvSuchTable");
    var MuSuTd = SK[clNr].getElementsByClassName("MultiEvSuchTd");
    //var MuKwTd=SK[clNr].getElementsByClassName("MultiKwrTd");
    var multiEvSel = SK[clNr].getElementsByClassName("multiEvSel");

    var MuEvHaMaI = SK[clNr].getElementsByClassName("MulEvHaManInp");
    var MuEvHaMaA = SK[clNr].getElementsByClassName("MulEvHaManAusg");
    var MuEvHaMaF = SK[clNr].getElementsByClassName("MulEvHaManFehl");

    var MatheFeld = SK[clNr].getElementsByClassName("multiEvMathe");
    if (MatheFeld.length > 0) multievent.ladeMathe();

    // Group names carry this multievent's position, so groups of different
    // multievents on a page never mix. The build wrote the static part of the
    // name (radio, Radio, checkboxc, checkboxC) to data-name, the number of
    // the group to data-gruppe; here both are joined to the name the
    // evaluation expects, and the dropdowns of a {S…} group get their
    // data-SelNr.
    for (var j = 0; j < Inp.length; j++) {
      var strName = Inp[j].getAttribute("data-name");
      if (strName) {
        Inp[j].name = strName + clNr + Inp[j].getAttribute("data-gruppe");
      }
    }
    for (var j = 0; j < SelIst.length; j++) {
      var strGruppe = SelIst[j].getAttribute("data-gruppe");
      if (strGruppe !== null && SelIst[j].getAttribute("data-wertIst")) {
        SelIst[j].setAttribute("data-SelNr", "" + clNr + strGruppe);
      }
    }

    for (var j = 0; j < MuEvHaMaI.length; j++) {
      var Begriffe = MuEvHaMaI[j].getAttribute("data-MulEvHaMan").split("|");
      var BegrGemischt = multievent.misch(Begriffe);
      var BegrGem = BegrGemischt.join("|");
      var BegrAusg = "";
      for (var k = 0; k < BegrGemischt[0].length; k++) {
        BegrAusg += "<span style='color:#555'>&diams;</span>";
      }
      MuEvHaMaA[j].innerHTML = "<strong>" + BegrAusg + "</strong>";
      MuEvHaMaI[j].setAttribute("data-MulEvHaMan", BegrGem);
      MuEvHaMaI[j].id = "MuEvHaMaI_" + clNr + "_" + j;
      MuEvHaMaA[j].id = "MuEvHaMaA_" + clNr + "_" + j;
      MuEvHaMaF[j].id = "MuEvHaMaF_" + clNr + "_" + j;
      // Each keystroke counts as a guess in the hangman; bound here, because
      // the listeners are rebuilt with the markup every time the multievent
      // restarts.
      MuEvHaMaI[j].addEventListener("keydown", function () {
        this.value = "";
      });
      MuEvHaMaI[j].addEventListener("keyup", function () {
        multievent.MulEvHaMan(this.id);
        multievent.Auswertung(clNr);
      });
    }

    for (var j = 0; j < MuSuTable.length; j++) {
      MuSuTable[j].innerHTML = MuSuTable[j].innerHTML
        .replace(
          /~~/gms,
          "</td></tr><tr><td height='28' width='28' valign='middle' align='center' class='MultiEvSuchTd'>",
        )
        .replace(
          /\|/gms,
          "</td><td  height='28' width='28' valign='middle' align='center' class='MultiEvSuchTd' >",
        );
    }

    for (var j = 0; j < MuSuTd.length; j++) {
      var TdText = MuSuTd[j].textContent.trim();
      var BuchstGrSuche = TdText.search(/[A-ZÄÖÜ]/);
      if (BuchstGrSuche != -1) {
        MuSuTd[j].innerHTML =
          "<button class='MuEvSuBut' onmousedown='multievent.suAn(); multievent.suchselAnAus(this.id)' onmouseover='multievent.suchselAnAus(this.id)' id='SuchselButton_" +
          clNr +
          "_" +
          j +
          "' data-richtig='1' data-markiert='0' data-gewertet='0' data-spielAus='0' data-move='1' style='width:1.8em;height:1.8em;font-size:1em;border:1px solid silver;border-radius:3px;padding:2px;'>" +
          TdText +
          "</button>";
      } else {
        MuSuTd[j].innerHTML =
          "<button class='MuEvSuBut' onmousedown='multievent.suAn(); multievent.suchselAnAus(this.id)' onmouseover='multievent.suchselAnAus(this.id)' id='SuchselButton_" +
          clNr +
          "_" +
          j +
          "' data-richtig='0' data-markiert='0' data-gewertet='0' data-spielAus='0' data-move='1' style='width:1.8em;height:1.8em;font-size:1em;border:1px solid silver;border-radius:3px;padding:2px;'>" +
          TdText.toUpperCase() +
          "</button>";
      }
    }

    for (var j = 0; j < MuKwTable.length; j++) {
      MuKwTable[j].innerHTML = MuKwTable[j].innerHTML
        .replace(
          /~~/gms,
          "</td></tr><tr class='MultiKwrTr'><td height='28' width='28' valign='middle' align='center' class='MultiKwrTd'>",
        )
        .replace(
          /\|/gms,
          "</td><td  height='28' width='28' valign='middle' align='center' class='MultiKwrTd' >",
        );
    }

    for (var j = 0; j < multiEvSel.length; j++) {
      multiEvSel[j].innerHTML = multiEvSel[j].innerHTML.replace(
        /\|/gms,
        "</option><option value='0'>",
      );
    }

    for (var j = 0; j < multiEvSel.length; j++) {
      multiEvSel[j].innerHTML = multiEvSel[j].innerHTML.replace(
        /value=.0.>\s*?!/g,
        "value='1'>",
      );
    }

    for (var j = 0; j < MuKwTr.length; j++) {
      var MuKwTd = MuKwTr[j].getElementsByClassName("MultiKwrTd");
      for (var k = 0; k < MuKwTd.length; k++) {
        var TdText = MuKwTd[k].textContent.trim();
        var BuchstSuche = TdText.search(/[a-zA-ZÄÖÜäöüß]/);
        if (BuchstSuche != -1) {
          MuKwTd[k].style.backgroundColor = "white";
          MuKwTd[k].innerHTML =
            "<input class='MultiKwrInp' data-Sprungmarke='" +
            clNr +
            "-" +
            j +
            "-" +
            k +
            "' onkeyup='multievent.tastensprung(\"" +
            clNr +
            "-" +
            j +
            "-" +
            k +
            "\",this.value)' data-wert='" +
            TdText +
            "' data-style='loesungklein' maxlength='1' style='width:1.2em;font-size:1em;text-align:center;padding:2px;border:1px solid #999;border-radius:3px;'/>";
          MuKwTd[k].style.border = "1px solid black";
        }
        var ZahlenSuche = TdText.search(/[0-9]/);
        if (ZahlenSuche != -1) {
          MuKwTd[k].style.backgroundColor = "white";
        }
      }
    }

    for (var j = 0; j < butAU.length; j++) {
      butAU[j].id = "buAnAu" + clNr + j;
    }
    if (
      Inp.length == 0 &&
      SelIst.length == 0 &&
      butAU.length == 0 &&
      MuSuTable.length == 0 &&
      MatheFeld.length == 0
    ) {
      document.getElementById("MuEvNeuButP" + clNr).style.display = "none";
      document.getElementById("MuEvAuswButP" + clNr).style.display = "none";
      multievent.gesamtwertung[clNr] = "-1";
    }
    var SelNr = [];
    for (var j = 0; j < SelIst.length; j++) {
      if (SelIst[j].getAttribute("data-SelNr")) {
        SelNr[j] = SelIst[j].getAttribute("data-SelNr");
      }
    }
    SelNr.sort();
    var SelNrUni = [];
    var snu = 0;
    for (var j = 0; j < SelNr.length; j++) {
      if (j == 0) {
        SelNrUni[snu] = SelNr[j].toString();
        snu++;
      } else {
        if (SelNr[j] != SelNr[j - 1]) {
          SelNrUni[snu] = SelNr[j];
          snu++;
        }
      }
    }

    var SelNrOpt = [];
    var SelNrOptNeu = [];
    for (var j = 0; j < SelNrUni.length; j++) {
      SelNrOpt[j] = [];

      var m = 0;
      for (var k = 0; k < SelIst.length; k++) {
        if (SelIst[k].getAttribute("data-SelNr") == SelNrUni[j]) {
          SelNrOpt[j][m] =
            "<option>" + SelIst[k].getAttribute("data-wertIst") + "</option>";
          m++;
        }
      }

      SelNrOptNeu[j] = SelNrOpt[j].filter(
        (ele, pos) => SelNrOpt[j].indexOf(ele) == pos,
      );

      SelNrOptNeu[j].sort();
    }

    for (var j = 0; j < SelIst.length; j++) {
      var SeNr = SelIst[j].getAttribute("data-SelNr");
      for (var k = 0; k < SelNrUni.length; k++) {
        if (SeNr == SelNrUni[k] && SeNr != null) {
          SelIst[j].innerHTML = "<option></option>" + SelNrOptNeu[k].join("");
        }
      }
    }

    for (var j = 0; j < SelIst.length; j++) {
      var SeNr = SelIst[j].getAttribute("data-SelNr");
      var Opt = SelIst[j].getElementsByTagName("option");
      var WertSel = SelIst[j].getAttribute("data-wertIst");
      for (var k = 0; k < Opt.length; k++) {
        if (Opt[k].text == WertSel && SeNr != null) {
          SelIst[j].getElementsByTagName("option")[k].value = "1";
        } else {
          if (SeNr != null) {
            SelIst[j].getElementsByTagName("option")[k].value = "0";
          }
        }
      }
    }

    for (var j = 0; j < InpZ.length; j++) {
      var wk = InpZ[j].getAttribute("data-wk").split("|");
      var WertNr = multievent.vNr[clNr] % wk.length;
      InpZ[j].setAttribute("data-Wert", wk[WertNr]);
      multievent;
      var IB = wk[WertNr].length;

      if (IB <= 1) {
        InpZ[j].style.width = "1.2em";
      }
      if (IB == 2) {
        InpZ[j].style.width = "1.8em";
      }
      if (IB == 3) {
        InpZ[j].style.width = "2.3em";
      }
      if (IB == 4) {
        InpZ[j].style.width = "3.2em";
      }
      if (IB > 4) {
        InpZ[j].style.width = IB * 0.75 + "em";
      }
      InpZ[j].style.fontSize = "1em";
      InpZ[j].style.textAlign = "center";
    }
    for (var j = 0; j < MatheFeld.length; j++) {
      MatheFeld[j].id = "MuEvMathe_" + clNr + "_" + j;
      // A formula with blanks is as wide as the formula.
      if (MatheFeld[j].hasAttribute("data-luecken")) continue;
      var akzeptiert = multievent.matheAlternativen(
        MatheFeld[j].getAttribute("data-Wert"),
      );
      var MB = 0;
      for (var k = 0; k < akzeptiert.length; k++) {
        if (MB < akzeptiert[k].length) MB = akzeptiert[k].length;
      }
      // MathLive sizes itself; this only keeps the empty field big enough to
      // click into before it is (and even after it is) filled.
      MatheFeld[j].style.minWidth = Math.max(MB, 4) * 0.75 + "em";
    }
    for (var j = 0; j < SpanY.length; j++) {
      var wk = SpanY[j].getAttribute("data-wk").split("|");
      var WertNr = multievent.vNr[clNr] % wk.length;
      SpanY[j].innerHTML = wk[WertNr];
    }
    var b = SK[clNr].getElementsByClassName("multieventBlende");
    for (var j = 0; j < b.length; j++) {
      b[j].id = "MultiBlende" + clNr + "" + j;
    }
    for (var j = 0; j < Textarea.length; j++) {
      Textarea[j].value = Textarea[j].value
        .replace(/~/g, "\n")
        .replace(/<br>/g, "");
    }
    for (var j = 0; j < Inp.length; j++) {
      if (
        Inp[j].type == "text" &&
        (Inp[j].className == "multiEvInp" || Inp[j].className == "multiEvInpYZ")
      ) {
        var iW = Inp[j].getAttribute("data-Wert").split("|");
        var InpStil = Inp[j].getAttribute("data-style");
        if (InpStil == "loesungklein" || InpStil == "loesunggross") {
          var loesBuchst = [];
          var LoesWort = Inp[j].getAttribute("data-Wert");
          for (var k = 0; k < LoesWort.length; k++) {
            loesBuchst[k] = LoesWort.substring(k, parseInt(k + 1));
          }
          var InpLoesGemWert = multievent.misch(loesBuchst).join("");
          for (var l = 0; l < 5; l++) {
            var AnfWert = LoesWort.substring(0, 1);
            var AnfGem = InpLoesGemWert.substring(0, 1);
            if (AnfWert == AnfGem) {
              InpLoesGemWert = multievent.misch(loesBuchst).join("");
            }
          }

          if (Inp[j].parentNode.className != "MultiKwrTd") {
            Inp[j].value = InpLoesGemWert;
          }
          Inp[j].setAttribute("data-gemischt", Inp[j].value);
          Inp[j].id = "InpLoesGem" + clNr + "" + j;
        }
        var IB = 0;
        for (var k = 0; k < iW.length; k++) {
          if (IB < iW[k].length) {
            IB = iW[k].length;
          }
        }
        if (InpStil == "zahl") {
          // Numbers can be entered in other notations (3,5 vs 3.50),
          // so leave some room beyond the length of the solution.
          IB++;
        }
        // At least three characters wide, otherwise short answers get
        // fields that are too small to tap and type into (e.g. on iPads).
        Inp[j].style.width = Math.max(IB, 3) * 1.2 + "em";
      }
    }

    var MECh = SK[clNr].getElementsByClassName("MECheckbox");
    var MEChLa = SK[clNr].getElementsByClassName("MeChLabel");
    for (var j = 0; j < MECh.length; j++) {
      MECh[j].id = "MECheckbox" + clNr + "" + j;
      MEChLa[j].setAttribute("for", "MECheckbox" + clNr + "" + j);
    }

    var MERa = SK[clNr].getElementsByClassName("MERadio");
    var MERaLa = SK[clNr].getElementsByClassName("MeRaLabel");
    for (var j = 0; j < MERa.length; j++) {
      MERa[j].id = "MERadio" + clNr + "" + j;
      MERaLa[j].setAttribute("for", "MERadio" + clNr + "" + j);
    }

    SK[clNr].style.display = "block";
    SK[clNr].style.visibility = "visible";
    SK[clNr].style.opacity = "1";
    
    // Add event listeners to save state on changes
    var allInputs = SK[clNr].getElementsByTagName("input");
    for (var j = 0; j < allInputs.length; j++) {
      allInputs[j].addEventListener("change", function() {
        var clIndex = this.closest(".multievent");
        if (clIndex) {
          var index = Array.from(document.getElementsByClassName("multievent")).indexOf(clIndex);
          multievent.saveState(index);
        }
      });
    }
    
    var allTextareas = SK[clNr].getElementsByTagName("textarea");
    for (var j = 0; j < allTextareas.length; j++) {
      allTextareas[j].addEventListener("input", function() {
        var clIndex = this.closest(".multievent");
        if (clIndex) {
          var index = Array.from(document.getElementsByClassName("multievent")).indexOf(clIndex);
          multievent.saveState(index);
        }
      });
    }
    
    var allSelects = SK[clNr].getElementsByTagName("select");
    for (var j = 0; j < allSelects.length; j++) {
      allSelects[j].addEventListener("change", function() {
        var clIndex = this.closest(".multievent");
        if (clIndex) {
          var index = Array.from(document.getElementsByClassName("multievent")).indexOf(clIndex);
          multievent.saveState(index);
        }
      });
    }

    var allMathFields = SK[clNr].getElementsByTagName("math-field");
    for (var j = 0; j < allMathFields.length; j++) {
      allMathFields[j].addEventListener("input", function() {
        var clIndex = this.closest(".multievent");
        if (clIndex) {
          var index = Array.from(document.getElementsByClassName("multievent")).indexOf(clIndex);
          multievent.saveState(index);
        }
      });
    }
  },
  inpGemEing: function (WertIst, GemID) {
    var vIst = WertIst.replace(/\s/g, "");
    var wertGem = document.getElementById(GemID).getAttribute("data-gemischt");
    if (vIst == "") {
      document.getElementById(GemID).value = wertGem;
    }
  },
  /**
   * Evaluates a multievent. Evaluating waits for the Compute Engine when there
   * are math fields, so a second click could start while the first is still
   * running and count the round twice; evaluations of one multievent
   * therefore run one after the other, the next seeing what the last decided.
   */
  _laufend: [],
  Auswertung: function (classNr) {
    var laufend = multievent._laufend[classNr];
    var lauf = laufend
      ? laufend.then(function () {
          return multievent.auswerten(classNr);
        })
      : multievent.auswerten(classNr);
    var merker = lauf
      .catch(function () {})
      .then(function () {
        if (multievent._laufend[classNr] === merker) {
          multievent._laufend[classNr] = null;
        }
      });
    multievent._laufend[classNr] = merker;
    return lauf;
  },
  auswerten: async function (classNr) {
    multievent.ErgAus();
    if (multievent.gewertet[classNr] == 0) {
      var HgF =
        "linear-gradient(90deg, transparent 50%, rgba(255,255,255,.8) 50%)";
      var F = 0;

      var But = document
        .getElementsByClassName("multievent")
        [classNr].getElementsByClassName("butAnAus");
      var ButGruppen = []; //Unterschiedliche Buttongruppen ermitteln
      var ButI = 0;

      for (var i = 0; i < But.length; i++) {
        var Gruppe = But[i].getAttribute("data-gruppe");
        if (ButGruppen.indexOf(Gruppe) == -1) {
          ButGruppen[ButI] = Gruppe;
          ButI++;
        }
      }

      var ButFehler = [];
      var ButtonFehlerGesamt = 0;
      for (var i = 0; i < ButGruppen.length; i++) {
        ButFehler[i] = 0;
        for (var j = 0; j < But.length; j++) {
          var ButWert = But[j].value;
          var ButMarkiert = But[j].getAttribute("data-markiert");
          var Konrollgruppe = But[j].getAttribute("data-gruppe");
          if (ButWert != ButMarkiert && ButGruppen[i] == Konrollgruppe) {
            ButFehler[i]++;
          }
        }
        if (ButFehler[i] == 0) {
          for (var j = 0; j < But.length; j++) {
            var Gruppe = But[j].getAttribute("data-gruppe");
            var ButMarkiert = But[j].getAttribute("data-markiert");
            var Typ = But[j].getAttribute("data-typ");

            if (ButGruppen[i] == Gruppe) {
              if (ButMarkiert == 1) {
                But[j].style.backgroundColor = "#9f0";
                But[j].style.backgroundImage = "none";
                But[j].style.color = "black";
                But[j].style.border = "1px solid silver";
              } else {
                if (Typ == 0) {
                  But[j].style.display = "none";
                }
              }
              But[j].nextSibling.innerHTML = "";
              But[j].setAttribute("data-gewertet", "1");
            }
          }
        }

        if (ButFehler[i] > 0) {
          for (var j = 0; j < But.length; j++) {
            var Gruppe = But[j].getAttribute("data-gruppe");
            var ButMarkiert = But[j].getAttribute("data-markiert");

            if (ButGruppen[i] == Gruppe) {
              But[j].nextSibling.innerHTML = "&#128269;";
            }
          }
          ButtonFehlerGesamt = 1;
          F++;
        }
      }

      if (ButtonFehlerGesamt == 1) {
        alert("Mindestens ein Button dieses Bereichs ist falsch markiert.");
      }

      var Sel = document
        .getElementsByClassName("multievent")
        [classNr].getElementsByTagName("select");
      for (var i = 0; i < Sel.length; i++) {
        var WertIst = Sel[i].value;
        var S = Sel[i].style;
        if (WertIst == 1) {
          Sel[i].disabled = true;
          Sel[i].style.backgroundColor = "#9f0";
          S.backgroundImage = "none";
          Sel[i].style.color = "black";
        } else {
          S.backgroundColor = "#f90";
          S.backgroundImage = HgF;
          S.backgroundSize = "8px 8px";
          F++;
        }
      }
      var Inp = document
        .getElementsByClassName("multievent")
        [classNr].getElementsByTagName("input");
      var ChBoFehlerGes = 0;
      for (var i = 0; i < Inp.length; i++) {
        var WertIst = Inp[i].value
          .replace(/^\s+/g, "")
          .replace(/\s+$/g, "")
          .replace(/\s+/, " ");
        var iP = Inp[i].parentNode.style;
        var InpIS = Inp[i].style;

        if (Inp[i].type == "radio") {
          iP.backgroundColor = "transparent";
          iP.backgroundImage = "none";
          InpIS.color = "black";
          InpIS;
        }

        if (WertIst == 1 && Inp[i].type == "radio" && Inp[i].checked == true) {
          //richtig
          Inp[i].disabled = true;
          iP.backgroundColor = "#9f0";
          iP.backgroundImage = "none";
          InpIS.color = "black";

          var checkName = Inp[i].getAttribute("name");
          for (var j = 0; j < Inp.length; j++) {
            if (Inp[j].getAttribute("name") == checkName) {
              Inp[j].disabled = true;
            }
          }
        }
        if (WertIst == 0 && Inp[i].type == "radio" && Inp[i].checked == true) {
          iP.backgroundColor = "#f90";
          iP.backgroundImage = HgF;
          iP.backgroundSize = "8px 8px";
          InpIS.color = "black";
          InpIS;
          F++;
        }

        if (WertIst == 1 && Inp[i].type == "radio" && Inp[i].checked == false) {
          F++;
        }

        var RadioGruppen = []; //Unterschiedliche Radiogruppen ermitteln
        var RadI = 0;

        for (var j = 0; j < Inp.length; j++) {
          var Gruppe = Inp[j].getAttribute("name");
          if (RadioGruppen.indexOf(Gruppe) == -1) {
            if (Gruppe) {
              if (Gruppe.search(/adio/) != -1) {
                RadioGruppen[RadI] = Gruppe;
                RadI++;
              }
            }
          }
        }

        for (var j = 0; j < RadioGruppen.length; j++) {
          var RadFalsch = 0;
          for (var k = 0; k < Inp.length; k++) {
            var Gruppe = Inp[k].getAttribute("name");
            if (RadioGruppen[j] == Gruppe && Inp[k].checked == true) {
              RadFalsch++;
            }
          }

          if (RadFalsch == 0) {
            for (var k = 0; k < Inp.length; k++) {
              var Gruppe = Inp[k].getAttribute("name");
              if (RadioGruppen[j] == Gruppe) {
                if (Gruppe.search(/Radio/) != -1) {
                  Inp[k].nextSibling.innerHTML = "&#128269;";
                }
                if (Gruppe.search(/radio/) != -1) {
                  Inp[k].previousSibling.innerHTML = "&#128270;";
                }
              }
            }
          } else {
            for (var k = 0; k < Inp.length; k++) {
              var Gruppe = Inp[k].getAttribute("name");
              if (RadioGruppen[j] == Gruppe) {
                if (Gruppe.search(/Radio/) != -1) {
                  Inp[k].nextSibling.innerHTML = "";
                }
                if (Gruppe.search(/radio/) != -1) {
                  Inp[k].previousSibling.innerHTML = "";
                }
              }
            }
          }
        }

        if (Inp[i].type == "checkbox") {
          var checkName = Inp[i].getAttribute("name");
          var ChBoFehler = 0;

          for (var j = 0; j < Inp.length; j++) {
            if (Inp[j].getAttribute("name") == checkName) {
              var ChBoWertIst = Inp[j].value;
              var ChBoChecked = Inp[j].checked;
              if (ChBoWertIst == 1 && ChBoChecked == false) {
                ChBoFehler++;
              }

              if (ChBoWertIst == 0 && ChBoChecked == true) {
                ChBoFehler++;
              }
            }
          }

          if (ChBoFehler > 0) {
            if (checkName.search(/checkboxc/) > -1) {
              Inp[i].previousSibling.innerHTML = "&#128270;";
            }
            if (checkName.search(/checkboxC/) > -1) {
              Inp[i].nextSibling.innerHTML = "&#128269;";
            }
            ChBoFehlerGes = 1;
            F++;
          }
          if (ChBoFehler == 0) {
            for (var j = 0; j < Inp.length; j++) {
              if (Inp[j].getAttribute("name") == checkName) {
                var ChBoWertIst = Inp[j].value;
                if (ChBoWertIst == 1) {
                  Inp[j].parentNode.style.backgroundImage = "none";
                  Inp[j].parentNode.style.backgroundColor = "#9f0";
                  Inp[j].style.color = "black";
                }
                Inp[j].disabled = true;
              }

              if (checkName.search(/checkboxc/) > -1) {
                Inp[i].previousSibling.innerHTML = "";
              }
              if (checkName.search(/checkboxC/) > -1) {
                Inp[i].nextSibling.innerHTML = "";
              }
            }
          }
        }

        if (Inp[i].type == "text" && Inp[i].className != "MulEvHaManInp") {
          var InpStil = Inp[i].getAttribute("data-style");
          var wertSoll = Inp[i]
            .getAttribute("data-Wert")
            .replace(/^\s+/g, "")
            .replace(/\s+$/g, "")
            .replace(/\s+/, " ");
          var wSA = wertSoll.split("|");
          if (InpStil == "zahl") {
            //Wenn Zahl
            WertIst = WertIst.replace(/,/, ".").replace(/\s/g, "");
          }
          for (var j = 0; j < wSA.length; j++) {
            if (InpStil == "zahl") {
              //Wenn Zahl
              wSA[j] = wSA[j].replace(/,/, ".");
              if (parseFloat(wSA[j]) == parseFloat(WertIst)) {
                Inp[i].disabled = true;
                InpIS.backgroundColor = "#9f0";
                InpIS.backgroundImage = "none";
                InpIS.color = "black";
              }
            } else {
              if (InpStil == "klein" || InpStil == "loesungklein") {
                if (wSA[j].toLowerCase() == WertIst.toLowerCase()) {
                  Inp[i].disabled = true;
                  Inp[i].value = wSA[j];
                  InpIS.backgroundColor = "#9f0";
                  InpIS.backgroundImage = "none";
                  InpIS.color = "black";
                }
              }

              if (InpStil == "gross" || InpStil == "loesunggross") {
                if (wSA[j] == WertIst) {
                  Inp[i].disabled = true;
                  InpIS.backgroundColor = "#9f0";
                  InpIS.backgroundImage = "none";
                  InpIS.color = "black";
                }
              }
            }
          }
          if (Inp[i].disabled != true) {
            InpIS.backgroundColor = "#f90";
            InpIS.backgroundImage = HgF;
            InpIS.backgroundSize = "8px 8px";
            InpIS.color = "black";
            F++;
          }
        }
      }

      // The math fields, answered as LaTeX and judged by the Compute Engine.
      var MatheFeld = document
        .getElementsByClassName("multievent")
        [classNr].getElementsByClassName("multiEvMathe");
      for (var i = 0; i < MatheFeld.length; i++) {
        var matheOk;
        if (MatheFeld[i].hasAttribute("data-luecken")) {
          // A formula with blanks: each blank is judged on its own and
          // marked by MathLive; a right one is locked.
          matheOk = await multievent.lueckenRichtig(MatheFeld[i]);
          if (matheOk === null) continue;
        } else {
          // Before MathLive has arrived, the field carries no value: not an
          // empty answer, but unwritable, and never counted as wrong.
          if (typeof MatheFeld[i].value != "string") continue;
          var matheIst = MatheFeld[i].value
            .replace(/^\s+/, "")
            .replace(/\s+$/, "");
          matheOk =
            matheIst != "" &&
            (await multievent.matheRichtig(
              matheIst,
              multievent.matheAlternativen(
                MatheFeld[i].getAttribute("data-Wert"),
              ),
            ));
        }
        var matheStil = MatheFeld[i].style;
        if (matheOk) {
          MatheFeld[i].readOnly = true;
          matheStil.backgroundColor = "#9f0";
          matheStil.backgroundImage = "none";
          matheStil.color = "black";
        } else {
          matheStil.backgroundColor = "#f90";
          matheStil.backgroundImage = HgF;
          matheStil.backgroundSize = "8px 8px";
          matheStil.color = "black";
          F++;
        }
      }

      if (ChBoFehlerGes > 0) {
        alert("Mindestens eine Checkbox dieses Bereichs ist falsch markiert.");
      }

      var SuchselTabelle = document
        .getElementsByClassName("multievent")
        [classNr].getElementsByClassName("MultiEvSuchTable");

      for (var k = 0; k < SuchselTabelle.length; k++) {
        var TabButton = SuchselTabelle[k].getElementsByTagName("button");
        var SuchselFehler = 0;
        for (var l = 0; l < TabButton.length; l++) {
          var markiertIst = TabButton[l].getAttribute("data-markiert");
          var richtig = TabButton[l].getAttribute("data-richtig");
          if (richtig == 0 && markiertIst == 1) {
            SuchselFehler = 1;
            F++;
          }
          if (richtig == 1 && markiertIst == 0) {
            F++;
          }
        }

        if (SuchselFehler == 0) {
          for (var l = 0; l < TabButton.length; l++) {
            var markiertIst = TabButton[l].getAttribute("data-markiert");
            var richtig = TabButton[l].getAttribute("data-richtig");
            if (markiertIst == 1 && richtig == 1) {
              TabButton[l].setAttribute("data-gewertet", "1");
              TabButton[l].style.backgroundColor = "#9f0";
              TabButton[l].style.fontWeight = "bold";
              TabButton[l].parentNode.style.backgroundColor = "#9f0";
              TabButton[l].style.border = "none";
            }
          }
        } else {
          alert(
            "Im Suchsel ist mindestens ein Buchstabe markiert, der nicht markiert sein darf.",
          );
        }

        var fehlendeRichtig = 0;

        for (var l = 0; l < TabButton.length; l++) {
          var markiertIst = TabButton[l].getAttribute("data-markiert");
          var richtig = TabButton[l].getAttribute("data-richtig");
          if (
            (markiertIst == 0 && richtig == 1) ||
            (markiertIst == 1 && richtig == 0)
          ) {
            fehlendeRichtig++;
          }
        }

        for (var l = 0; l < TabButton.length; l++) {
          if (fehlendeRichtig == 0) {
            TabButton[l].setAttribute("data-spielAus", "1");
          }
        }
      }

      document.getElementById("MultieventVersuche" + classNr).innerHTML =
        parseInt(
          document.getElementById("MultieventVersuche" + classNr).innerHTML,
        ) + 1;

      var HaMaAusw = document
        .getElementsByClassName("multievent")
        [classNr].getElementsByClassName("MulEvHaManInp");
      for (var k = 0; k < HaMaAusw.length; k++) {
        var HaMaFehler = HaMaAusw[k].getAttribute("data-Fehler");
        if (HaMaFehler == 1) {
          F++;
        }
      }
      multievent.gesamtwertung[classNr] = document.getElementById(
        "MultieventVersuche" + classNr,
      ).innerHTML;
      var HinweisRichtig = document
        .getElementsByClassName("multievent")
        [classNr].querySelectorAll(".Multieventhinweis[data-typ='richtig']");
      var HinweisFalsch = document
        .getElementsByClassName("multievent")
        [classNr].querySelectorAll(".Multieventhinweis[data-typ='falsch']");
      

      if (F == 0) {
        multievent.gewertet[classNr] = 1;
        document.getElementById(
          "MultieventVersuche" + classNr,
        ).style.fontWeight = "bold";
        document.getElementById("MuEvAuswButB" + classNr).style.border =
          "2px solid green";
        document.getElementById("MuEvAuswButB" + classNr).style.borderRadius =
          "5px";
        if (typeof HinweisFalsch[0] != "undefined") {
          for (var HF = 0; HF < HinweisFalsch.length; HF++) {
            HinweisFalsch[HF].style.display = "none";
          }
        }

        if (typeof HinweisRichtig[0] != "undefined") {
          for (var HR = 0; HR < HinweisRichtig.length; HR++) {
            HinweisRichtig[HR].style.display = "inline-block";
          }
        }
      } else {
        if (typeof HinweisFalsch[0] != "undefined") {
          for (var HF = 0; HF < HinweisFalsch.length; HF++) {
            HinweisFalsch[HF].style.display = "inline-block";
          }
        }
      }
    } else {
      var GesWert =
        "<table border='1' cellspacing='0' cellpadding='4' rules='all' align='center'><tr><td colspan='10' style='background-color:silver;'><button onclick='multievent.ErgAus();' style='color:red;border:1px solid #555;float:right;border-radius:3px;background-color:#ddd;cursor:pointer;'>X</button>Versuche</td></tr><tr>";
      var GW = multievent.gesamtwertung;
      var GesVersuche = 0;
      var min1Zaehler = 0;
      for (var i = 0; i < GW.length; i++) {
        if (min1Zaehler % 10 == 4) {
          var RahmenRechts = "3px double black";
        } else {
          var RahmenRechts = "1px solid black";
        }
        if (GW[i] == 0) {
          GesWert +=
            "<td style='border-right:" +
            RahmenRechts +
            "'><span style='color:#999;'>\u2717</span></td>";
        }
        if (GW[i] > 0) {
          if (i == classNr) {
            GesWert +=
              "<td style='background-color:#ffe680;border-right:" +
              RahmenRechts +
              "'><span style='color:#007000;font-weight:bold;'>" +
              GW[i] +
              "</span></td>";
          } else {
            if (multievent.gewertet[i] == 1) {
              GesWert +=
                "<td style='background-color:#ffe680;border-right:" +
                RahmenRechts +
                "'><span style='color:#000'>" +
                GW[i] +
                "</span></td>";
            } else {
              GesWert +=
                "<td style='border-right:" +
                RahmenRechts +
                "'><span style='color:#999'>" +
                GW[i] +
                "</span></td>";
            }
          }
          GesVersuche = parseInt(GesVersuche) + parseInt(GW[i]);
        }

        if (GW[i] != -1) {
          min1Zaehler++;
        }

        if (min1Zaehler % 10 == 0) {
          GesWert += "</tr><tr>";
        }
      }

      GesWert += "</tr></table>";

      GesWert = GesWert.replace(/,\s$/, "");
      var WertHier = document.getElementById(
        "MultieventVersuche" + classNr,
      ).innerHTML;
      document.getElementById("MultieventErgebnisse").innerHTML =
        "<div style='font-size:large;'>" + GesWert + "</div>";
      multievent.ErgAn();
    }
    
    // Save state after evaluation
    multievent.saveState(classNr);
  },
  ErgAus: function () {
    document.getElementById("MultieventErgebnisse").style.display = "none";
  },
  ErgAn: function () {
    document.getElementById("MultieventErgebnisse").style.display = "block";
  },
  gesamtwertung: [],
  gewertet: [],
  blende: function (BlID) {
    var Auge = document.getElementById(BlID);
    if (Auge.nextSibling.style.display == "table-cell") {
      Auge.nextSibling.style.display = "none";
    } else {
      Auge.nextSibling.style.display = "table-cell";
    }
  },
  suAn: function () {
    multievent.suAnAus = 1;
  },
  suAus: function () {
    multievent.suAnAus = 0;
    var SuBut = document.getElementsByClassName("MuEvSuBut");
    for (var i = 0; i < SuBut.length; i++) {
      SuBut[i].setAttribute("data-move", "1");
    }
  },
  suAnAus: 0,
  suchselAnAus: function (SuID) {
    var move = document.getElementById(SuID).getAttribute("data-move");
    if (multievent.suAnAus == 1 && move == 1) {
      var gewertet = document
        .getElementById(SuID)
        .getAttribute("data-gewertet");
      var spielAus = document
        .getElementById(SuID)
        .getAttribute("data-spielAus");

      if (gewertet == 0 && spielAus == 0) {
        var markiert = document
          .getElementById(SuID)
          .getAttribute("data-markiert");
        if (markiert == 0) {
          document.getElementById(SuID).style.outline = "3px dotted green";
          document.getElementById(SuID).style.outlineOffset = "-1px";
          document.getElementById(SuID).style.borderRadius = "3px";
          document.getElementById(SuID).setAttribute("data-markiert", "1");
        } else {
          document.getElementById(SuID).style.outline = "none";
          document.getElementById(SuID).style.borderRadius = "3px";
          document.getElementById(SuID).setAttribute("data-markiert", "0");
        }
      }
      document.getElementById(SuID).setAttribute("data-move", "0");
      
      // Save state after marking word search letters
      var clIndex = document.getElementById(SuID).closest(".multievent");
      if (clIndex) {
        var index = Array.from(document.getElementsByClassName("multievent")).indexOf(clIndex);
        multievent.saveState(index);
      }
    }
  },
  tastensprung: function (Kennung, Wert) {
    if (Wert != "") {
      var kennungAlt = Kennung;
      var kennung = Kennung.split("-");

      var untenMoeglich = 0;
      var rechtsMoeglich = 0;

      var obenBuchstabe = 0;
      var untenBuchstabe = 0;
      var linksBuchstabe = 0;
      var rechtsBuchstabe = 0;

      var kSollUnten =
        kennung[0] + "-" + (parseInt(kennung[1]) + 1) + "-" + kennung[2];
      var kSollRechts =
        kennung[0] + "-" + kennung[1] + "-" + (parseInt(kennung[2]) + 1);

      var kSollOben =
        kennung[0] + "-" + (parseInt(kennung[1]) - 1) + "-" + kennung[2];
      var kSollLinks =
        kennung[0] + "-" + kennung[1] + "-" + (parseInt(kennung[2]) - 1);

      var Multi = document.getElementsByClassName("multievent")[kennung[0]];
      var Inp = Multi.getElementsByTagName("input");

      for (var i = 0; i < Inp.length; i++) {
        var Sprungmarke = Inp[i].getAttribute("data-sprungmarke");

        if (Sprungmarke == kennungAlt) {
          Inp[i].value = Inp[i].value.toUpperCase();
        }

        if (kSollUnten == Sprungmarke) {
          untenMoeglich = 1;

          var WertUnBu = Inp[i].value.length;
          if (WertUnBu > 0) {
            untenBuchstabe = 1;
          }
        }

        if (kSollRechts == Sprungmarke) {
          rechtsMoeglich = 1;
          var WertReBu = Inp[i].value.length;
          if (WertReBu > 0) {
            rechtsBuchstabe = 1;
          }
        }

        if (kSollOben == Sprungmarke) {
          var WertObBu = Inp[i].value.length;
          if (WertObBu > 0) {
            obenBuchstabe = 1;
          }
        }

        if (kSollLinks == Sprungmarke) {
          var WertLiBu = Inp[i].value.length;
          if (WertLiBu > 0) {
            linksBuchstabe = 1;
          }
        }
      }

      var Sprungziel = kennungAlt;

      if (rechtsMoeglich == 1) {
        Sprungziel = kSollRechts;
      }

      if (untenMoeglich == 1) {
        if (rechtsMoeglich == 0) {
          Sprungziel = kSollUnten;
        }

        if (rechtsBuchstabe == 1) {
          Sprungziel = kSollUnten;
        }

        if (linksBuchstabe == 0 && untenBuchstabe == 0) {
          Sprungziel = kSollUnten;
        }
      }

      for (var i = 0; i < Inp.length; i++) {
        var Sprungmarke = Inp[i].getAttribute("data-sprungmarke");
        if (Sprungmarke == Sprungziel) {
          Inp[i].focus();
        }
      }
    }
  },
  MulEvHaMan: function (ManID) {
    var AusgID = ManID.replace(/I_/, "A_");
    var FehlerID = ManID.replace(/I_/, "F_");
    var WertIstAlt = document.getElementById(ManID).value.toUpperCase();
    var WertIst = WertIstAlt.substring(
      WertIstAlt.length - 1,
      WertIstAlt.length,
    );
    document.getElementById(ManID).value = WertIst;
    var BuchstabenSind = document
      .getElementById(ManID)
      .getAttribute("data-BuchstSind")
      .toUpperCase();
    var WerteArr = document
      .getElementById(ManID)
      .getAttribute("data-MulEvHaMan")
      .split("|");
    var WerteNr = document.getElementById(ManID).getAttribute("data-Nummer");
    var BegriffeSind = document
      .getElementById(ManID)
      .getAttribute("data-BegriffeSind");
    var WerteSoll = WerteArr[WerteNr].toUpperCase();
    var Ausgabe = "";

    if (
      WertIst.search(/[A-Za-z1-9ÄÖÜäöüß]/) != -1 &&
      WerteSoll.search(WertIst) != -1
    ) {
      BuchstabenSind = (BuchstabenSind.replace(WertIst, "") + "~" + WertIst)
        .replace(/^~/, "")
        .replace(/~~/g, "~");
      document
        .getElementById(ManID)
        .setAttribute("data-BuchstSind", BuchstabenSind);
      var BuchstabenSindArr = BuchstabenSind.split("~");
      var Ausgabe = "";
      var vollstaendig = WerteSoll;
      for (var i = 0; i < WerteSoll.length; i++) {
        var BuchstAkt = WerteSoll.substring(i, i + 1);
        var vorhanden = 0;
        for (var j = 0; j < BuchstabenSindArr.length; j++) {
          if (BuchstAkt == BuchstabenSindArr[j]) {
            vorhanden = 1;
            vollstaendig = vollstaendig.replace(BuchstabenSindArr[j], "");
          }
        }
        if (vorhanden == 1) {
          Ausgabe = Ausgabe + BuchstAkt;
        } else {
          Ausgabe = Ausgabe + "<span style='color:#555'>&diams;</span>";
        }
      }

      document.getElementById(AusgID).innerHTML = BegriffeSind + Ausgabe;

      if (vollstaendig.length == 0) {
        document.getElementById(FehlerID).innerHTML = "";
        if (WerteNr < WerteArr.length - 1) {
          document
            .getElementById(ManID)
            .setAttribute(
              "data-BegriffeSind",
              BegriffeSind + WerteSoll + "<br />",
            );
          BegriffeSind = document
            .getElementById(ManID)
            .getAttribute("data-BegriffeSind");

          WerteNr++;
          document.getElementById(ManID).setAttribute("data-BuchstSind", "");
          document.getElementById(ManID).setAttribute("data-Nummer", WerteNr);

          BegrAusg = "";
          for (var j = 0; j < WerteArr[WerteNr].length; j++) {
            BegrAusg += "<span style='color:#555'>&diams;</span>";
          }
          document.getElementById(AusgID).innerHTML = BegriffeSind + BegrAusg;
        } else {
          document.getElementById(AusgID).innerHTML = document
            .getElementById(AusgID)
            .innerHTML.replace(/\s/g, "");
          document.getElementById(ManID).setAttribute("data-Fehler", "0");
          document.getElementById(FehlerID).style.textDecoration = "none";
          document.getElementById(FehlerID).innerHTML = "Ende";
          document.getElementById(ManID).value = "";
          document.getElementById(ManID).blur();
          document.getElementById(ManID).disabled = true;
        }
      }
    } else {
      var FehlerBuchstaben = document.getElementById(FehlerID).innerHTML;
      FehlerBuchstaben = (
        FehlerBuchstaben.replace(", " + WertIst, "") +
        ", " +
        WertIst
      ).replace(/^\s*,\s/, "");
      document.getElementById(FehlerID).innerHTML = FehlerBuchstaben;
    }
  },
};

window.addEventListener("mousedown", multievent.suAn);
window.addEventListener("mouseup", multievent.suAus);
window.addEventListener("load", multievent.init);
