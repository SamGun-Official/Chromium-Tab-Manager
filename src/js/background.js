const json = {
	badgeColor: {
		blue: "#4285f4",
		red: "#ff0f0f",
		orange: "#ffa500",
		yellow: "#e8e800",
		green: "#00d400",
		purple: "#bf00bf",
		pink: "#ffc0cb",
	},
	savedBadgeColor: "blue",
	colorTheme: "dark",
	openedPeakTabCount: 1,
};

function popupColorThemeHandler(message, sendResponse) {
	if (message.getColorTheme) {
		chrome.storage.local.get(["json"]).then((data) => {
			let retrievedColorTheme = json.colorTheme;
			if (data.json) {
				retrievedColorTheme = data.json.colorTheme;
			}

			sendResponse({ colorTheme: retrievedColorTheme });
		});
	}
	if (message.colorTheme) {
		json.colorTheme = message.colorTheme;
		chrome.storage.local.set({ json: json }).then(() => {
			sendResponse({ colorTheme: json.colorTheme });
		});
	}
}

function setOpenedPeakTabCount(resetData, sendResponse = undefined) {
	chrome.storage.local.get(["json"]).then((data) => {
		if (data.json && !resetData) {
			json.openedPeakTabCount = data.json.openedPeakTabCount;
		}

		chrome.tabs.query({}, (tabs) => {
			if (tabs.length > json.openedPeakTabCount || resetData) {
				json.openedPeakTabCount = tabs.length;
			}

			chrome.storage.local.set({ json: json }).then(() => {
				if (sendResponse) {
					sendResponse({ openedPeakTabCount: json.openedPeakTabCount });
				}
			});
		});
	});
}

function popupDataHandler(message, sendResponse) {
	if (message.requestOpenedWindowCount) {
		chrome.windows.getAll({}, (windows) => {
			sendResponse({ openedWindowCount: windows.length });
		});
	}
	if (message.requestOpenedTabCount) {
		chrome.tabs.query({}, (tabs) => {
			sendResponse({ openedTabCount: tabs.length });
		});
	}
	if (message.requestCurrentWindowTabCount) {
		chrome.tabs.query({ currentWindow: true }, (tabs) => {
			sendResponse({ currentWindowTabCount: tabs.length });
		});
	}
	if (message.requestOpenedPeakTabCount) {
		setOpenedPeakTabCount(false, sendResponse);
	}
	if (message.resetOpenedPeakTabCount) {
		setOpenedPeakTabCount(true, sendResponse);
	}
}

function updateBadgeText() {
	chrome.tabs.query({}, (tabs) => {
		chrome.action.setBadgeText({ text: `${tabs.length}` });
	});
}

function updateBadgeColor() {
	chrome.storage.local.get(["json"]).then((data) => {
		if (data.json) {
			json.savedBadgeColor = data.json.savedBadgeColor;
		}

		chrome.action.setBadgeBackgroundColor({ color: json.badgeColor[json.savedBadgeColor] });
	});
}

function badgeColorHandler(message, sendResponse) {
	if (message.badgeColor) {
		json.savedBadgeColor = message.badgeColor;
		chrome.storage.local.set({ json: json }).then(() => {
			updateBadgeColor();
			sendResponse({ badgeColor: json.savedBadgeColor });
		});
	}
}

function popupMessageHandler(message, sender, sendResponse) {
	popupColorThemeHandler(message, sendResponse);
	popupDataHandler(message, sendResponse);
	badgeColorHandler(message, sendResponse);

	return true;
}

function badgeListener() {
	updateBadgeText();
	updateBadgeColor();
}

function tabListener() {
	updateBadgeText();
	setOpenedPeakTabCount(false);
}

chrome.runtime.onInstalled.addListener(badgeListener);
chrome.runtime.onMessage.addListener(popupMessageHandler);
chrome.runtime.onStartup.addListener(badgeListener);
chrome.tabs.onCreated.addListener(tabListener);
chrome.tabs.onRemoved.addListener(tabListener);
