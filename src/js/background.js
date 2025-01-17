const badgeColor = {
	blue: "#4285f4",
	red: "#ff0f0f",
	orange: "#ffa500",
	yellow: "#e8e800",
	green: "#00d400",
	purple: "#bf00bf",
	pink: "#ffc0cb",
};
let jsonData = {
	savedBadgeColor: "blue",
	colorTheme: "dark",
	openedPeakTabCount: 1,
};

function getManifestInfo(message, sendResponse) {
	if (message.getManifestInfo) {
		const data = chrome.runtime.getManifest();
		if (data.version) {
			sendResponse({
				manifestName: data.name,
				manifestVersion: data.version,
			});
		}
	}
}

function popupColorThemeHandler(message, sendResponse) {
	if (message.getColorTheme) {
		chrome.storage.local.get(["jsonData"]).then((data) => {
			if (data.jsonData) {
				jsonData = data.jsonData;
			}

			sendResponse({ colorTheme: jsonData.colorTheme });
		});
	}
	if (message.colorTheme) {
		jsonData.colorTheme = message.colorTheme;
		chrome.storage.local.set({ jsonData: jsonData }).then(() => {
			sendResponse({ colorTheme: jsonData.colorTheme });
		});
	}
}

function setOpenedPeakTabCount(resetData, sendResponse = undefined) {
	chrome.storage.local.get(["jsonData"]).then((data) => {
		if (data.jsonData && !resetData) {
			jsonData = data.jsonData;
		}

		chrome.tabs.query({}, (tabs) => {
			if (tabs.length > jsonData.openedPeakTabCount || resetData) {
				jsonData.openedPeakTabCount = tabs.length;
			}

			chrome.storage.local.set({ jsonData: jsonData }).then(() => {
				if (sendResponse) {
					sendResponse({ openedPeakTabCount: jsonData.openedPeakTabCount });
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
	chrome.storage.local.get(["jsonData"]).then((data) => {
		if (data.jsonData) {
			jsonData = data.jsonData;
		}

		chrome.action.setBadgeBackgroundColor({ color: badgeColor[jsonData.savedBadgeColor] });
	});
}

function badgeColorHandler(message, sendResponse) {
	if (message.badgeColor) {
		jsonData.savedBadgeColor = message.badgeColor;
		chrome.storage.local.set({ jsonData: jsonData }).then(() => {
			updateBadgeColor();
			sendResponse({ badgeColor: jsonData.savedBadgeColor });
		});
	}
}

function filterTabsURL(message, sendResponse) {
	if (message.queryTabs) {
		const keyword = message.keyword;
		chrome.tabs.query({}, (tabs) => {
			const filteredTabs = tabs.filter((tab) => {
				let isMatched = false;
				if (tab.url.toLowerCase().includes(keyword.toLowerCase())) {
					isMatched = true;
				}
				if (tab.title.toLowerCase().includes(keyword.toLowerCase())) {
					isMatched = true;
				}

				return isMatched;
			});
			sendResponse({ status: "OK", data: filteredTabs });
		});
	}
}

function manipulateTabByID(message, sendResponse) {
	if (message.switchToTab) {
		chrome.tabs.update(message.tabId, { active: true }, (tab) => {
			sendResponse({ status: "OK", tabId: tab.id });
		});
	}
	if (message.closeTargetTab) {
		chrome.tabs.remove(message.tabId, () => {
			if (chrome.runtime.lastError) {
				sendResponse({ status: "ERROR" });
			} else {
				sendResponse({ status: "OK" });
			}
		});
	}
}

function replaceTargetedDomain(message, sendResponse) {
	if (message.replaceDomain) {
		chrome.tabs.query({}, (tabs) => {
			tabs.forEach((tab) => {
				try {
					const url = new URL(tab.url);
					if (url.hostname.toLowerCase() === message.targetDomain.toLowerCase()) {
						const newURL = url.href.replace(message.targetDomain.toLowerCase(), message.newDomain.toLowerCase());
						chrome.tabs.update(tab.id, { url: newURL });
					}
				} catch (e) {
					console.error(`Failed to update tab: ${e}`);
				}
			});
		});
		sendResponse({ status: "OK" });
	}
}

function popupMessageHandler(message, sender, sendResponse) {
	popupColorThemeHandler(message, sendResponse);
	popupDataHandler(message, sendResponse);
	badgeColorHandler(message, sendResponse);
	getManifestInfo(message, sendResponse);
	filterTabsURL(message, sendResponse);
	manipulateTabByID(message, sendResponse);
	replaceTargetedDomain(message, sendResponse);

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
chrome.tabs.onActivated.addListener(badgeListener);
chrome.tabs.onCreated.addListener(tabListener);
chrome.tabs.onRemoved.addListener(tabListener);
