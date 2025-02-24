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