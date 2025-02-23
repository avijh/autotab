document.getElementById('myButton').addEventListener('click', () => {
  // Your code here (e.g., interacting with the active tab, storage, etc.)
  console.log("chrome.tabs:", chrome.tabs);
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { message: "Hello from popup!" });
  });
});

document.getElementById('settings').addEventListener('click', function() {
    chrome.tabs.create({ url: 'options/options.html' });
});

// document.getElementById('findInteractiveElements').addEventListener('click', () => {
//     chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
//         chrome.tabs.sendMessage(tabs[0].id, { message: "findInteractiveElements" });
//     });
// });