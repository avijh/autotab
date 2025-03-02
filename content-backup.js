// Example: Injecting a script into the page
let interactiveElements = [];
const DEBOUNCE_DELAY = 500;


// Function to add elements to the array (helps with the MutationObserver)
function addEventListeners(elements) {
  let timeoutId;
  let pTaginEditableDiv;
  elements.forEach(el => {
    interactiveElements.push(el);
    //el.style.border = "2px solid blue"; // Stytling to identify elements for testing.
  });
  
  // add listeners to the elements
  elements.forEach(el => {
    let suggestedText = [];
    let selectedSuggestion = 0;

    console.log("Adding listeners to:", el);

    el.addEventListener('input', (event) => {
      //console.log("Content script - input event:", event, "event.target:", event.target);
      clearTimeout(timeoutId); // Clear any previous timeout
      
      timeoutId = setTimeout(() => {
        // Get the value of the input
        let newValue = "";
        if (el.tagName.toLowerCase() === 'input' || el.tagName.toLowerCase() === 'textarea') {
          newValue = event.target.value;
        } else if (el.tagName.toLowerCase() === 'div' && el.hasAttribute('contenteditable')) {
          pTaginEditableDiv = el.querySelector('p');
          console.log("Inside contenteditable div - event.target:", event.target, "event.target.parentNode:", event.target.parentNode, "pTaginEditableDiv:", pTaginEditableDiv);
          
          newValue = event.target.textContent; // use textContent for text and innerHTML for HTML
        }
        console.log("Content script - input event:", event, "event.target:", event.target, "newValue:", newValue, "el.tagName:", el.tagName);
        
        let completionContext = getMetaTags();
        console.log("Content script - completionContext:", completionContext);

        // Display the suggested text
        if (newValue !== "") {
          let openRouterApiKey = "";
          chrome.storage.local.get(["apiKey"], (result) => {
          openRouterApiKey = result.apiKey;
            if (!openRouterApiKey) {
              console.log("Content script - API key not found.");
            } else {
              console.log("Content script - API key:", openRouterApiKey);

              chrome.runtime.sendMessage({ action: "fetch_completion", data: {completionContext: completionContext, incompleteText: newValue, apiKey: openRouterApiKey} }, (response) => {
                if (chrome.runtime.lastError) {
                  console.error(chrome.runtime.lastError);
                  return;
                }

                console.log("Content script: fetch_completion message received:", response, "response.suggestions:", response.suggestions);

                if (response && response.suggestions) {
                    suggestedText = response.suggestions;
                    console.log("Content script: suggestedText:", suggestedText);
                    displaySuggestion(event.target, newValue, suggestedText[selectedSuggestion], pTaginEditableDiv);
                } else {
                  console.error("Content script: No suggestions received or an error occurred.");
                }
            });
            }
          });
        }
      }, DEBOUNCE_DELAY);

    }); // end of addEventListener for input

    el.addEventListener('keydown', (event) => { // Listen for keydown
      if (event.key === "Tab") {
        if (suggestedText.length > 0)  {
          event.preventDefault(); // Prevent default tab behavior (focus change)
          insertAutocomplete(event.target, suggestedText[selectedSuggestion], pTaginEditableDiv);
          suggestedText = []; // Clear suggestion after insertion
          clearSuggestion(event.target);
        }
      } else if (event.key === "Escape") {
        clearSuggestion(event.target); // TODO
        suggestedText = [];
      } else if (event.key === "ArrowDown") { 
        if (suggestedText.length > 0) {
          event.preventDefault(); // Prevent default tab behavior (focus change)
          selectedSuggestion = (selectedSuggestion + 1) % suggestedText.length;
          displaySuggestion(event.target, newValue, suggestedText[selectedSuggestion], pTaginEditableDiv);
        }
      } else if (event.key === "ArrowUp") {
        if (suggestedText.length > 0) {
          event.preventDefault(); // Prevent default tab behavior (focus change)
          selectedSuggestion = (selectedSuggestion - 1 + suggestedText.length) % suggestedText.length;
          displaySuggestion(event.target, newValue, suggestedText[selectedSuggestion], pTaginEditableDiv);
        }
      }
    }); // end of addEventListener for keydown

  });
} // end of addEventListeners()

// Initialize the array with elements found in the initial DOM
addEventListeners(document.querySelectorAll(['input[type="text"]', 'textarea', 'div[contenteditable="true"]', 'div[contenteditable="true"] p']));

// Set up a MutationObserver to watch for changes to the DOM
const observer = new MutationObserver(mutations => {
  mutations.forEach(mutation => {
    mutation.addedNodes.forEach(node => {
      //console.log("mutation.addedNodes:", mutation.addedNodes);
      if (node.nodeType === 1) { // Check if it's an element node (not text, etc.)
        if (node.matches('input[type="text"], textarea, div[contenteditable="true"]')) {
          console.log('Found new node:', node, "Node type: ", node.nodeType);
          addEventListeners([node]);
        } /*else {
          const descendants = node.querySelectorAll('input[type="text"], textarea, [contenteditable="true"]');
          console.log('Found new descendants:', descendants, "descendants.length:", descendants.length);
          addEventListeners(descendants);
        } */
      }
    });
  });
  //console.log("interactiveElements - after mutation:", interactiveElements, "interactiveElements.length:", interactiveElements.length);
});

// Observe the entire document for changes
observer.observe(document.body, { childList: true, subtree: true });

function displaySuggestion(element, newValue, suggestion, pTaginEditableDiv) {
    let suggestionSpan = document.createElement("span");
    
    suggestionSpan.style.position = "absolute";
    suggestionSpan.style.color = "gray"; // Styling for suggestion text
    suggestionSpan.style.pointerEvents = "none"; // Ensure it doesn't interfere with typing
    suggestionSpan.style.whiteSpace = "pre";
    suggestionSpan.style.visibility = "hidden"; // Initially hidden
    document.body.appendChild(suggestionSpan);

    console.log("Created suggestionSpan:", suggestionSpan);

  if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
    positionSuggestionForInput(element, suggestion, suggestionSpan);
  } else if (element.tagName === 'DIV' && element.hasAttribute('contenteditable')) {
    positionSuggestionForContentEditable(element, suggestion, suggestionSpan);
  }
} // end of displaySuggestion()



// TODO ensure that span is always removed
function clearSuggestion(element) {
    const suggestionSpan = element.nextElementSibling;
    if (suggestionSpan && suggestionSpan.classList.contains("suggestion")) {
      suggestionSpan.remove();
    }
}

// Function to get the cursor position (cross-browser compatible)
function getCursorPosition(element) {
  if (element.selectionStart || element.selectionStart === 0) { // For <input> and <textarea>
    return element.selectionStart;
  } else if (window.getSelection) { // For contenteditable elements
    const sel = window.getSelection();
    if (sel.getRangeAt && sel.rangeCount) {
      const range = sel.getRangeAt(0);
      const preCaretRange = range.cloneRange();
      preCaretRange.selectNodeContents(element);
      preCaretRange.setEnd(range.startContainer, range.startOffset);
      return preCaretRange.toString().length;
    }
  }
  return 0; // Default to 0 if cursor position can't be determined
} //

function getCursorPosition2(input) { 
    const mirror = document.createElement("div");
    document.body.appendChild(mirror);

    const style = window.getComputedStyle(input);
    ["fontFamily", "fontSize", "fontWeight", "letterSpacing", "wordSpacing", "lineHeight", "padding", "border", "width", "height"]
        .forEach(prop => mirror.style[prop] = style[prop]);

    mirror.style.position = "absolute";
    mirror.style.whiteSpace = "pre-wrap";
    mirror.style.wordWrap = "break-word";
    mirror.style.visibility = "hidden";
    mirror.style.overflow = "hidden";

    // Copy text up to cursor position
    const text = input.value.substring(0, input.selectionStart);
    mirror.textContent = text;

    // Add marker to measure cursor position
    const marker = document.createElement("span");
    marker.textContent = "|";
    mirror.appendChild(marker);

    document.body.appendChild(mirror);
    const rect = marker.getBoundingClientRect();
    document.body.removeChild(mirror);

    return {
        left: rect.left + window.scrollX,
        top: rect.top + window.scrollY
    };
} // end of getCursorPosition2()

function insertAutocomplete(element, autocompleteText, pTaginEditableDiv) {
  const position = getCursorPosition(element);
  const currentText = element.value || element.textContent; // Handle both input/textarea and contenteditable
  const updatedText = currentText.substring(0, position) + autocompleteText + currentText.substring(position);

  if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
    element.value = updatedText;
    element.selectionStart = element.selectionEnd = position + autocompleteText.length; // Set cursor after autocomplete
  } else { // contenteditable
    element.textContent = updatedText;
    // Set cursor position in contenteditable (more complex, requires range)
    const range = document.createRange();
    const sel = window.getSelection();
    range.setStart(element.firstChild, position + autocompleteText.length) // Assumes text node
    range.collapse(true)
    sel.removeAllRanges();
    sel.addRange(range);
  }
}

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

// Function to position the suggestion span for input and textarea elements
function positionSuggestionForInput(input, suggestion, suggestionSpan) {
  if (!suggestionSpan) {
    console.log("positionSuggestionForInput - suggestionSpan not found");
    return;
  }

  const pos = getCursorPosition2(input);
    
    if (!pos) return;
    
    console.log("positionSuggestionForInput - pos:", pos, "Input:", input);

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
}

document.addEventListener("DOMContentLoaded", () => {
    suggestionSpan = document.createElement("span");
    
    suggestionSpan.style.position = "absolute";
    suggestionSpan.style.color = "gray"; // Styling for suggestion text
    suggestionSpan.style.pointerEvents = "none"; // Ensure it doesn't interfere with typing
    suggestionSpan.style.whiteSpace = "pre";
    suggestionSpan.style.visibility = "hidden"; // Initially hidden
    document.body.appendChild(suggestionSpan);
    console.log("Created suggestionSpan:", suggestionSpan);
});