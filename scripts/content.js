// Example: Injecting a script into the page
console.log("Content script injected");

const interactiveElements = [];
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
          chrome.runtime.sendMessage({ action: "fetch_completion", data: {completionContext: completionContext, incompleteText: newValue } }, (response) => {
            if (chrome.runtime.lastError) {
              console.error(chrome.runtime.lastError);
              return;
            }
            console.log("Content script: fetch_completion message received:", response, "response.suggestions:", response.suggestions);
            if (response && response.suggestions) {
                suggestedText = response.suggestions;
                console.log("Content script: suggestedText:", suggestedText);
                displaySuggestion(event.target, suggestedText[selectedSuggestion], pTaginEditableDiv);
            } else {
              console.error("Content script: No suggestions received or an error occurred.");
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
        clearSuggestion(event.target);
        suggestedText = [];
      } else if (event.key === "ArrowDown") { 
        if (suggestedText.length > 0) {
          event.preventDefault(); // Prevent default tab behavior (focus change)
          selectedSuggestion = (selectedSuggestion + 1) % suggestedText.length;
          displaySuggestion(event.target, suggestedText[selectedSuggestion], pTaginEditableDiv);
        }
      } else if (event.key === "ArrowUp") {
        if (suggestedText.length > 0) {
          event.preventDefault(); // Prevent default tab behavior (focus change)
          selectedSuggestion = (selectedSuggestion - 1 + suggestedText.length) % suggestedText.length;
          displaySuggestion(event.target, suggestedText[selectedSuggestion], pTaginEditableDiv);
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

// Helper functions to display and clear the suggestion:
function displaySuggestion(element, suggestion, pTaginEditableDiv) {
  console.log("element:", element, "Suggested text:", suggestion);
  console.log("window.getComputedStyle(element).position:", window.getComputedStyle(element).position);

  let suggestionSpan = element.nextElementSibling; // Check if span already exists

    if (!suggestionSpan || !suggestionSpan.classList.contains("suggestion")) {
        suggestionSpan = document.createElement("span");
        suggestionSpan.classList.add("suggestion"); // Add class for easy selection
        // If the contenteditable div has a p tag, suggestionSpan should be inserted within the p tag 
        if (pTaginEditableDiv) {
          pTaginEditableDiv.appendChild(suggestionSpan);
        } else {
          element.parentNode.insertBefore(suggestionSpan, element.nextSibling); // Insert after the element
        }
    }

    suggestionSpan.textContent = suggestion;
    
    // Position the suggestionSpan
    const cursorPosition = getCursorPosition(element);
    element.style.position = "relative"; // will this mess up existing styles?
    suggestionSpan.style.left = `${cursorPosition}px`;
    console.log("window.getComputedStyle(element).position:", window.getComputedStyle(element).position, "Cursor position:", cursorPosition);

    // Apply styles to match the element (example)
    suggestionSpan.style.fontSize = window.getComputedStyle(element).fontSize;
    suggestionSpan.style.padding = window.getComputedStyle(element).padding;
    suggestionSpan.style.fontFamily = window.getComputedStyle(element).fontFamily;
    suggestionSpan.style.position = "absolute";
    suggestionSpan.style.color = "gray";
}

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
}

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
