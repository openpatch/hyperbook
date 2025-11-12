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
    var hinweisRichtig = SK.getElementsByClassName("MultieventhinweisRichtig" + clNr);
    state.hinweisRichtig = [];
    for (var i = 0; i < hinweisRichtig.length; i++) {
      state.hinweisRichtig.push({
        display: hinweisRichtig[i].style.display
      });
    }
    
    var hinweisFalsch = SK.getElementsByClassName("MultieventhinweisFalsch" + clNr);
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
    
    await store.multievent.put({
      id: "multievent_" + clNr + "_" + window.location.pathname,
      state: JSON.stringify(state)
    });
  },
  loadState: async function (clNr) {
    try {
      var record = await store.multievent.get("multievent_" + clNr + "_" + window.location.pathname);
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
        var hinweisRichtig = SK.getElementsByClassName("MultieventhinweisRichtig" + clNr);
        for (var i = 0; i < hinweisRichtig.length && i < state.hinweisRichtig.length; i++) {
          if (state.hinweisRichtig[i].display) {
            hinweisRichtig[i].style.display = state.hinweisRichtig[i].display;
          }
        }
      }
      
      if (state.hinweisFalsch) {
        var hinweisFalsch = SK.getElementsByClassName("MultieventhinweisFalsch" + clNr);
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
    var IN = multievent.orig[clNr]
      .replace(/\{(.)\{\s*/gms, "{$1{")
      .replace(/\s*\}\}/gms, "}}"); /*Inhal neu*/
    var InpCh = "<input type='checkbox' class='MECheckbox' value=";
    IN = IN.replace(
      /\{c(\d*?)\{!(.*?)\}\}/gms,
      "<span><span></span>" +
        InpCh +
        "'1' name='checkboxc" +
        clNr +
        "$1' /><label class='MeChLabel'>$2</label></span>",
    );
    IN = IN.replace(
      /\{c(\d*?)\{(.*?)\}\}/gms,
      "<span><span></span>" +
        InpCh +
        "'0' name='checkboxc" +
        clNr +
        "$1' /><label class='MeChLabel'>$2</label></span>",
    );
    IN = IN.replace(
      /\{C(\d*?)\{!(.*?)\}\}/gms,
      "<span><label class='MeChLabel'>$2</label>" +
        InpCh +
        "'1' name='checkboxC" +
        clNr +
        "$1' /><span></span></span>",
    );
    IN = IN.replace(
      /\{C(\d*?)\{(.*?)\}\}/gms,
      "<span><label class='MeChLabel'>$2</label>" +
        InpCh +
        "'0'  name='checkboxC" +
        clNr +
        "$1' /><span></span></span>",
    );
    IN = IN.replace(
      /\{k(\d*?)\{!(.*?)\}\}/gms,
      "<button class='butAnAus' style='border:1px solid silver;text-align:center;border-radius:3px;font-size:1em;font-weight:bold;' onclick='multievent.butAnAus(this.id)' value='1' data-gruppe='$1a' data-typ='0' data-wertIst='$2' data-markiert='0' data-gewertet='0' />$2</button><span></span>",
    );
    IN = IN.replace(
      /\{k(\d*?)\{(.*?)\}\}/gms,
      "<button class='butAnAus' style='border:1px solid silver;border-radius:3px;text-align:center;font-size:1em;font-weight:bold;' onclick='multievent.butAnAus(this.id)' value='0' data-gruppe='$1a' data-typ='0' data-wertIst='$2' data-markiert='0' data-gewertet='0'/>$2</button><span></span>",
    );
    IN = IN.replace(
      /\{K(\d*?)\{!(.*?)\}\}/gms,
      "<button class='butAnAus' style='border:1px solid silver;border-radius:3px;text-align:center;font-size:1em;font-weight:bold;' onclick='multievent.butAnAus(this.id)' value='1' data-gruppe='$1b' data-typ='1' data-wertIst='$2' data-markiert='0' data-gewertet='0' />$2</button><span></span>",
    );
    IN = IN.replace(
      /\{K(\d*?)\{(.*?)\}\}/gms,
      "<button class='butAnAus' style='border:1px solid silver;border-radius:3px;text-align:center;font-size:1em;font-weight:bold;' onclick='multievent.butAnAus(this.id)' value='0' data-gruppe='$1b' data-typ='1' data-wertIst='$2' data-markiert='0'  data-gewertet='0'/>$2</button><span></span>",
    );
    var InpRa = "<input type='radio' class='MERadio' value=";
    IN = IN.replace(
      /\{r(\d*?)\{!(.*?)\}\}/gms,
      "<span><span></span>" +
        InpRa +
        "'1' name='radio" +
        clNr +
        "$1'/><label class='MeRaLabel'>$2</label></span>",
    );
    IN = IN.replace(
      /\{r(\d*?)\{(.*?)\}\}/gms,
      "<span><span></span>" +
        InpRa +
        "'0' name='radio" +
        clNr +
        "$1' /><label class='MeRaLabel'>$2</label></span>",
    );
    IN = IN.replace(
      /\{R(\d*?)\{!(.*?)\}\}/gms,
      "<span><label class='MeRaLabel'>$2</label>" +
        InpRa +
        "'1' name='Radio" +
        clNr +
        "$1'/><span></span></span>",
    );
    IN = IN.replace(
      /\{R(\d*?)\{(.*?)\}\}/gms,
      "<span><label class='MeRaLabel'>$2</label>" +
        InpRa +
        "'0' name='Radio" +
        clNr +
        "$1' /><span></span></span>",
    );
    var InpT =
      "<input class='multiEvInp' style='text-align:center;font-size:1em;font-weight:bold;' type='text' value='' data-Wert='$1' data-style=";
    IN = IN.replace(/\{t\{(.*?)\}\}/gms, InpT + "'klein' />");
    IN = IN.replace(/\{T\{(.*?)\}\}/gms, InpT + "'gross' />");
    IN = IN.replace(
      /\{l\{(.*?)\}\}/gms,
      InpT +
        "'loesungklein' onfocus='if(this.value==this.getAttribute(\"data-gemischt\")){this.value=\"\"}' onblur='multievent.inpGemEing(this.value,this.id)'   />",
    );
    IN = IN.replace(
      /\{L\{(.*?)\}\}/gms,
      InpT +
        "'loesunggross' onfocus='if(this.value==this.getAttribute(\"data-gemischt\")){this.value=\"\"}' onblur='multievent.inpGemEing(this.value,this.id)' />",
    );
    IN = IN.replace(/\{z\{(.*?)\}\}/gms, InpT + "'zahl'/>");
    var InpYZ =
      "<input class='multiEvInpYZ' style='text-align:center;font-size:1em;font-weight:bold;' type='text' value='' data-wk='$1' data-style=";
    IN = IN.replace(/\{Z\{(.*?)\}\}/gms, InpYZ + "'zahl'/>");
    IN = IN.replace(/\{Y\{(.*?)\}\}/gms, InpYZ + "'gross'/>");
    IN = IN.replace(/\{y\{(.*?)\}\}/gms, InpYZ + "'klein'/>");
    IN = IN.replace(
      /\{X\{(.*?)\}\}/gms,
      "<span class='multiEvSpanY' data-wk='$1'></span>",
    );
    IN = IN.replace(
      /\{b\{(.*?)\}\}/gms,
      "<table cellpadding='0' cellspacing='0' style='border-collapse:collapse;'><tr><td class='multieventBlende' onclick='multievent.blende(this.id)' style='cursor:pointer;' valign='top'>&#128065;</td><td style='display:none;'>$1</td></tr></table>",
    );
    IN = IN.replace(
      /\{B\{(.*?)\}\}/gms,
      "<table cellpadding='0' cellspacing='0' style='border-collapse:collapse;'><tr><td class='multieventBlende' onclick='multievent.blende(this.id)' style='cursor:pointer;' valign='top'>&#128065;</td><td style='display:none;'>$1</td></tr></table>",
    );
    IN = IN.replace(
      /\{n\{(.*?)\|\s*(\d+?)\s*\}\}/gms,
      "<textarea style='width:$1px; height:$2px'></textarea>",
    );
    IN = IN.replace(
      /\{n\{(.*?)\|(.*?)\|(.*?)\}\}/gms,
      "<textarea style='width:$1px; height:$2px'>$3</textarea>",
    );
    IN = IN.replace(
      /\{h\{(.*?)\}\}/gms,
      "<span class='MultieventhinweisFalsch" +
        clNr +
        "' style='display:none'>$1</span>",
    ); //Hinweis wenn Auswertung falsch
    IN = IN.replace(
      /\{H\{(.*?)\}\}/gms,
      "<span class='MultieventhinweisRichtig" +
        clNr +
        "' style='display:none'>$1</span>",
    ); //Hinweis wenn Auswertung richtig
    IN = IN.replace(
      /\{v\{(.*?)\}\}/gms,
      "<table align='center' class='MulEvHaManTab' style='border-collapse:collapse;' border='0' cellspacing='0' cellpadding='6'><tr><td  valign='middle' align='center' style='min-width:10em;font-family:sans-serif;' class='MulEvHaManTd'><span class='MulEvHaManAusg'>$1</span></td></tr><tr><td align='center' ><span class='MulEvHaManFehl' style='text-decoration:line-through;color:#e00;font-size:smaller;font-family:sans-serif;'> </span><br /></td></tr><tr><td align='center'><input maxlength='2' onkeydown='this.value=\"\"' onkeyup='multievent.MulEvHaMan(this.id);multievent.Auswertung(\"" +
        clNr +
        "\")' class='MulEvHaManInp' data-MulEvHaMan='$1' data-Nummer='0' data-BuchstSind='' data-Fehler='1' data-BegriffeSind='' style='text-align:center;font-size:1em;width:1.5em;font-family:sans-serif;padding:2px;border:1px solid #999;border-radius:3px;background-color:#eee;'/></td></tr></table>",
    );
    IN = IN.replace(
      /\{w\{(.*?)\}\}/gms,
      "<table align='center' class='MultiEvSuchTable' style='border-collapse:collapse;' border='0' cellspacing='0'><tr><td  height='28' width='28' valign='middle' align='center' class='MultiEvSuchTd'>$1</td></tr></table>",
    );
    IN = IN.replace(
      /\{W\{(.*?)\}\}/gms,
      "<table align='center' class='MultiKwrTable' style='border-collapse:collapse' border='0' cellspacing='0'><tr class='MultiKwrTr'><td  height='28' width='28' valign='middle' align='center' class='MultiKwrTd'>$1</td></tr></table>",
    );

    var SelO = "";
    IN = IN.replace(
      /\{a\{(.+?)\|(.+?)\}\}/gms,
      "<select class='multiEvSel' style='text-align:center;font-size:1em;font-weight:bold;'><option value='0'>$1|$2</select>",
    );
    IN = IN.replace(
      /\{A\{(.+?)\|(.+?)\}\}/gms,
      "<select class='multiEvSel' style='text-align:center;font-size:1em;font-weight:bold;'><option value='0'></option><option value='0'>$1|$2</select>",
    );

    IN = IN.replace(
      /\{S(\d*?)\{(.*?)\}\}/gms,
      "<select  class='multiEvSel' style='text-align:center;font-size:1em;font-weight:bold;' data-wertIst='$2' data-SelNr='" +
        clNr +
        "$1'><option>" +
        clNr +
        "$1-$2</option></select>",
    );
    SK[clNr].innerHTML =
      IN +
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
      MuSuTable.length == 0
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
          var s = Inp[j].style;
          if (IB < iW[k].length) {
            IB = iW[k].length;
          }
          if (IB <= 1) {
            s.width = "1.2em";
          }
          if (IB == 2) {
            s.width = "1.8em";
          }
          if (IB == 3) {
            s.width = "2.3em";
          }
          if (IB == 4) {
            s.width = "3.2em";
          }
          if (IB > 4) {
            s.width = IB * 0.75 + "em";
          }
        }
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
  },
  inpGemEing: function (WertIst, GemID) {
    var vIst = WertIst.replace(/\s/g, "");
    var wertGem = document.getElementById(GemID).getAttribute("data-gemischt");
    if (vIst == "") {
      document.getElementById(GemID).value = wertGem;
    }
  },
  Auswertung: function (classNr) {
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
      var HinweisRichtig = document.getElementsByClassName(
        "MultieventhinweisRichtig" + classNr,
      );
      var HinweisFalsch = document.getElementsByClassName(
        "MultieventhinweisFalsch" + classNr,
      );

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
