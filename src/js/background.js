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
				manifestIcon: data.icons["128"],
				manifestName: data.name,
				manifestVersion: data.version,
			});
		}
	}
}

function popupColorThemeHandler(message, sendResponse) {
	if (message.getBadgeColor) {
		chrome.storage.local.get(["jsonData"]).then((data) => {
			if (data.jsonData) {
				jsonData = data.jsonData;
			}

			sendResponse({ badgeColor: jsonData.savedBadgeColor });
		});
	}
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
	if (message.getTopSite) {
		chrome.topSites.get((sites) => {
			sendResponse({ topSites: sites });
		});
	}
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
		const reserved = ["<all>", "<audible>", "<grouped>", "<loaded>"];
		let args = {};
		let keyword = message.keyword.toLowerCase();
		let isGrouped = false;
		if (keyword === "<audible>") {
			args["audible"] = true;
		} else if (keyword === "<grouped>") {
			isGrouped = true;
		} else if (keyword === "<loaded>") {
			args["status"] = "complete";
		}
		if (reserved.includes(keyword)) {
			keyword = "";
		}

		chrome.tabs.query(args, (tabs) => {
			let filteredTabs = tabs.filter((tab) => {
				let isMatched = false;
				if ((isGrouped && tab.groupId != -1) || (!isGrouped && (tab.url.toLowerCase().includes(keyword) || tab.title.toLowerCase().includes(keyword)))) {
					isMatched = true;
				}

				return isMatched;
			});
			const groupIds = [...new Set(filteredTabs.map((tab) => tab.groupId).filter((groupId) => groupId !== -1))];
			const groupData = {};
			const promises = groupIds.map((groupId) => {
				return new Promise((resolve) => {
					chrome.tabGroups.get(groupId, (group) => {
						if (!chrome.runtime.lastError && group) {
							groupData[groupId] = {
								groupTitle: group.title,
								groupColor: group.color,
							};
						}

						resolve();
					});
				});
			});
			Promise.all(promises).then(() => {
				filteredTabs = filteredTabs.map((tab) => {
					if (tab.groupId !== -1 && groupData[tab.groupId]) {
						return { ...tab, ...groupData[tab.groupId] };
					}

					return tab;
				});

				sendResponse({ status: "OK", data: filteredTabs });
			});
		});
	}
}

function manipulateTabByID(message, sendResponse) {
	if (message.restoreTabs) {
		message.data.forEach((url) => {
			chrome.tabs.create({ url, active: false }, (tab) => {
				if (!chrome.runtime.lastError && tab) {
					const listener = (tabId, changeInfo) => {
						if (tabId === tab.id && changeInfo.status === "complete") {
							chrome.tabs.discard(tab.id, () => {
								if (chrome.runtime.lastError) {
									console.warn("Failed to discard tab:", chrome.runtime.lastError.message);
								}
							});
							chrome.tabs.onUpdated.removeListener(listener);
						}
					};
					chrome.tabs.onUpdated.addListener(listener);
				}
			});
		});
		sendResponse({ status: "OK" });
	}
	if (message.discardTab) {
		chrome.tabs.discard(message.tabId, (tab) => {
			if (chrome.runtime.lastError || !tab) {
				sendResponse({ status: "ERROR" });
			} else {
				sendResponse({ status: "OK", tabId: tab.id });
			}
		});
	}
	if (message.switchToTab) {
		chrome.tabs.update(message.tabId, { active: true }, (tab) => {
			if (chrome.runtime.lastError || !tab) {
				sendResponse({ status: "ERROR" });
			} else {
				chrome.windows.update(tab.windowId, { focused: true }, () => {
					if (chrome.runtime.lastError) {
						sendResponse({ status: "ERROR" });
					} else {
						sendResponse({ status: "OK", tabId: tab.id });
					}
				});
			}
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
	if (message.muteTab || message.pinTab) {
		chrome.tabs.get(message.tabId, (tab) => {
			if (chrome.runtime.lastError) {
				sendResponse({ status: "ERROR" });
			} else {
				let args = {};
				let audibleState = false;
				let pinnedState = false;
				if (message.muteTab) {
					audibleState = !tab.mutedInfo.muted;
					args = { muted: audibleState };
				} else if (message.pinTab) {
					pinnedState = !tab.pinned;
					args = { pinned: pinnedState };
				}

				chrome.tabs.update(tab.id, args);
				sendResponse({ status: "OK", tabId: tab.id, isMuted: audibleState, isPinned: pinnedState });
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
