// Safari Web Annotator - Background Service Worker

// When the toolbar action button is clicked
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { action: "toggle-toolbar" });
  } catch (err) {
    // If content script is not yet injected or cannot be reached
    console.warn("Could not send toggle-toolbar message:", err);
  }
});

// When registered keyboard shortcuts are pressed
chrome.commands.onCommand.addListener(async (command, tab) => {
  const targetTab = tab || (await getActiveTab());
  if (!targetTab || !targetTab.id) return;

  try {
    if (command === "_execute_action") {
      await chrome.tabs.sendMessage(targetTab.id, { action: "toggle-toolbar" });
    } else {
      await chrome.tabs.sendMessage(targetTab.id, { action: command });
    }
  } catch (err) {
    console.warn(`Could not dispatch command ${command}:`, err);
  }
});

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs && tabs.length > 0 ? tabs[0] : null;
}
