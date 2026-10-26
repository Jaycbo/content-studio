let isRecording = false;
let targetTab = null;
let capturedEntries = [];

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.url.includes("tiktok.com")) return;

  if (!isRecording) {
    // START RECORDING
    targetTab = tab.id;
    await chrome.debugger.attach({ tabId: targetTab }, "1.3");
    await chrome.debugger.sendCommand({ tabId: targetTab }, "Network.enable");
    isRecording = true;
    capturedEntries = [];
    chrome.action.setBadgeText({ text: "REC" });
    chrome.action.setBadgeBackgroundColor({ color: "#FF0000" });
  } else {
    // STOP RECORDING & DOWNLOAD HAR
    await chrome.debugger.detach({ tabId: targetTab });
    isRecording = false;
    chrome.action.setBadgeText({ text: "" });

    const har = { log: { entries: capturedEntries } };
    const json = JSON.stringify(har);
    
    // Create base64 data URL for download
    const dataUrl = "data:application/json;base64," + btoa(unescape(encodeURIComponent(json)));

    chrome.downloads.download({
      url: dataUrl,
      filename: "tiktok-capture.har",
      saveAs: false
    });
  }
});

// Intercept only the video feeds in the background
chrome.debugger.onEvent.addListener(async (source, method, params) => {
  if (method === "Network.responseReceived") {
    const url = params.response.url;
    if (url.includes("item_list")) {
      try {
        const body = await chrome.debugger.sendCommand(source, "Network.getResponseBody", { requestId: params.requestId });
        capturedEntries.push({
          request: { url: url },
          response: {
            content: {
              text: body.body,
              encoding: body.base64Encoded ? "base64" : undefined
            }
          }
        });
      } catch (e) {
        console.error("Failed to capture payload", e);
      }
    }
  }
});
