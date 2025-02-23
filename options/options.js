document.getElementById('saveButton').addEventListener('click', () => {
  const mySetting = document.getElementById('mySetting').value;

  // Save the setting to storage
  chrome.storage.local.set({ mySetting: mySetting }, () => {
    // Optionally, provide feedback to the user
    console.log('Settings saved');
    alert("Settings Saved!"); // Simple feedback
  });
});

// Load saved settings when the options page is opened
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get('mySetting', (data) => {
    const savedSetting = data.mySetting || "Default Value"; // Use default if not set
    document.getElementById('mySetting').value = savedSetting;
  });
});