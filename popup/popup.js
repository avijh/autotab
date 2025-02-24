document.getElementById('settings').addEventListener('click', function() {
    chrome.tabs.create({ url: 'options/options.html' });
});