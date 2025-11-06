const DEFAULT_DELAY_MS = 500;
const DEFAULT_BADGE_COLOR = "blue";
const DEFAULT_THEME_COLOR = "dark";
const BADGE_COLOR_OPTIONS = {
	grey: "#dadce0",
	blue: "#8ab4f8",
	red: "#f28b82",
	yellow: "#fdd663",
	green: "#81c995",
	pink: "#ff8bcb",
	purple: "#c58af9",
	cyan: "#78d9ec",
	orange: "#fcad70",
};
const DEFAULT_DATA_STORAGE = {
	openedPeakTabCount: 1,
	badgeColor: "blue",
	colorTheme: "dark",
	silenceNotification: false,
	lastNotifiedVersion: "1.0.0",
	lastDownloadUrl: null,
	isNewerVersion: false,
};

function getAllDataFromStorage(callbackFn) {
	chrome.storage.local.get(null, (data) => {
		if (chrome.runtime.lastError) {
			callbackFn({ error: chrome.runtime.lastError });
		} else {
			const defaultDataKeys = Object.keys(DEFAULT_DATA_STORAGE);
			const unusedDataKeys = Object.keys(data).filter((key) => !defaultDataKeys.includes(key));
			const dataStorage = {};
			for (const dataKey of defaultDataKeys) {
				dataStorage[dataKey] = data[dataKey] ?? DEFAULT_DATA_STORAGE[dataKey];
			}
			if (unusedDataKeys.length > 0) {
				chrome.storage.local.remove(unusedDataKeys, () => {
					if (chrome.runtime.lastError) {
						callbackFn({ error: chrome.runtime.lastError });
					} else {
						callbackFn(dataStorage);
					}
				});
			} else {
				callbackFn(dataStorage);
			}
		}
	});
}

function setAllDataToStorage(data, callbackFn = undefined) {
	chrome.storage.local.set({ ...data }, () => {
		if (callbackFn) {
			if (chrome.runtime.lastError) {
				callbackFn({ error: chrome.runtime.lastError });
			} else {
				callbackFn(data);
			}
		}
	});
}

function setOpenedPeakTabCount(resetData, callbackFn = undefined) {
	getAllDataFromStorage((data) => {
		if (data.error) {
			if (callbackFn) {
				callbackFn({ error: data.error });
			}
		} else {
			chrome.tabs.query({}, (tabs) => {
				if (chrome.runtime.lastError) {
					if (callbackFn) {
						callbackFn({ error: chrome.runtime.lastError });
					}
				} else {
					if (tabs.length > data.openedPeakTabCount || resetData) {
						data.openedPeakTabCount = tabs.length;
					}

					setAllDataToStorage(data, callbackFn);
				}
			});
		}
	});
}

function setSilenceNotification(flagValue, callbackFn) {
	getAllDataFromStorage((data) => {
		if (data.error) {
			callbackFn({ error: data.error });
		} else {
			data.silenceNotification = flagValue;
			setAllDataToStorage(data, callbackFn);
		}
	});
}

function updateBadgeColor() {
	chrome.storage.local.get("badgeColor", (data) => {
		let selectedColor = DEFAULT_BADGE_COLOR;
		if (!chrome.runtime.lastError && data.badgeColor) {
			selectedColor = data.badgeColor;
		}

		chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR_OPTIONS[selectedColor] }, () => {
			if (chrome.runtime.lastError) {
				console.log("Failed to set badge background color:", chrome.runtime.lastError);
			}
		});
	});
}

function updateBadgeText() {
	chrome.tabs.query({}, (tabs) => {
		let tabCount = 1;
		if (!chrome.runtime.lastError) {
			tabCount = tabs.length;
		}

		chrome.action.setBadgeText({ text: `${tabCount}` }, () => {
			if (chrome.runtime.lastError) {
				console.log("Failed to set badge text:", chrome.runtime.lastError);
			}
		});
	});
}

function isNewerVersion(latestVersion, currentVersion) {
	const latest = latestVersion.split(".").map(Number);
	const current = currentVersion.split(".").map(Number);
	for (let index = 0; index < Math.max(latest.length, current.length); index++) {
		if ((latest[index] || 0) > (current[index] || 0)) {
			return true;
		}
		if ((latest[index] || 0) < (current[index] || 0)) {
			return false;
		}
	}

	return false;
}

function checkForUpdates(forceCheck = false, callbackFn = undefined) {
	if (typeof forceCheck === "function") {
		callbackFn = forceCheck;
		forceCheck = false;
	}

	getAllDataFromStorage(async (data) => {
		try {
			const response = await fetch("https://samgun-official.my.id/ext-updates/Chromium-Tab-Manager/version.json", { cache: "no-cache" });
			if (!response.ok) {
				throw new Error("Cannot fetch version data from the source.");
			}

			const fetchedData = await response.json();
			const manifestData = chrome.runtime.getManifest();

			function updateDataCallback(update, createNotification = false) {
				if (update.error) {
					if (callbackFn) {
						callbackFn({ error: update.error });
					}

					return;
				}
				if (createNotification && !update.silenceNotification && fetchedData.severity === "critical") {
					const options = {
						title: manifestData.name,
						message: `A new critical update v${fetchedData.version} is available! Click here to download from the source.`,
						iconUrl: `../../${manifestData.icons["128"]}`,
						type: "basic",
					};
					chrome.notifications.create("update", options);
				}
				if (callbackFn) {
					callbackFn({
						versionData: fetchedData,
						isNewerVersion: update.isNewerVersion,
					});
				}
			}

			if (data.error) {
				if (callbackFn) {
					callbackFn({ error: data.error });
				}

				return;
			}
			if (data.lastDownloadUrl === null || data.lastNotifiedVersion === "1.0.0") {
				data.lastDownloadUrl = fetchedData.download_url;
				data.lastNotifiedVersion = fetchedData.version;
			}
			if (!isNewerVersion(fetchedData.version, manifestData.version)) {
				data.isNewerVersion = false;
				setAllDataToStorage(data, updateDataCallback);

				return;
			}
			if (!isNewerVersion(fetchedData.version, data.lastNotifiedVersion) && !forceCheck) {
				data.isNewerVersion = true;
				setAllDataToStorage(data, updateDataCallback);

				return;
			}

			data.lastDownloadUrl = fetchedData.download_url;
			data.lastNotifiedVersion = fetchedData.version;
			data.isNewerVersion = true;
			setAllDataToStorage(data, (update) => {
				updateDataCallback(update, true);
			});
		} catch (error) {
			if (callbackFn) {
				callbackFn({ error: error, message: error.message });
			}

			return;
		}
	});
}

function fetchExtensionData(callbackFn) {
	const getTopSites = new Promise((resolve, reject) => {
		chrome.topSites.get((sites) => {
			if (chrome.runtime.lastError) {
				reject(chrome.runtime.lastError);
			} else {
				resolve(sites);
			}
		});
	});
	const getSystemMemoryInfo = new Promise((resolve, reject) => {
		chrome.system.memory.getInfo((memoryInfo) => {
			if (chrome.runtime.lastError) {
				reject(chrome.runtime.lastError);
			} else {
				resolve(memoryInfo);
			}
		});
	});
	const getOpenedWindows = new Promise((resolve, reject) => {
		chrome.windows.getAll({}, (windows) => {
			if (chrome.runtime.lastError) {
				reject(chrome.runtime.lastError);
			} else {
				resolve(windows);
			}
		});
	});
	const getOpenedTabs = new Promise((resolve, reject) => {
		chrome.tabs.query({}, (tabs) => {
			if (chrome.runtime.lastError) {
				reject(chrome.runtime.lastError);
			} else {
				resolve(tabs);
			}
		});
	});
	const getCurrentWindowTabs = new Promise((resolve, reject) => {
		chrome.tabs.query({ currentWindow: true }, (tabs) => {
			if (chrome.runtime.lastError) {
				reject(chrome.runtime.lastError);
			} else {
				resolve(tabs);
			}
		});
	});
	Promise.allSettled([getTopSites, getSystemMemoryInfo, getOpenedWindows, getOpenedTabs, getCurrentWindowTabs]).then((results) => {
		const [topSites, systemMemoryInfo, openedWindows, openedTabs, currentWindowTabs] = results;
		const manifestData = chrome.runtime.getManifest();
		const response = {
			topSite: {},
			memoryInfo: {},
			openedWindowCount: 1,
			openedTabCount: 1,
			currentWindowTabCount: 1,
		};
		if (topSites.status === "fulfilled") {
			response.topSite = topSites.value[0];
		} else {
			console.log("Failed to get 'topSite':", topSites.reason);
		}

		if (systemMemoryInfo.status === "fulfilled") {
			response.memoryInfo = systemMemoryInfo.value;
		} else {
			console.log("Failed to get 'memoryInfo':", systemMemoryInfo.reason);
		}

		if (openedWindows.status === "fulfilled") {
			response.openedWindowCount = openedWindows.value.length;
		} else {
			console.log("Failed to get 'openedWindowCount':", openedWindows.reason);
		}

		if (openedTabs.status === "fulfilled") {
			response.openedTabCount = openedTabs.value.length;
		} else {
			console.log("Failed to get 'openedTabCount':", openedTabs.reason);
		}

		if (currentWindowTabs.status === "fulfilled") {
			response.currentWindowTabCount = currentWindowTabs.value.length;
		} else {
			console.log("Failed to get 'currentWindowTabCount':", currentWindowTabs.reason);
		}

		getAllDataFromStorage((data) => {
			if (data.error) {
				callbackFn({
					manifestIcon: manifestData.icons["128"],
					manifestName: manifestData.name,
					manifestVersion: manifestData.version,
					error: data.error,
					...response,
				});
			} else {
				callbackFn({
					manifestIcon: manifestData.icons["128"],
					manifestName: manifestData.name,
					manifestVersion: manifestData.version,
					...response,
					...data,
				});
			}
		});
	});
}

async function removeTabsFromMemory(tabIds, deleteTabs, callbackFn) {
	const resolvedTabs = [];
	const rejectedTabs = [];
	for (const tabId of tabIds) {
		try {
			const result = await new Promise((resolve, reject) => {
				if (deleteTabs) {
					chrome.tabs.remove(tabId, () => {
						if (chrome.runtime.lastError) {
							reject({
								error: chrome.runtime.lastError,
								tabId: tabId,
							});
						} else {
							resolve({ tabId: tabId });
						}
					});
				} else {
					chrome.tabs.discard(tabId, (tab) => {
						if (chrome.runtime.lastError) {
							reject({
								error: chrome.runtime.lastError,
								tabId: tabId,
							});
						} else {
							resolve({ tabId: tab.id });
						}
					});
				}
			});
			resolvedTabs.push(result);
		} catch (error) {
			rejectedTabs.push(error);
		}

		await new Promise((result) => setTimeout(result, DEFAULT_DELAY_MS));
	}

	callbackFn({
		resolvedTabs: resolvedTabs,
		rejectedTabs: rejectedTabs,
	});
}

async function restoreTabsFromJSON(data, callbackFn) {
	const resolvedTabs = [];
	const rejectedTabs = [];
	const batchSize = 10;
	for (let i = 0; i < data.length; i += batchSize) {
		const batch = data.slice(i, i + batchSize);
		const promises = batch.map(async (url, index) => {
			return new Promise((result) => setTimeout(result, index * DEFAULT_DELAY_MS)).then(() => {
				return new Promise((resolve, reject) => {
					chrome.tabs.create({ url, active: false }, (tab) => {
						if (chrome.runtime.lastError) {
							reject({ error: chrome.runtime.lastError });
						} else {
							const listener = async (tabId, changeInfo) => {
								if (tabId === tab.id && changeInfo.status === "complete") {
									chrome.tabs.onUpdated.removeListener(listener);
									await chrome.tabs.discard(tab.id, (discardedTab) => {
										if (chrome.runtime.lastError) {
											reject({ error: chrome.runtime.lastError });
										} else {
											resolve(discardedTab);
										}
									});
								}
							};
							chrome.tabs.onUpdated.addListener(listener);
						}
					});
				});
			});
		});
		const results = await Promise.allSettled(promises);
		for (const result of results) {
			if (result.status === "fulfilled") {
				resolvedTabs.push(result.value);
			} else {
				rejectedTabs.push(result.reason);
			}
		}
	}

	callbackFn({
		resolvedTabs: resolvedTabs,
		rejectedTabs: rejectedTabs,
	});
}

chrome.alarms.create("update-check", { periodInMinutes: 1440 });
chrome.alarms.onAlarm.addListener(() => checkForUpdates());
chrome.runtime.onInstalled.addListener(() => {
	setOpenedPeakTabCount(false, () => {
		updateBadgeColor();
		updateBadgeText();
		checkForUpdates();
	});
});
chrome.runtime.onMessage.addListener((message, _, sendResponse) => {
	if (message.fetchExtensionData) {
		fetchExtensionData((data) => {
			sendResponse(data);
		});
	}
	if (message.queryTabs) {
		const { filter, keyword, oldDomain, newDomain, deleteTabs, unloadTabs } = message.args;
		const options = {
			active: deleteTabs || unloadTabs ? false : undefined,
			audible: filter === "<audible>" ? true : undefined,
			lastFocusedWindow: deleteTabs ? true : undefined,
			status: filter === "<loaded>" ? "complete" : undefined,
		};
		chrome.tabs.query(options, (tabs) => {
			if (chrome.runtime.lastError) {
				sendResponse({ error: chrome.runtime.lastError });
			} else {
				let filteredTabs = tabs.filter((tab) => {
					const matched = [tab.url, tab.title].some((text) => text.toLowerCase().trim().includes(keyword));
					if (filter === "<grouped>") {
						return matched && tab.groupId != -1;
					}

					return matched;
				});
				const groupIds = [...new Set(filteredTabs.map((tab) => tab.groupId).filter((groupId) => groupId !== -1))];
				const promises = groupIds.map((groupId) => {
					return new Promise((resolve, reject) => {
						chrome.tabGroups.get(groupId, (group) => {
							if (chrome.runtime.lastError) {
								reject(chrome.runtime.lastError);
							} else {
								resolve(group);
							}
						});
					});
				});
				Promise.allSettled(promises).then(async (results) => {
					const groupData = Object.fromEntries(results.filter((result) => result.status === "fulfilled").map((result) => [result.value.id, { ...result.value }]));
					filteredTabs = filteredTabs.map((tab) => {
						if (tab.groupId !== -1 && groupData[tab.groupId]) {
							return { ...tab, groupInfo: groupData[tab.groupId] };
						}

						return tab;
					});
					if (oldDomain && newDomain) {
						const resolvedTabs = [];
						const rejectedTabs = [];
						for (const tab of filteredTabs) {
							const url = new URL(tab.url);
							if (!url.hostname.toLowerCase().trim().includes(oldDomain.toLowerCase().trim())) {
								continue;
							}

							try {
								const result = await new Promise((resolve, reject) => {
									const newUrl = url.href.replace(oldDomain.toLowerCase().trim(), newDomain.toLowerCase().trim());
									chrome.tabs.update(tab.id, { url: newUrl }, (updatedTab) => {
										if (chrome.runtime.lastError) {
											reject(chrome.runtime.lastError);
										} else {
											resolve(updatedTab);
										}
									});
								});
								resolvedTabs.push(result);
							} catch (error) {
								rejectedTabs.push(error);
							}

							await new Promise((result) => setTimeout(result, DEFAULT_DELAY_MS));
						}

						sendResponse({
							resolvedTabs: resolvedTabs,
							rejectedTabs: rejectedTabs,
						});
					} else if (deleteTabs || unloadTabs) {
						const tabIds = filteredTabs.map((tab) => tab.id);
						removeTabsFromMemory(tabIds, deleteTabs, (response) => {
							sendResponse(response);
						});
					} else {
						sendResponse({ data: filteredTabs });
					}
				});
			}
		});
	}
	if (message.resetOpenedPeakTabCount) {
		setOpenedPeakTabCount(true, (data) => {
			sendResponse(data);
		});
	}
	if (message.setBadgeColor) {
		getAllDataFromStorage((data) => {
			if (data.error) {
				sendResponse(data);
			} else {
				data.badgeColor = message.badgeColor;
				setAllDataToStorage(data, (update) => {
					sendResponse(update);
					if (!update.error) {
						updateBadgeColor();
					}
				});
			}
		});
	}
	if (message.setColorTheme) {
		getAllDataFromStorage((data) => {
			if (data.error) {
				sendResponse(data);
			} else {
				data.colorTheme = message.colorTheme;
				setAllDataToStorage(data, (update) => {
					sendResponse(update);
				});
			}
		});
	}
	if (message.closeTargetTab || message.discardTab) {
		removeTabsFromMemory([message.tabId], message.closeTargetTab ? true : false, (response) => {
			sendResponse(response);
		});
	}
	if (message.switchToTab) {
		chrome.tabs.update(message.tabId, { active: true }, (tab) => {
			if (chrome.runtime.lastError) {
				sendResponse({ error: chrome.runtime.lastError });
			} else {
				chrome.windows.update(tab.windowId, { focused: true }, (window) => {
					if (chrome.runtime.lastError) {
						sendResponse({ error: chrome.runtime.lastError });
					} else {
						sendResponse({ tabId: tab.id, windowId: window.id });
					}
				});
			}
		});
	}
	if (message.muteTab || message.pinTab) {
		chrome.tabs.get(message.tabId, (tab) => {
			if (chrome.runtime.lastError) {
				sendResponse({ error: chrome.runtime.lastError });
			} else {
				chrome.tabs.update(tab.id, { muted: message.muteTab ? !tab.mutedInfo.muted : false, pinned: message.pinTab ? !tab.pinned : false }, (update) => {
					if (chrome.runtime.lastError) {
						sendResponse({ error: chrome.runtime.lastError, lastMuteState: tab.mutedInfo.muted, lastPinState: tab.pinned });
					} else {
						sendResponse({ tabId: update.id, isMuted: update.mutedInfo.muted, isPinned: update.pinned });
					}
				});
			}
		});
	}
	if (message.silenceNotification) {
		setSilenceNotification(message.flagValue, (data) => {
			sendResponse(data);
		});
	}
	if (message.checkUpdate) {
		const getUpdateInfoData = new Promise((resolve, reject) => {
			checkForUpdates(true, (result) => {
				if (result.error) {
					reject(result);
				} else {
					resolve(result);
				}
			});
		});
		Promise.allSettled([getUpdateInfoData]).then((results) => {
			const [updateInfoData] = results;
			if (updateInfoData.status === "fulfilled") {
				sendResponse({ updateInfo: updateInfoData.value });
			} else {
				sendResponse(updateInfoData.reason);
			}
		});
	}
	if (message.restoreTabs) {
		restoreTabsFromJSON(message.data, (response) => {
			sendResponse(response);
		});
	}

	return true;
});
chrome.runtime.onStartup.addListener(() => {
	setOpenedPeakTabCount(false, () => {
		updateBadgeColor();
		updateBadgeText();
		checkForUpdates();
	});
});
chrome.tabs.onActivated.addListener(() => {
	setOpenedPeakTabCount(false, () => {
		updateBadgeColor();
		updateBadgeText();
	});
});
chrome.tabs.onCreated.addListener(() => {
	setOpenedPeakTabCount(false, () => {
		updateBadgeColor();
		updateBadgeText();
	});
});
chrome.tabs.onRemoved.addListener(() => () => {
	setOpenedPeakTabCount(false, () => {
		updateBadgeColor();
		updateBadgeText();
	});
});
chrome.notifications.onClicked.addListener(() => {
	getAllDataFromStorage((data) => {
		if (data.lastDownloadUrl) {
			chrome.tabs.create({ url: data.lastDownloadUrl });
		}
	});
});
