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

function removeUnusedDataFromStorage(callbackFn) {
	const unusedDataKeys = ["jsonData"];
	chrome.storage.local.remove(unusedDataKeys, () => {
		if (chrome.runtime.lastError) {
			callbackFn({ error: chrome.runtime.lastError });
		} else {
			callbackFn({ error: null });
		}
	});
}

function getAllDataFromStorage(callbackFn) {
	chrome.storage.local.get(null, (data) => {
		if (chrome.runtime.lastError) {
			callbackFn({ error: chrome.runtime.lastError });
		} else {
			callbackFn({
				openedPeakTabCount: data.openedPeakTabCount ?? 1,
				badgeColor: data.badgeColor ?? "blue",
				colorTheme: data.colorTheme ?? "dark",
				silenceNotification: data.silenceNotification ?? false,
				lastNotifiedVersion: data.lastNotifiedVersion ?? "1.0.0",
				lastDownloadURL: data.lastDownloadURL ?? null,
				isNewerVersion: data.isNewerVersion ?? false,
			});
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

async function checkForUpdates(callbackFn = undefined) {
	try {
		const response = await fetch("https://samgun-official.my.id/ext-updates/Chromium-Tab-Manager/version.json");
		if (!response.ok) {
			throw new Error("Cannot fetch version data from the source.");
		}

		const fetchedData = await response.json();
		const manifestData = chrome.runtime.getManifest();
		getAllDataFromStorage((data) => {
			if (data.error) {
				if (callbackFn) {
					callbackFn({ error: data.error });
				}

				return;
			}
			if (data.lastDownloadURL === null || data.lastNotifiedVersion === "1.0.0") {
				data.lastDownloadURL = fetchedData.download_url;
				data.lastNotifiedVersion = fetchedData.version;
			}
			if (!isNewerVersion(fetchedData.version, manifestData.version)) {
				data.isNewerVersion = false;
				setAllDataToStorage(data, (update) => {
					if (update.error) {
						if (callbackFn) {
							callbackFn({ error: update.error });
						}

						return;
					}
					if (callbackFn) {
						callbackFn({ versionData: fetchedData, isNewerVersion: update.isNewerVersion });
					}
				});

				return;
			}
			if (!isNewerVersion(fetchedData.version, data.lastNotifiedVersion)) {
				data.isNewerVersion = true;
				setAllDataToStorage(data, (update) => {
					if (update.error) {
						if (callbackFn) {
							callbackFn({ error: update.error });
						}

						return;
					}
					if (callbackFn) {
						callbackFn({ versionData: fetchedData, isNewerVersion: update.isNewerVersion });
					}
				});

				return;
			}

			data.lastDownloadURL = fetchedData.download_url;
			data.lastNotifiedVersion = fetchedData.version;
			data.isNewerVersion = true;
			setAllDataToStorage(data, (update) => {
				if (update.error) {
					if (callbackFn) {
						callbackFn({ error: update.error });
					}

					return;
				}
				if (!update.silenceNotification && fetchedData.severity === "critical") {
					const options = {
						title: manifestData.name,
						message: `A new critical update v${fetchedData.version} is available! Click here to download from the source.`,
						iconUrl: `../../${manifestData.icons["128"]}`,
						type: "basic",
					};
					chrome.notifications.create("update", options);
				}
				if (callbackFn) {
					callbackFn({ versionData: fetchedData, isNewerVersion: update.isNewerVersion });
				}
			});
		});
	} catch (error) {
		if (callbackFn) {
			callbackFn({ error: error });
		}

		return;
	}
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

chrome.alarms.create("update-check", { periodInMinutes: 1440 });
chrome.alarms.onAlarm.addListener(() => checkForUpdates());
chrome.runtime.onInstalled.addListener(() => {
	removeUnusedDataFromStorage(() => {
		setOpenedPeakTabCount(false, () => {
			updateBadgeColor();
			updateBadgeText();
			checkForUpdates();
		});
	});
});
chrome.runtime.onMessage.addListener((message, _, sendResponse) => {
	if (message.fetchExtensionData) {
		fetchExtensionData((data) => {
			sendResponse(data);
		});
	}
	if (message.queryTabs) {
		const filter = message.filter;
		const keyword = message.keyword;
		const oldDomain = message.oldDomain;
		const newDomain = message.newDomain;
		const deleteTabs = message.deleteTabs;
		const options = {
			active: deleteTabs ? false : undefined,
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
				const groupData = {};
				const promises = groupIds.map((groupId) => {
					return new Promise((resolve, reject) => {
						chrome.tabGroups.get(groupId, (group) => {
							if (chrome.runtime.lastError) {
								reject();
							} else {
								groupData[groupId] = {
									groupTitle: group.title,
									groupColor: group.color,
								};
								resolve();
							}
						});
					});
				});
				Promise.allSettled(promises).then(() => {
					filteredTabs = filteredTabs.map((tab) => {
						if (tab.groupId !== -1 && groupData[tab.groupId]) {
							return { ...tab, ...groupData[tab.groupId] };
						}

						return tab;
					});
					if (oldDomain && newDomain) {
						const updatePromises = filteredTabs.map((tab) => {
							const url = new URL(tab.url);
							if (url.hostname.toLowerCase().trim().includes(oldDomain.toLowerCase().trim())) {
								return new Promise((resolve, reject) => {
									const newUrl = url.href.replace(oldDomain.toLowerCase().trim(), newDomain.toLowerCase().trim());
									chrome.tabs.update(tab.id, { url: newUrl }, (updatedTab) => {
										if (chrome.runtime.lastError) {
											reject(chrome.runtime.lastError);
										} else {
											resolve(updatedTab);
										}
									});
								});
							}

							return null;
						});
						Promise.allSettled(updatePromises.filter(Boolean)).then((results) => {
							const updatedValues = results.filter((result) => result.status === "fulfilled").map((result) => result.value);
							if (updatedValues.length === 0) {
								sendResponse({ error: "Failed to edit domain!" });
							} else {
								sendResponse({ data: updatedValues });
							}
						});
					} else if (deleteTabs) {
						const tabIds = filteredTabs.map((tab) => tab.id);
						chrome.tabs.remove(tabIds, () => {
							if (chrome.runtime.lastError) {
								sendResponse({ error: chrome.runtime.lastError });
							} else {
								sendResponse({ data: [] });
							}
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
			data.badgeColor = message.badgeColor;
			setAllDataToStorage(data, (update) => {
				sendResponse(update);
				if (!update.error) {
					updateBadgeColor();
				}
			});
		});
	}
	if (message.setColorTheme) {
		getAllDataFromStorage((data) => {
			data.colorTheme = message.colorTheme;
			setAllDataToStorage(data, (update) => {
				sendResponse(update);
			});
		});
	}
	if (message.closeTargetTab) {
		chrome.tabs.remove(message.tabId, () => {
			if (chrome.runtime.lastError) {
				sendResponse({ error: chrome.runtime.lastError });
			} else {
				sendResponse({ error: null });
			}
		});
	}
	if (message.discardTab) {
		chrome.tabs.discard(message.tabId, (tab) => {
			if (chrome.runtime.lastError) {
				sendResponse({ error: chrome.runtime.lastError });
			} else {
				sendResponse({ tabId: tab.id });
			}
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
				chrome.tabs.update(tab.id, { muted: message.muteTab ? !tab.mutedInfo.muted : false, pinned: message.pinTab ? !tab.pinned : false }, (tab) => {
					if (chrome.runtime.lastError) {
						sendResponse({ error: chrome.runtime.lastError });
					} else {
						sendResponse({ tabId: tab.id, isMuted: tab.muted, isPinned: tab.pinned });
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
			checkForUpdates((result) => {
				if (result.error) {
					reject(result.error);
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
				sendResponse({ error: updateInfoData.reason });
			}
		});
	}
	if (message.restoreTabs && message.data) {
		message.data.forEach((url) => {
			chrome.tabs.create({ url, active: false }, (tab) => {
				if (chrome.runtime.lastError) {
					sendResponse({ error: chrome.runtime.lastError });
				} else {
					const listener = async (tabId, changeInfo) => {
						if (tabId === tab.id && changeInfo.status === "complete") {
							await chrome.tabs.discard(tab.id);
							chrome.tabs.onUpdated.removeListener(listener);
						}
					};
					chrome.tabs.onUpdated.addListener(listener);
				}
			});
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
chrome.tabs.onCreated.addListener(() => {
	setOpenedPeakTabCount(false, () => {
		updateBadgeText();
	});
});
chrome.tabs.onRemoved.addListener(() => updateBadgeText());
chrome.notifications.onClicked.addListener(() => {
	getAllDataFromStorage((data) => {
		if (data.lastDownloadURL) {
			chrome.tabs.create({ url: latestDownloadURL });
		}
	});
});
