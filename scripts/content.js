chrome.storage.local.set({ debugMode: false });

function debugLog(...args) {
    chrome.storage.local.get("debugMode", (data) => {
        if (data.debugMode) {
            console.log(...args);
        }
    });
}

let suggestionSpan = null;
const DEBOUNCE_DELAY = 1500;

// Initialize the array with elements found in the initial DOM
addEventListeners(document.querySelectorAll('input[type="text"], input[type="search"], textarea, div[contenteditable="true"]'));

// Function to add elements to the array (helps with the MutationObserver)

function addEventListeners(elements) {
  let timeoutId;
  // add listeners to the elements
  elements.forEach(el => {
    let suggestedText = [];
    let selectedSuggestion = 0;

    el.addEventListener('input', (event) => { 
      clearTimeout(timeoutId); // Clear any previous timeout
      
      timeoutId = setTimeout(() => {
        // Get the value of the input
        let newValue = "";
        debugLog("el.tagName:", el.tagName);

        if (el.tagName.toLowerCase() === 'input' || el.tagName.toLowerCase() === 'textarea') {
          newValue = event.target.value;
        } else if (el.tagName.toLowerCase() === 'div' && el.hasAttribute('contenteditable')) {
          const pTagInDiv = el.querySelector('p');
          if (!pTagInDiv) {
            newValue = event.target.textContent;
          } else {
            return;
          }
        }
        debugLog("Content script - input event:", event, "event.target:", event.target, "newValue:", newValue, "el.tagName:", el.tagName);
        
        //let completionContext = getMetaTags();
        let completionContext = extractContext(el);
        debugLog("Content script - completionContext:", completionContext);

        // Display the suggested text only if user input is longer than 10 characters
        if (newValue !== "" && newValue.length > 10) {
          let openRouterApiKey = "";
          chrome.storage.local.get(["apiKey"], (result) => {
          openRouterApiKey = result.apiKey;
            if (!openRouterApiKey) {
              debugLog("Content script - API key not found.");
            } else {

              chrome.runtime.sendMessage({ action: "fetch_completion", data: {completionContext: completionContext, incompleteText: newValue, apiKey: openRouterApiKey} }, (response) => {
                if (chrome.runtime.lastError) {
                  console.error(chrome.runtime.lastError);
                  return;
                }

                debugLog("Content script: fetch_completion message received:", response, "response.suggestions:", response.suggestions);

                if (response && response.suggestions) {
                    suggestedText = response.suggestions;
                    debugLog("Content script: suggestedText:", suggestedText);
                    displaySuggestion(event.target, suggestedText[selectedSuggestion]);
                } else {
                  debugLog("Content script: No suggestions received or an error occurred.");
                }
            });
            }
          });
        }
      }, DEBOUNCE_DELAY);

    }); // end of addEventListener for input

    el.addEventListener('keydown', (event) => { // Listen for keydown
      if (event.key === "Escape") {
        clearSuggestion();
        suggestedText = [];
        return;
      } 
      if (suggestedText.length > 0)  {
        if (event.key === "Tab") {
          event.preventDefault(); 
          insertAutocomplete(event.target, suggestedText[selectedSuggestion]);
          suggestedText = []; // Clear suggestion after insertion
          clearSuggestion();
        } else if (event.key === "ArrowDown") { 
          event.preventDefault(); 
          selectedSuggestion = (selectedSuggestion + 1) % suggestedText.length;
          displaySuggestion(event.target, suggestedText[selectedSuggestion]); 
        } else if (event.key === "ArrowUp") {
          event.preventDefault(); 
          selectedSuggestion = (selectedSuggestion - 1 + suggestedText.length) % suggestedText.length;
          displaySuggestion(event.target, suggestedText[selectedSuggestion]);
        }
      }
    }); // end of addEventListener for keydown
  });
} // end of addEventListeners()

// Set up a MutationObserver to watch for changes to the DOM
const observer = new MutationObserver(mutations => {
  mutations.forEach(mutation => {
    mutation.addedNodes.forEach(node => {
      if (node.nodeType === 1) { // Check if it's an element node (not text, etc.)
        if (node.matches('input[type="text"], textarea, div[contenteditable="true"]')) {
          debugLog('Found new node:', node, "Node type: ", node.nodeType);
          addEventListeners([node]);
        }
      }
    });
  });
});

// Observe the entire document for changes
observer.observe(document.body, { childList: true, subtree: true });

function displaySuggestion(element, suggestion) {
  suggestionSpan = document.querySelector('[data-extension-suggestion]');

  if (!suggestionSpan) {
    suggestionSpan = document.createElement("span");
    suggestionSpan.setAttribute("data-extension-suggestion", "true");
    suggestionSpan.style.position = "absolute";
    suggestionSpan.style.color = "gray"; // Styling for suggestion text
    suggestionSpan.style.pointerEvents = "none"; // Ensure it doesn't interfere with typing
    suggestionSpan.style.whiteSpace = "pre";
    suggestionSpan.style.visibility = "hidden"; // Initially hidden
    document.body.appendChild(suggestionSpan);
    debugLog("Created suggestionSpan:", suggestionSpan);
  } else {
    debugLog("suggestionSpan already exists:", suggestionSpan);
  }

  if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
    positionSuggestionForInput(element, suggestion, suggestionSpan);
  } else if (element.tagName === 'DIV' && element.hasAttribute('contenteditable')) {
    positionSuggestionForContentEditable(element, suggestion, suggestionSpan);
  }
} // end of displaySuggestion()

// TODO ensure that span is always removed
function clearSuggestion() {
    if (suggestionSpan) {
      suggestionSpan.remove();
    }
}

function getCursorPosition(input) { 
  const { selectionStart } = input;
  if (selectionStart === null) return null;  
  
  
  const inputRect = input.getBoundingClientRect();
  const style = window.getComputedStyle(input);


  const mirror = document.createElement("div");
  mirror.style.position = "absolute";
  mirror.style.left = `${inputRect.left}px`;
  mirror.style.top = `${inputRect.top}px`; 
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.overflowWrap = "break-word";
  mirror.style.visibility = "hidden";
  mirror.style.overflow = "hidden";
  mirror.style.width = `${input.clientWidth}px`;

  // Copy the essential styles from the input
  ["fontFamily", "fontSize", "fontWeight", "letterSpacing", "wordSpacing", "lineHeight", "padding", "border", "width", "height"]
      .forEach(prop => mirror.style[prop] = style[prop]);

  // Copy text up to cursor position
  const textBeforeCursor = input.value.substring(0, input.selectionStart);
  mirror.textContent = textBeforeCursor;

  // Add marker to measure cursor position
  const marker = document.createElement("span");
  marker.textContent = "|";
  mirror.appendChild(marker);

  document.body.appendChild(mirror);

  const markerRect = marker.getBoundingClientRect();

  document.body.removeChild(mirror);

  return {
      left: markerRect.left + window.scrollX,
      top: markerRect.top + window.scrollY
  };
} // end of getCursorPosition()

function insertAutocomplete(element, autocompleteText) {
  //const position = getCursorPosition(element);
  const currentText = element.value || element.textContent; // Handle both input/textarea and contenteditable
  //const updatedText = currentText.substring(0, position) + autocompleteText + currentText.substring(position);
  const updatedText = currentText + autocompleteText;

  if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
    element.value = updatedText;
    element.selectionStart = element.selectionEnd = updatedText.length; // Set cursor after autocomplete
  } else { // contenteditable
    // TODO - any <p> tags inside the div are getting removed.
    element.textContent = updatedText;
    
    // Set cursor position in contenteditable (more complex, requires range)
    const range = document.createRange();
    const sel = window.getSelection();
    range.setStart(element.firstChild, updatedText.length) 
    range.collapse(true)
    sel.removeAllRanges();
    sel.addRange(range);
  }
}

// Function to position the suggestion span for input and textarea elements
function positionSuggestionForInput(input, suggestion, suggestionSpan) {
  if (!suggestionSpan) {
    debugLog("positionSuggestionForInput - suggestionSpan not found");
    return;
  }

  const pos = getCursorPosition(input);
    
    if (!pos) return;
    
    debugLog("positionSuggestionForInput - pos:", pos, "Input:", input);

    suggestionSpan.style.left = `${pos.left}px`;
    suggestionSpan.style.top = `${pos.top}px`;
    suggestionSpan.style.fontSize = window.getComputedStyle(input).fontSize;
    suggestionSpan.style.fontFamily = window.getComputedStyle(input).fontFamily;
    suggestionSpan.textContent = suggestion;
    suggestionSpan.style.visibility = "visible";
}

// Function to position the suggestion span inside a contenteditable div
function positionSuggestionForContentEditable(editableDiv, suggestion, suggestionSpan) {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    suggestionSpan.style.left = `${rect.left + window.scrollX}px`;
    suggestionSpan.style.top = `${rect.top + window.scrollY}px`;
    suggestionSpan.style.fontSize = window.getComputedStyle(editableDiv).fontSize;
    suggestionSpan.style.fontFamily = window.getComputedStyle(editableDiv).fontFamily;
    suggestionSpan.textContent = suggestion;
    suggestionSpan.style.visibility = "visible";
} // end of positionSuggestionForContentEditable()

function getMetaTags() {
  const metaTags = document.getElementsByTagName('meta');
  let metaString = '';

  for (let i = 0; i < metaTags.length; i++) {
    const meta = metaTags[i];
    const attributes = meta.attributes;

    for (let j = 0; j < attributes.length; j++) {
      const attribute = attributes[j];
      metaString += `${attribute.name}="${attribute.value}" `;
    }
    metaString += ' '; // Add a space between meta tags.
  }

  return metaString.trim(); // Remove trailing space
}

function extractContext(element) {
  debugLog("extractContext - element:", element);

  // if (!nodeList || nodeList.length === 0) {
  //   return ""; 
  // }

  let combinedContext = "";

  //const nodeListArray = Array.from(nodeList);
  //nodeListArray.forEach(element => {
    let context = "";

    // 1. Text around the element
    const range = document.createRange();
    range.selectNode(element);
    const surroundingText = range.cloneContents().textContent;

    let previousText = "";
    let nextText = "";

    if (element.previousSibling) {
      previousText = element.previousSibling.textContent;
    }
    if (element.nextSibling) {
      nextText = element.nextSibling.textContent;
    }
    
    debugLog("extractContext - previousText:", previousText, "surroundingText:", surroundingText, "nextText:", nextText);

    context += `Surrounding Text: ${previousText} ${surroundingText} ${nextText}\n`;

    // 2. Page title
    context += `Page Title: ${document.title}\n`;

    // 3. URL of the page
    context += `Page URL: ${window.location.href}\n`;

    // 4. Meta description
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      context += `Meta Description: ${metaDescription.getAttribute("content")}\n`;
    }

    // 5. Meta keywords
    const metaKeywords = document.querySelector('meta[name="keywords"]');
    if (metaKeywords) {
      context += `Meta Keywords: ${metaKeywords.getAttribute("content")}\n`;
    }

    // 6. Heading tags under which the element exists.
    let currentElement = element;
    const headings = [];

    while (currentElement && currentElement !== document.body) {
      if (currentElement.tagName && currentElement.tagName.startsWith('H')) {
        headings.unshift(currentElement.textContent);
      }
      currentElement = currentElement.parentElement;
    }

    if (headings.length > 0) {
      context += `Headings: ${headings.join(" > ")}\n`;
    }

    combinedContext += context + "\n---\n"; // Separate context for each element
  //});

  return combinedContext;
} // end of extractContext()
