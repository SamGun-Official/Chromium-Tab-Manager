const GROUPING_COLOR_OPTIONS = {
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
let searchTimer, messageTimer;
let isCheckingUpdate = true;

function formatDatetime(timestamp) {
	const date = timestamp ? new Date(timestamp) : new Date();
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	const hours = String(date.getHours()).padStart(2, "0");
	const minutes = String(date.getMinutes()).padStart(2, "0");
	const seconds = String(date.getSeconds()).padStart(2, "0");

	return `${year}-${month}-${day} ${hours}-${minutes}-${seconds}`;
}

function calculateLastAccessedTime(timestamp) {
	const now = new Date();
	const date = new Date(timestamp);
	const seconds = Math.floor((now - date) / 1000);
	const intervals = [
		{ label: "year", seconds: 31536000 },
		{ label: "month", seconds: 2592000 },
		{ label: "week", seconds: 604800 },
		{ label: "day", seconds: 86400 },
		{ label: "hour", seconds: 3600 },
		{ label: "minute", seconds: 60 },
		{ label: "second", seconds: 1 },
	];
	for (const interval of intervals) {
		const count = Math.floor(seconds / interval.seconds);
		if (count >= 1) {
			return count === 1 ? `1 ${interval.label} ago` : `${count} ${interval.label}s ago`;
		}
	}

	return "just now";
}

function showMessage(status, success = true) {
	document.getElementById("message").textContent = status;
	document.getElementById("message").classList.remove("text-green-500", "text-red-500");
	document.getElementById("message").classList.add(success ? "text-green-500" : "text-red-500");
	document.getElementById("message").classList.remove("hidden");
	clearTimeout(messageTimer);
	messageTimer = setTimeout(() => {
		document.getElementById("message").classList.add("hidden");
	}, 2500);
}

function markColorOptions(badgeColor) {
	document.querySelectorAll("#color_options > button").forEach((button) => {
		button.textContent = button.dataset.badgeColor === badgeColor ? "✓" : "";
	});
}

function changeColorTheme(appliedTheme) {
	if (appliedTheme === "dark") {
		document.body.dataset.theme = "light";
		document.body.classList.add("light-theme");
		document.body.classList.remove("dark-theme");
		document.getElementById("wrapper").classList.add("dark-theme");
		document.getElementById("wrapper").classList.remove("light-theme");
		document.getElementById("tab_list").classList.add("light-scrollbar-style");
		document.querySelectorAll(".highlight").forEach((element) => {
			element.classList.remove("alternative-background-color");
		});
	} else {
		document.body.dataset.theme = "dark";
		document.body.classList.add("dark-theme");
		document.body.classList.remove("light-theme");
		document.getElementById("wrapper").classList.add("light-theme");
		document.getElementById("wrapper").classList.remove("dark-theme");
		document.getElementById("tab_list").classList.remove("light-scrollbar-style");
		document.querySelectorAll(".highlight").forEach((element) => {
			element.classList.add("alternative-background-color");
		});
	}
}

function fetchExtensionData(callbackFn) {
	chrome.runtime.sendMessage({ fetchExtensionData: true }, (response) => {
		if (response.error) {
			showMessage("Failed to fetch extension data!", false);
		} else {
			document.getElementById("extension_icon").src = response.manifestIcon;
			document.getElementById("extension_title").textContent = response.manifestName;
			document.getElementById("extension_version").textContent = `v${response.manifestVersion}`;
			document.getElementById("silence_notification").checked = response.silenceNotification;
			if (response.topSite) {
				const textHolder = document.querySelector("#most_visited_site > a[data-identifier='1']");
				textHolder.href = response.topSite.url;
				textHolder.textContent = textHolder.title = response.topSite.url;
			}
			if (response.memoryInfo) {
				const bytesToGiB = (bytes) => (bytes / 1024 ** 3).toFixed(2);
				const availableGiB = bytesToGiB(response.memoryInfo.availableCapacity);
				const totalGiB = bytesToGiB(response.memoryInfo.capacity);
				document.querySelector("#system_info > span[data-identifier='2']").textContent = `${availableGiB} GiB / ${totalGiB} GiB`;
			}

			document.querySelector("#opened_windows > span[data-identifier='3']").textContent = response.openedWindowCount;
			document.querySelector("#opened_tabs > span[data-identifier='4']").textContent = response.openedTabCount;
			document.querySelector("#current_window_tabs > span[data-identifier='5']").textContent = response.currentWindowTabCount;
			document.querySelector("#opened_peak_tabs > span[data-identifier='6']").textContent = response.openedPeakTabCount;
			markColorOptions(response.badgeColor);
			changeColorTheme(response.colorTheme === "dark" ? "light" : "dark");
			if (isCheckingUpdate) {
				const isNewerVersion = response.isNewerVersion;
				if (isNewerVersion) {
					const notifier = document.getElementById("download_notifier");
					notifier.dataset.updateAvailable = response.isNewerVersion;
					notifier.href = response.lastDownloadUrl;
					notifier.classList.remove("hidden");
					notifier.querySelector("span").textContent = `v${response.lastNotifiedVersion}`;
				}

				isCheckingUpdate = false;
			}

			callbackFn();
		}
	});
}

function handleTabListChanges() {
	const progressText = document.getElementById("progress");
	const tabList = document.getElementById("tab_list");
	const tabListLength = tabList.children.length;
	document.getElementById("info_header").textContent = `Search Found: ${tabListLength}`;
	if (tabListLength > 0 && tabListLength < 10) {
		tabList.classList.remove("pr-px");
	} else if (tabListLength < 1) {
		document.getElementById("tab_list_container").classList.add("hidden");
		progressText.textContent = "No tab was found.";
		progressText.classList.remove("hidden");

		return;
	} else {
		tabList.classList.add("pr-px");
	}

	progressText.classList.add("hidden");
	document.getElementById("tab_list_container").classList.remove("hidden");
}

function isImageUrlValid(url, callback) {
	const img = new Image();
	img.onload = () => callback(true);
	img.onerror = () => callback(false);
	if (url) {
		img.src = url;
	}
}

function queryTabs(keyword, options = { useFilter: true, extraAction: undefined }, callbackFn = undefined) {
	document.getElementById("wrapper").inert = true;
	document.getElementById("tab_list_container").classList.add("hidden");
	document.getElementById("tab_counter").classList.add("hidden");
	document.getElementById("tab_list").innerHTML = "";

	const progressText = document.getElementById("progress");
	progressText.textContent = "Loading...";
	progressText.classList.remove("hidden");

	let oldDomain = "";
	let newDomain = "";
	if (options.extraAction === "REPLACE_DOMAIN") {
		oldDomain = document.getElementById("old_domain").value;
		newDomain = document.getElementById("new_domain").value;
		if (!oldDomain || !newDomain) {
			if (callbackFn) {
				callbackFn({ error: "Domain input field cannot be empty!" });
			}

			return;
		}
	}

	const filter = document.getElementById("selection_filter").value;
	const deleteTabs = options.extraAction === "DELETE_TABS" ? true : false;
	const unloadTabs = options.extraAction === "UNLOAD_TABS" ? true : false;
	const args = {
		filter: options.useFilter ? filter : "",
		keyword: options.useFilter ? keyword.toLowerCase().trim() : "",
		oldDomain,
		newDomain,
		deleteTabs,
		unloadTabs,
	};
	chrome.runtime.sendMessage({ queryTabs: true, args: args }, (response) => {
		document.getElementById("wrapper").inert = false;
		if (response.error) {
			resetPopupView();
			showMessage("Failed to query tabs!", false);
			if (callbackFn) {
				callbackFn({ error: response.error });
			}

			return;
		} else if (deleteTabs || unloadTabs) {
			resetPopupView();
		}

		const sortBy = document.getElementById("sort_by").value;
		const compareData = {
			tab_order_asc: (a, b) => a.windowId - b.windowId || a.index - b.index,
			tab_order_desc: (a, b) => a.windowId - b.windowId || b.index - a.index,
			last_accessed_asc: (a, b) => a.lastAccessed - b.lastAccessed,
			last_accessed_desc: (a, b) => b.lastAccessed - a.lastAccessed,
			group_name_asc: (a, b) => {
				if (a.groupId === -1 && b.groupId !== -1) return 1;
				if (a.groupId !== -1 && b.groupId === -1) return -1;
				return (a.groupTitle || "").localeCompare(b.groupTitle || "");
			},
			group_name_desc: (a, b) => {
				if (a.groupId === -1 && b.groupId !== -1) return 1;
				if (a.groupId !== -1 && b.groupId === -1) return -1;
				return (b.groupTitle || "").localeCompare(a.groupTitle || "");
			},
		};
		if (response.data) {
			response.data.sort(compareData[sortBy]);
			response.data.forEach((object) => {
				const rowClone = document.getElementById("row_template").cloneNode(true);
				rowClone.removeAttribute("id");
				rowClone.setAttribute("data-tabid", parseInt(object.id, 10));
				rowClone.classList.remove("hidden");

				const tabIcon = rowClone.querySelector("button.url-icon");
				const favIconUrl = object.favIconUrl;
				tabIcon.style.backgroundImage = `url(${favIconUrl})`;
				tabIcon.addEventListener("click", function () {
					const parentElement = this.closest("div[data-tabid]");
					const tabId = parseInt(parentElement.getAttribute("data-tabid"), 10);
					chrome.runtime.sendMessage({ closeTargetTab: true, tabId: tabId }, (response) => {
						if (response.rejectedTabs.length > 0) {
							showMessage("Failed to close tab!", false);
						} else {
							rowClone.remove();
							handleTabListChanges();
							showMessage("Tab closed successfully!");
						}
					});
				});
				isImageUrlValid(favIconUrl, (isValid) => {
					if (isValid) {
						tabIcon.classList.remove("default-url-icon");
					}
				});

				const titleLabel = rowClone.querySelector("label[for='title']");
				const tabTitle = object.title;
				titleLabel.textContent = tabTitle;
				titleLabel.setAttribute("title", tabTitle);
				titleLabel.addEventListener("click", function () {
					navigator.clipboard.writeText(this.textContent);
					showMessage("Title copied to clipboard!");
				});

				const volumeButton = rowClone.querySelector("button.btn-volume");
				const volumeIcon = volumeButton.querySelector("img");
				volumeButton.addEventListener("click", function () {
					const parentElement = this.closest("div[data-tabid]");
					const tabId = parseInt(parentElement.getAttribute("data-tabid"), 10);
					chrome.runtime.sendMessage({ muteTab: true, tabId: tabId }, (response) => {
						if (response.error) {
							if (response.lastMuteState === true) {
								showMessage("Failed to unmute tab!", false);
							} else if (response.lastMuteState === false) {
								showMessage("Failed to mute tab!", false);
							} else {
								showMessage("Failed to mute/unmute tab!", false);
							}
						} else {
							const isMuted = response.isMuted;
							volumeButton.title = isMuted ? "Unmute this tab" : "Mute this tab";
							volumeIcon.src = isMuted ? "src/images/volume_muted.png" : "src/images/volume_unmuted.png";
							showMessage(isMuted ? "Tab muted successfully!" : "Tab unmuted successfully!");
						}
					});
				});
				if (object.audible) {
					const isMuted = object.mutedInfo.muted;
					volumeButton.title = isMuted ? "Unmute this tab" : "Mute this tab";
					volumeIcon.src = isMuted ? "src/images/volume_muted.png" : "src/images/volume_unmuted.png";
					volumeButton.classList.remove("hidden");
				}

				const discardButton = rowClone.querySelector("button.btn-discard");
				discardButton.addEventListener("click", function () {
					const parentElement = this.closest("div[data-tabid]");
					const tabId = parseInt(parentElement.getAttribute("data-tabid"), 10);
					chrome.runtime.sendMessage({ discardTab: true, tabId: tabId }, (response) => {
						if (response.rejectedTabs.length > 0) {
							showMessage("Failed to unload tab!", false);
						} else {
							if (filter == "<loaded>") {
								rowClone.remove();
							} else {
								rowClone.setAttribute("data-tabid", response.resolvedTabs[0].tabId);
								discardButton.classList.add("hidden");
							}

							handleTabListChanges();
							showMessage("Tab unloaded successfully!");
						}
					});
				});
				if (object.status === "unloaded") {
					discardButton.classList.add("hidden");
				}

				const pinButton = rowClone.querySelector("button.btn-pin");
				const pinIcon = pinButton.querySelector("img");
				pinButton.addEventListener("click", function () {
					const parentElement = this.closest("div[data-tabid]");
					const tabId = parseInt(parentElement.getAttribute("data-tabid"), 10);
					chrome.runtime.sendMessage({ pinTab: true, tabId: tabId }, (response) => {
						if (response.error) {
							if (response.lastPinState === true) {
								showMessage("Failed to unpin tab!", false);
							} else if (response.lastPinState === false) {
								showMessage("Failed to pin tab!", false);
							} else {
								showMessage("Failed to pin/unpin tab!", false);
							}
						} else {
							const isPinned = response.isPinned;
							pinButton.title = isPinned ? "Unpin this tab" : "Pin this tab";
							pinIcon.src = isPinned ? "src/images/pinned.png" : "src/images/unpinned.png";
							showMessage(isPinned ? "Tab pinned successfully!" : "Tab unpinned successfully!");
							queryTabs(keyword);
						}
					});
				});
				if (object.pinned) {
					const isPinned = object.pinned;
					pinButton.title = isPinned ? "Unpin this tab" : "Pin this tab";
					pinIcon.src = isPinned ? "src/images/pinned.png" : "src/images/unpinned.png";
				}

				const linkButton = rowClone.querySelector("button.btn-link");
				linkButton.addEventListener("click", function () {
					const parentElement = this.closest("div[data-tabid]");
					const tabId = parseInt(parentElement.getAttribute("data-tabid"), 10);
					chrome.runtime.sendMessage({ switchToTab: true, tabId: tabId }, (response) => {
						if (response.error) {
							showMessage("Failed to switch tab!", false);
						} else {
							showMessage("Tab switched successfully!");
						}
					});
				});

				const infoText = rowClone.querySelector("span.last-accessed-info");
				const lastAccessedTimestamp = object.lastAccessed;
				infoText.textContent = calculateLastAccessedTime(lastAccessedTimestamp);
				infoText.title = `Last accessed on ${formatDatetime(lastAccessedTimestamp)}`;

				const urlLabel = rowClone.querySelector(".tab-url");
				const tabUrl = object.pendingUrl || object.url;
				urlLabel.textContent = tabUrl;
				urlLabel.setAttribute("title", tabUrl);
				urlLabel.addEventListener("click", function () {
					navigator.clipboard.writeText(this.textContent);
					showMessage("URL copied to clipboard!");
				});
				if (object.groupId !== -1) {
					const groupTitle = rowClone.querySelector(".group-name");
					groupTitle.textContent = groupTitle.title = object.groupInfo.title;
					groupTitle.style.backgroundColor = GROUPING_COLOR_OPTIONS[object.groupInfo.color];
					groupTitle.classList.remove("hidden");
					groupTitle.addEventListener("click", function () {
						navigator.clipboard.writeText(this.textContent);
						showMessage("Group name copied to clipboard!");
					});
				}
				if (object.active) {
					rowClone.querySelector(".highlight").classList.remove("adaptive-background");
				}

				document.getElementById("tab_list").appendChild(rowClone);
			});
			handleTabListChanges();
			document.body.dataset.view = "tab_query";
			document.getElementById("options").querySelector("img").src = "src/images/menu.png";
			document.getElementById("options").setAttribute("data-state", "closed");
			document.getElementById("menu").classList.add("hidden");
			document.getElementById("footer").classList.add("hidden");
			document.getElementById("download_notifier").classList.add("hidden");
			document.getElementById("tab_query").classList.remove("hidden");
		}
		if (callbackFn) {
			callbackFn(response);
		}
	});
}

function resetOptions() {
	document.getElementById("domain_edit_all").checked = true;
	document.getElementById("manage_tabs_all").checked = true;
	document.getElementById("old_domain").value = "";
	document.getElementById("new_domain").value = "";
	document.getElementById("manage_tabs_buttons").inert = false;
	document.getElementById("manage_tabs_options").inert = false;
	document.getElementById("close_tabs_message").classList.add("hidden");
	document.getElementById("close_tabs_actions").classList.add("hidden");
}

function resetPopupView() {
	document.body.dataset.view = "tab_counter";
	document.getElementById("wrapper").inert = false;
	resetOptions();
	fetchExtensionData(() => {
		document.getElementById("loading_overlay").classList.add("hidden");
		document.getElementById("modal_overlay").classList.add("hidden");
		document.getElementById("modal_content").innerHTML = "";
		document.getElementById("selection_filter").value = "";
		document.getElementById("sort_by").value = "tab_order_asc";
		document.getElementById("filter_domain").value = "";
		document.getElementById("info_header").textContent = "Browser Information";
		document.getElementById("options").querySelector("img").src = "src/images/menu.png";
		document.getElementById("options").setAttribute("data-state", "closed");
		document.getElementById("menu").classList.add("hidden");
		document.getElementById("tab_query").classList.add("hidden");
		document.getElementById("progress").classList.add("hidden");
		document.getElementById("tab_list_container").classList.add("hidden");
		document.getElementById("tab_list").innerHTML = "";
		document.getElementById("tab_query").classList.remove("hidden");
		document.getElementById("tab_counter").classList.remove("hidden");
		document.getElementById("footer").classList.remove("hidden");
		if (document.getElementById("download_notifier").dataset.updateAvailable === "true") {
			document.getElementById("download_notifier").classList.remove("hidden");
		} else {
			document.getElementById("download_notifier").href = "#";
			document.getElementById("download_notifier").classList.add("hidden");
			document.getElementById("download_notifier").querySelector("span").textContent = `v2.0.0`;
		}
	});
}

document.addEventListener("DOMContentLoaded", () => {
	resetPopupView();

	document.getElementById("close_modal").addEventListener("click", () => {
		document.getElementById("wrapper").inert = false;
		document.getElementById("modal_overlay").classList.add("hidden");
	});
	document.getElementById("filter_domain").focus();
	document.getElementById("filter_domain").addEventListener("input", (event) => {
		clearTimeout(searchTimer);
		searchTimer = setTimeout(() => {
			const filter = document.getElementById("selection_filter");
			if (filter.value === "") {
				filter.value = "<all>";
			}

			queryTabs(event.target.value);
		}, 1000);
	});
	document.getElementById("clear_field").addEventListener("click", function () {
		const input = document.getElementById("filter_domain");
		if (input.value.length > 0) {
			input.value = "";
			queryTabs(input.value);
		}
	});
	document.getElementById("selection_filter").addEventListener("change", function () {
		if (this.value) {
			queryTabs(document.getElementById("filter_domain").value);
		} else {
			resetPopupView();
		}
	});
	document.getElementById("sort_by").addEventListener("change", () => {
		const filter = document.getElementById("selection_filter").value;
		if (filter !== "") {
			queryTabs(document.getElementById("filter_domain").value);
		}
	});
	document.getElementById("clear_all").addEventListener("click", () => {
		resetPopupView();
	});
	document.getElementById("options").addEventListener("click", function () {
		resetOptions();
		if (this.getAttribute("data-state") === "closed") {
			document.getElementById("info_header").textContent = "More Options";
			document.getElementById("tab_query").classList.add("hidden");
			document.getElementById("tab_counter").classList.add("hidden");
			document.getElementById("menu").classList.remove("hidden");
			if (document.body.dataset.view === "tab_query") {
				document.getElementById("footer").classList.remove("hidden");
			}
			if (document.getElementById("download_notifier").dataset.updateAvailable === "true") {
				document.getElementById("download_notifier").classList.remove("hidden");
			}

			this.setAttribute("data-state", "opened");
			this.querySelector("img").src = "src/images/close.png";
		} else {
			document.getElementById("menu").classList.add("hidden");
			if (document.body.dataset.view === "tab_counter") {
				document.getElementById("info_header").textContent = "Browser Information";
				document.getElementById("tab_counter").classList.remove("hidden");
				if (document.getElementById("download_notifier").dataset.updateAvailable === "true") {
					document.getElementById("download_notifier").classList.remove("hidden");
				}
			} else {
				handleTabListChanges();
				document.getElementById("footer").classList.add("hidden");
				document.getElementById("download_notifier").classList.add("hidden");
				document.getElementById("tab_query").classList.remove("hidden");
			}

			this.setAttribute("data-state", "closed");
			this.querySelector("img").src = "src/images/menu.png";
		}
	});
	document.getElementById("reset_peak_count").addEventListener("click", (event) => {
		event.preventDefault();
		chrome.runtime.sendMessage({ resetOpenedPeakTabCount: true }, (response) => {
			if (!response.error) {
				document.querySelector("#opened_peak_tabs > span[data-identifier='6']").textContent = response.openedPeakTabCount;
			}
		});
	});
	document.querySelectorAll("#color_options > button").forEach((button) => {
		button.addEventListener("click", function () {
			chrome.runtime.sendMessage({ setBadgeColor: true, badgeColor: this.dataset.badgeColor }, (response) => {
				if (!response.error) {
					markColorOptions(response.badgeColor);
				}
			});
		});
	});
	document.getElementById("check_update").addEventListener("click", () => {
		chrome.runtime.sendMessage({ checkUpdate: true }, (response) => {
			if (response.error) {
				showMessage(response.message ?? "Failed to check update!", false);
			} else {
				const notifier = document.getElementById("download_notifier");
				notifier.dataset.updateAvailable = response.updateInfo.isNewerVersion;
				if (response.updateInfo.isNewerVersion) {
					notifier.href = response.updateInfo.versionData.download_url;
					notifier.classList.remove("hidden");
					notifier.querySelector("span").textContent = `v${response.updateInfo.versionData.version}`;
				} else {
					showMessage("No newer version available!", false);
				}
			}
		});
	});
	document.getElementById("theme_toggle").addEventListener("click", () => {
		chrome.runtime.sendMessage({ setColorTheme: true, colorTheme: document.body.dataset.theme === "dark" ? "light" : "dark" }, (response) => {
			if (!response.error) {
				changeColorTheme(response.colorTheme === "dark" ? "light" : "dark");
			}
		});
	});
	document.getElementById("silence_notification").addEventListener("change", function () {
		chrome.runtime.sendMessage({ silenceNotification: true, flagValue: this.checked }, (response) => {
			if (response.error) {
				showMessage("Failed to silence notification!", false);
			} else {
				showMessage("Notification flag changed successfully!");
			}
		});
	});
	document.getElementById("replace_domain").addEventListener("click", function () {
		const filter = document.getElementById("selection_filter");
		const keyword = document.getElementById("filter_domain");
		const options = {
			useFilter: document.getElementById("domain_edit_filtered").checked && (filter.value !== "" || keyword.value !== "") ? true : false,
			extraAction: "REPLACE_DOMAIN",
		};
		this.textContent = "Loading...";
		queryTabs(keyword.value, options, (response) => {
			this.textContent = "Edit";
			resetPopupView();
			if (response.error) {
				showMessage("Failed to edit domains of listed tabs!", false);
			} else {
				const resolvedTabCount = response.resolvedTabs.length;
				const rejectedTabCount = response.rejectedTabs.length;
				showMessage(`${resolvedTabCount} tab${resolvedTabCount > 1 ? "s" : ""} affected${rejectedTabCount > 0 ? `, ${rejectedTabCount} unchanged` : ""}!`);
			}
		});
	});
	document.getElementById("close_listed_tabs").addEventListener("click", () => {
		document.getElementById("manage_tabs_options").inert = true;
		document.getElementById("manage_tabs_buttons").inert = true;
		document.getElementById("close_tabs_message").classList.remove("hidden");
		document.getElementById("close_tabs_actions").classList.remove("hidden");

		const buttonAccept = document.getElementById("close_all");
		buttonAccept.addEventListener("click", function () {
			const filter = document.getElementById("selection_filter");
			const keyword = document.getElementById("filter_domain");
			const options = {
				useFilter: document.getElementById("manage_tabs_filtered").checked && (filter.value !== "" || keyword.value !== "") ? true : false,
				extraAction: "DELETE_TABS",
			};
			this.textContent = "Loading...";
			queryTabs(keyword.value, options, (response) => {
				this.textContent = "Close Tabs";
				resetPopupView();
				if (response.error) {
					showMessage("Failed to close listed tabs!", false);
				} else {
					const closedTabCount = response.resolvedTabs.length;
					const failedTabCount = response.rejectedTabs.length;
					showMessage(`${closedTabCount} tab${closedTabCount > 1 ? "s" : ""} closed${failedTabCount > 0 ? `, ${failedTabCount} failed` : ""}!`);
				}
			});
		});

		const buttonReject = document.getElementById("keep_list");
		buttonReject.addEventListener("click", () => {
			document.getElementById("manage_tabs_options").inert = false;
			document.getElementById("manage_tabs_buttons").inert = false;
			document.getElementById("close_tabs_message").classList.add("hidden");
			document.getElementById("close_tabs_actions").classList.add("hidden");
		});
	});
	document.getElementById("unload_listed_tabs").addEventListener("click", function () {
		const filter = document.getElementById("selection_filter");
		const keyword = document.getElementById("filter_domain");
		const options = {
			useFilter: document.getElementById("manage_tabs_filtered").checked && (filter.value !== "" || keyword.value !== "") ? true : false,
			extraAction: "UNLOAD_TABS",
		};
		this.textContent = "Loading...";
		queryTabs(keyword.value, options, (response) => {
			this.textContent = "Unload Tabs";
			resetPopupView();
			if (response.error) {
				showMessage("Failed to unload listed tabs!", false);
			} else {
				const closedTabCount = response.resolvedTabs.length;
				const failedTabCount = response.rejectedTabs.length;
				showMessage(`${closedTabCount} tab${closedTabCount > 1 ? "s" : ""} unloaded${failedTabCount > 0 ? `, ${failedTabCount} failed` : ""}!`);
			}
		});
	});
	document.getElementById("download_to_json").addEventListener("click", () => {
		const filter = document.getElementById("selection_filter");
		const keyword = document.getElementById("filter_domain");
		const options = {
			useFilter: document.getElementById("manage_tabs_filtered").checked && (filter.value !== "" || keyword.value !== "") ? true : false,
			extraAction: "DOWNLOAD_JSON",
		};
		queryTabs(keyword.value, options, (response) => {
			if (response.error) {
				showMessage("Failed to download JSON data!", false);
			} else {
				const jsonString = JSON.stringify(response.data, null, 2);
				const file = new Blob([jsonString], { type: "text/json" });
				const tempLink = document.createElement("a");
				tempLink.href = URL.createObjectURL(file);
				tempLink.download = `[EXT-CTM] ${formatDatetime()}.json`;
				tempLink.click();
				resetPopupView();
				showMessage("JSON data downloaded successfully!");
			}
		});
	});
	document.getElementById("restore_from_json").addEventListener("click", function () {
		const tempInput = document.createElement("input");
		tempInput.accept = "application/json";
		tempInput.type = "file";
		tempInput.onchange = async (event) => {
			const file = event.target.files[0];
			if (!file) {
				showMessage("No file loaded!", false);
				return;
			}

			try {
				const text = await file.text();
				const data = JSON.parse(text);
				if (!Array.isArray(data)) {
					showMessage("Invalid JSON format!", false);
					return;
				}

				const urls = data.map((object) => object.url).filter(Boolean);
				if (!urls.length) {
					showMessage("No valid data found!", false);
					return;
				}

				this.textContent = "Loading...";
				chrome.runtime.sendMessage({ restoreTabs: true, data: urls }, (response) => {
					const resolvedTabCount = response.resolvedTabs.length;
					const rejectedTabCount = response.rejectedTabs.length;
					this.textContent = "Load JSON";
					resetPopupView();
					showMessage(`${resolvedTabCount} tab${resolvedTabCount > 1 ? "s" : ""} restored${rejectedTabCount > 0 ? `, ${rejectedTabCount} failed` : ""}!`);
				});
			} catch {
				showMessage("Failed to open JSON data!", false);
			}
		};
		tempInput.click();
	});
});
