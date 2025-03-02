document.getElementById('save-api-key').addEventListener('click', () => {
  const apiKey = document.getElementById('api-key').value;
  if (apiKey) {
    chrome.storage.local.set({ apiKey: apiKey }, () => {
      if (chrome.runtime.lastError) {
        console.error('Error saving API key:', chrome.runtime.lastError);
      } else {
        console.log('API key saved successfully.');
      }
    });
  }
});

let apiKey = "";
chrome.storage.local.get(["apiKey"], (result) => {
    apiKey = result.apiKey;
    if (!apiKey) {
      //console.log("Options script - API key not found.");
    } else {
      //console.log("Options script - API key found.");
      document.getElementById('api-key').value = apiKey;
    }
  });