document.getElementById('settings').addEventListener('click', function() {
    chrome.tabs.create({ url: 'options/options.html' });
});

document.addEventListener('DOMContentLoaded', function() {
  const toggleSwitch = document.getElementById('toggle-extension');

  chrome.management.getSelf(function(extensionInfo) {
    toggleSwitch.checked = extensionInfo.enabled;
    console.log("toggleSwitch.checked:", toggleSwitch.checked);
  });

  toggleSwitch.addEventListener('change', function() {
    chrome.management.getSelf(function(extensionInfo) {
      chrome.management.setEnabled(extensionInfo.id, toggleSwitch.checked);
      console.log("chrome.management.setEnabled:", toggleSwitch.checked);
    });
  });
});
