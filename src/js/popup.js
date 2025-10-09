let lastKeyword = "";
let searchTimer, messageTimer;

function formatDatetime(timestamp) {
	const date = timestamp ? new Date(timestamp) : new Date();
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	const hours = String(date.getHours()).padStart(2, "0");
	const minutes = String(date.getMinutes()).padStart(2, "0");
	const seconds = String(date.getSeconds()).padStart(2, "0");
	const result = `${year}-${month}-${day} ${hours}-${minutes}-${seconds}`;

	return result;
}

function changeColorTheme() {
	const body = document.querySelector("body");
	if (body.dataset.theme === "dark") {
		// Theme Color
		body.dataset.theme = "light";
		body.classList.add("light-theme");
		body.classList.remove("dark-theme");

		// Scrollbar Color
		document.documentElement.style.setProperty("--scrollbar-thumb", "#4f4f57");
		document.documentElement.style.setProperty("--scrollbar-track", "#ececec");

		// Border Color
		document.getElementById("filter_domain").classList.add("!border-current");
		document.getElementById("sort_by").classList.add("!border-current");

		// Anchor Color
		document.querySelectorAll("a").forEach((anchor) => {
			anchor.classList.add("light-theme-anchor");
			anchor.classList.remove("dark-theme-anchor");
		});

		// Divider Color
		document.querySelectorAll(".divider").forEach((divider) => {
			divider.classList.add("dark-theme");
		});

		// Icon Color
		document.querySelectorAll(".icon").forEach((icon) => {
			icon.classList.add("light-theme");
			icon.classList.remove("dark-theme");
		});

		// Menu Color
		document.getElementById("extra_btn").classList.add("light-theme");
		document.getElementById("extra_btn").classList.remove("dark-theme");
	} else {
		// Theme Color
		body.dataset.theme = "dark";
		body.classList.add("dark-theme");
		body.classList.remove("light-theme");

		// Scrollbar Color
		document.documentElement.style.setProperty("--scrollbar-thumb", "var(--pc)");
		document.documentElement.style.setProperty("--scrollbar-track", "#0f0f14");

		// Border Color
		document.getElementById("filter_domain").classList.remove("!border-current");
		document.getElementById("sort_by").classList.remove("!border-current");

		// Anchor Color
		document.querySelectorAll("a").forEach((anchor) => {
			anchor.classList.add("dark-theme-anchor");
			anchor.classList.remove("light-theme-anchor");
		});

		// Divider Color
		document.querySelectorAll(".divider").forEach((divider) => {
			divider.classList.remove("dark-theme");
		});

		// Icon Color
		document.querySelectorAll(".icon").forEach((icon) => {
			icon.classList.add("dark-theme");
			icon.classList.remove("light-theme");
		});

		// Menu Color
		document.getElementById("extra_btn").classList.add("dark-theme");
		document.getElementById("extra_btn").classList.remove("light-theme");
	}
}

function getSavedColorTheme() {
	chrome.runtime.sendMessage({ getColorTheme: true }).then((response) => {
		const body = document.querySelector("body");
		if (response.colorTheme === "dark") {
			body.dataset.theme = "light";
		} else {
			body.dataset.theme = "dark";
		}

		changeColorTheme();
	});
}

function markColorOptions() {
	chrome.runtime.sendMessage({ getBadgeColor: true }).then((response) => {
		document.querySelectorAll(".color-options").forEach((button) => {
			const dataBadgeColor = button.dataset.badgeColor;
			if (dataBadgeColor === response.badgeColor) {
				button.textContent = "✓";
			} else {
				button.textContent = "";
			}
		});
	});
}

function fetchAllData() {
	chrome.runtime.sendMessage({ getTopSite: true }).then((response) => {
		const topSite = response.topSites[0];
		if (topSite) {
			const textHolder = document.querySelector("#most_visited_site > a[data-identifier='1']");
			textHolder.href = topSite.url;
			textHolder.textContent = textHolder.title = topSite.url;
		}
	});
	chrome.runtime.sendMessage({ requestOpenedWindowCount: true }).then((response) => {
		document.querySelector("#opened_windows > span[data-identifier='2']").textContent = response.openedWindowCount;
	});
	chrome.runtime.sendMessage({ requestOpenedTabCount: true }).then((response) => {
		document.querySelector("#opened_tabs > span[data-identifier='3']").textContent = response.openedTabCount;
	});
	chrome.runtime.sendMessage({ requestCurrentWindowTabCount: true }).then((response) => {
		document.querySelector("#current_window_tabs > span[data-identifier='4']").textContent = response.currentWindowTabCount;
	});
	chrome.runtime.sendMessage({ requestOpenedPeakTabCount: true }).then((response) => {
		document.querySelector("#opened_peak_tabs > span[data-identifier='5']").textContent = response.openedPeakTabCount;
	});
	chrome.runtime.sendMessage({ getManifestInfo: true }).then((response) => {
		document.getElementById("extension_icon").src = response.manifestIcon;
		document.getElementById("extension_title").textContent = response.manifestName;
		document.getElementById("extension_version").textContent = `v${response.manifestVersion}`;
	});
}

function isScrollAvailable(element) {
	return element.scrollHeight > element.clientHeight;
}

function isImageURLValid(url, callback) {
	const img = new Image();
	img.onload = () => callback(true);
	img.onerror = () => callback(false);
	img.src = url;
}

function checkTabList() {
	const tabList = document.getElementById("tab_list");
	if (tabList.children.length > 0) {
		return;
	}

	document.getElementById("search_not_found").classList.remove("hidden");
}

function showMesssage(status, success = true) {
	const message = document.querySelector(".message");
	message.textContent = status;
	message.classList.remove("text-green-500", "text-red-500");
	message.classList.add(success ? "text-green-500" : "text-red-500");
	message.classList.remove("hidden");
	clearTimeout(messageTimer);
	messageTimer = setTimeout(() => {
		message.classList.add("hidden");
	}, 1000);
}

function queryOpenedTabs(keyword, callback = undefined) {
	lastKeyword = keyword;
	document.getElementById("search_not_found").classList.add("hidden");
	document.getElementById("loading").classList.remove("hidden");
	document.getElementById("tab_list").innerHTML = "";
	chrome.runtime.sendMessage({ queryTabs: true, keyword: keyword }).then((response) => {
		if (response.status === "OK") {
			const data = response.data;
			document.getElementById("loading").classList.add("hidden");
			document.querySelector("#info_header").textContent = `Search Found: ${data.length}`;
			if (data.length <= 0) {
				document.getElementById("search_not_found").classList.remove("hidden");
			} else {
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
				if (compareData[sortBy]) {
					data.sort(compareData[sortBy]);
				}

				data.forEach((object) => {
					const rowTemplate = document.getElementById("row_template");
					const rowClone = rowTemplate.cloneNode(true);
					rowClone.removeAttribute("id");
					rowClone.setAttribute("data-tabid", object.id);
					rowClone.classList.remove("hidden");

					const tabIcon = rowClone.querySelector("div.icon");
					const faviconURL = object.favIconUrl;
					tabIcon.style.backgroundImage = `url(${faviconURL})`;
					tabIcon.addEventListener("click", function () {
						const parentElement = this.closest("div[data-tabid]");
						const tabId = parseInt(parentElement.getAttribute("data-tabid"), 10);
						chrome.runtime.sendMessage({ closeTargetTab: true, tabId: tabId }).then((response) => {
							if (response.status === "OK") {
								showMesssage("Tab closed successfully!");
							} else {
								showMesssage("Failed to close tab!", false);
							}
						});
						parentElement.remove();
						document.querySelector("#info_header").textContent = `Search Found: ${document.getElementById("tab_list").children.length}`;
						checkTabList();
					});
					isImageURLValid(faviconURL, (isValid) => {
						if (isValid) {
							tabIcon.classList.remove("default-icon");
						}
					});

					const titleLabel = rowClone.querySelector("label[for='title']");
					titleLabel.textContent = object.title;
					titleLabel.setAttribute("title", object.title);

					const volumeButton = rowClone.querySelector("button.btn-volume");
					volumeButton.addEventListener("click", function () {
						const parentElement = this.closest("div[data-tabid]");
						const tabId = parseInt(parentElement.getAttribute("data-tabid"), 10);
						chrome.runtime.sendMessage({ muteTab: true, tabId: tabId }).then((response) => {
							if (response.status === "OK") {
								const isMuted = response.isMuted;
								const volumeIcon = volumeButton.querySelector("img");
								volumeIcon.src = isMuted ? "./src/images/volume_muted.png" : "./src/images/volume_unmuted.png";
								showMesssage(isMuted ? "Tab muted successfully!" : "Tab unmuted successfully!");
							} else {
								showMesssage("Failed to mute/unmute tab!", false);
							}
						});
					});
					if (object.audible) {
						const volumeIcon = volumeButton.querySelector("img");
						volumeIcon.src = object.mutedInfo.muted ? "./src/images/volume_muted.png" : "./src/images/volume_unmuted.png";
						volumeButton.classList.remove("hidden");
					}

					const discardButton = rowClone.querySelector("button.btn-discard");
					discardButton.addEventListener("click", function () {
						const parentElement = this.closest("div[data-tabid]");
						const tabId = parseInt(parentElement.getAttribute("data-tabid"), 10);
						chrome.runtime.sendMessage({ discardTab: true, tabId: tabId }).then((response) => {
							if (response.status === "OK") {
								if (keyword == "<loaded>") {
									parentElement.remove();
								} else {
									parentElement.setAttribute("data-tabid", response.tabId);
									discardButton.classList.add("hidden");
								}

								document.querySelector("#info_header").textContent = `Search Found: ${document.getElementById("tab_list").children.length}`;
								showMesssage("Tab unloaded successfully!");
							} else {
								showMesssage("Failed to unload tab!", false);
							}
						});
					});
					if (object.status === "unloaded") {
						discardButton.classList.add("hidden");
					}

					const pinButton = rowClone.querySelector("button.btn-pin");
					pinButton.addEventListener("click", function () {
						const parentElement = this.closest("div[data-tabid]");
						const tabId = parseInt(parentElement.getAttribute("data-tabid"), 10);
						chrome.runtime.sendMessage({ pinTab: true, tabId: tabId }).then((response) => {
							if (response.status === "OK") {
								if (response.isPinned) {
									pinButton.title = "Unpin this tab";
									pinButton.querySelector("img").classList.remove("-rotate-45");
									showMesssage("Tab pinned successfully!");
								} else {
									pinButton.title = "Pin this tab";
									pinButton.querySelector("img").classList.add("-rotate-45");
									showMesssage("Tab unpinned successfully!");
								}

								queryOpenedTabs("<all>");
							} else {
								showMesssage("Failed to pin/unpin tab!", false);
							}
						});
					});
					if (object.pinned) {
						pinButton.title = "Unpin this tab";
						pinButton.querySelector("img").classList.remove("-rotate-45");
					}

					const linkButton = rowClone.querySelector("button.btn-link");
					linkButton.addEventListener("click", function () {
						const parentElement = this.closest("div[data-tabid]");
						const tabId = parseInt(parentElement.getAttribute("data-tabid"), 10);
						chrome.runtime.sendMessage({ switchToTab: true, tabId: tabId }).then((response) => {
							if (response.status === "OK") {
								showMesssage("Tab switched successfully!");
							} else {
								showMesssage("Failed to switch tab!", false);
							}
						});
					});

					const infoButton = rowClone.querySelector("button.btn-info");
					infoButton.title = `Last accessed on ${formatDatetime(object.lastAccessed)}`;

					const urlLabel = rowClone.querySelector("label[for='url']");
					urlLabel.textContent = object.url;
					urlLabel.setAttribute("title", object.url);
					urlLabel.addEventListener("click", function () {
						navigator.clipboard.writeText(this.textContent);
						showMesssage("URL copied to clipboard!");
					});
					if (object.groupId !== -1) {
						const groupTitle = rowClone.querySelector(".group-name");
						groupTitle.textContent = groupTitle.title = object.groupTitle;
						groupTitle.style.backgroundColor = object.groupColor;
						groupTitle.classList.remove("hidden");
					}

					document.getElementById("tab_list").appendChild(rowClone);
				});
				document.getElementById("search_not_found").classList.add("hidden");
				if (callback !== undefined) {
					callback();
				}
			}

			const tabList = document.getElementById("tab_list");
			if (isScrollAvailable(tabList)) {
				document.documentElement.style.setProperty("--scrollbar-margin", "0.75rem");
			} else {
				document.documentElement.style.setProperty("--scrollbar-margin", "0");
			}
		}
	});
}

function changePopupView() {
	document.getElementById("more_options").setAttribute("data-state", "closed");
	document.getElementById("extra_btn").classList.add("hidden");
	document.getElementById("tab_counter").classList.add("hidden");
	document.getElementById("tab_list").classList.remove("hidden");
	document.getElementById("bottom_section").classList.remove("hidden");
}

function resetPopupView() {
	lastKeyword = "";
	document.getElementById("more_options").setAttribute("data-state", "closed");
	document.getElementById("filter_domain").value = "";
	document.getElementById("info_header").textContent = "Extension Information";
	document.getElementById("extra_btn").classList.add("hidden");
	document.getElementById("loading").classList.add("hidden");
	document.getElementById("search_not_found").classList.add("hidden");
	document.getElementById("tab_list").classList.add("hidden");
	document.getElementById("tab_list").innerHTML = "";
	document.getElementById("tab_counter").classList.remove("hidden");
	document.getElementById("bottom_section").classList.remove("hidden");
}

document.addEventListener("DOMContentLoaded", () => {
	getSavedColorTheme();
	markColorOptions();
	fetchAllData();

	document.getElementsByName("show_tab_by_category").forEach((radio_button) => {
		radio_button.addEventListener("click", () => {
			document.getElementById("filter_domain").value = "";
			queryOpenedTabs(radio_button.value);
			changePopupView();
		});
	});
	document.getElementById("sort_by").addEventListener("change", () => {
		if (lastKeyword !== "") {
			queryOpenedTabs(lastKeyword);
			changePopupView();
		}
	});
	document.getElementById("clear_all").addEventListener("click", () => {
		const radioButtonSet = document.querySelector('input[name="show_tab_by_category"]:checked');
		if (radioButtonSet) {
			document.querySelector('input[name="show_tab_by_category"]:checked').checked = false;
		}

		resetPopupView();
	});
	document.getElementById("close_modal").addEventListener("click", () => {
		document.getElementById("overlay").classList.add("hidden");
	});
	document.getElementById("filter_domain").focus();
	document.getElementById("filter_domain").addEventListener("input", (event) => {
		const radioButtonSet = document.querySelector('input[name="show_tab_by_category"]:checked');
		if (radioButtonSet) {
			document.querySelector('input[name="show_tab_by_category"]:checked').checked = false;
		}

		clearTimeout(searchTimer);
		searchTimer = setTimeout(() => {
			const keyword = event.target.value;
			document.getElementById("tab_list").innerHTML = "";
			if (keyword.length > 0) {
				queryOpenedTabs(keyword.toLowerCase());
				changePopupView();
			} else {
				resetPopupView();
			}
		}, 1000);
	});
	document.getElementById("reset_peak_count").addEventListener("click", (event) => {
		event.preventDefault();
		chrome.runtime.sendMessage({ resetOpenedPeakTabCount: true }).then((response) => {
			document.querySelector("#opened_peak_tabs > span[data-identifier='5']").textContent = response.openedPeakTabCount;
		});
	});
	document.querySelectorAll(".color-options").forEach((button) => {
		button.addEventListener("click", function () {
			const badgeColor = this.dataset.badgeColor;
			chrome.runtime.sendMessage({ badgeColor: badgeColor }).then((response) => {
				console.info(`Badge background color switched to ${response.colorTheme}!`);
			});
			markColorOptions();
		});
	});
	document.getElementById("theme_toggle").addEventListener("click", () => {
		const body = document.querySelector("body");
		changeColorTheme();
		chrome.runtime.sendMessage({ colorTheme: body.dataset.theme }).then((response) => {
			console.info(`Popup window switched to ${response.colorTheme} theme!`);
		});
	});
	document.getElementById("more_options").addEventListener("click", function () {
		if (this.getAttribute("data-state") === "closed") {
			document.getElementById("extra_btn").classList.remove("hidden");
			document.getElementById("bottom_section").classList.add("hidden");
			this.setAttribute("data-state", "opened");
		} else {
			document.getElementById("info_header").textContent = "Extension Information";
			document.getElementById("bottom_section").classList.remove("hidden");
			document.getElementById("extra_btn").classList.add("hidden");
			this.setAttribute("data-state", "closed");
		}
	});
	document.getElementById("close_listed_tabs").addEventListener("click", () => {
		const popupContent = `
			<div class="flex flex-col gap-y-8 text-center text-xl">
				<span>Are you sure you want to close all listed tabs?</span>
				<div class="flex gap-x-3">
					<button id="keep_list" class="bg-[--c2] flex-1 text-[--sc] px-2 py-1 rounded-md button-border">No</button>
					<button id="remove_all" class="bg-[--c5] flex-1 text-[--sc] px-2 py-1 rounded-md button-border">Yes</button>
				</div>
			</div>
		`;
		document.getElementById("overlay").classList.remove("hidden");
		document.getElementById("popup_content").innerHTML = popupContent;

		const buttonAccept = document.getElementById("remove_all");
		buttonAccept.addEventListener("click", () => {
			const listedTab = document.getElementById("tab_list").children;
			const tabIds = [];
			for (let tab of listedTab) {
				tabIds.push(parseInt(tab.getAttribute("data-tabid"), 10));
			}

			document.getElementById("tab_list").innerHTML = "";
			chrome.tabs.remove(tabIds);
			checkTabList();
			document.getElementById("close_modal").click();
			if (tabIds.length > 0) {
				showMesssage("Listed tabs closed successfully!");
			} else {
				showMesssage("Failed to close listed tabs!", false);
			}
		});

		const buttonReject = document.getElementById("keep_list");
		buttonReject.addEventListener("click", () => {
			document.getElementById("close_modal").click();
		});
	});
	document.getElementById("bulk_edit_domain").addEventListener("click", () => {
		const popupContent = `
			<div class="w-full flex flex-col gap-y-4 text-base">
				<div class="flex flex-col gap-y-1.5">
					<label for="target_old">Target Domain (Old):</label>
					<input type="text" class="border-2 border-primary rounded-md p-2" name="target_old" id="target_old" placeholder="google.co.jp" />
				</div>
				<div class="flex flex-col gap-y-1.5">
					<label for="target_new">Target Domain (New):</label>
					<input type="text" class="border-2 border-primary rounded-md p-2" name="target_new" id="target_new" placeholder="google.com" />
				</div>
				<button id="replace_domain" class="bg-[--c5] flex-1 text-[--sc] px-2 py-1 rounded-md button-border">Replace Target Domain</button>
			</div>
		`;
		document.getElementById("overlay").classList.remove("hidden");
		document.getElementById("popup_content").innerHTML = popupContent;

		const buttonReplace = document.getElementById("replace_domain");
		buttonReplace.addEventListener("click", () => {
			const targetDomain = document.getElementById("target_old").value;
			const newDomain = document.getElementById("target_new").value;
			chrome.runtime.sendMessage({ replaceDomain: true, targetDomain: targetDomain, newDomain: newDomain }).then((response) => {
				if (response.status === "OK") {
					document.getElementById("tab_list").innerHTML = "";
					queryOpenedTabs(newDomain);
					showMesssage("Domain edited successfully!");
				}
			});
			document.getElementById("close_modal").click();
		});
	});
	document.getElementById("download_to_json").addEventListener("click", () => {
		function callback() {
			const listedTab = document.getElementById("tab_list").children;
			const newData = [];
			for (let tab of listedTab) {
				newData.push({
					tabId: parseInt(tab.getAttribute("data-tabid"), 10),
					title: tab.querySelector("label[for='title']").textContent,
					url: tab.querySelector("label[for='url']").textContent,
				});
			}

			const jsonString = JSON.stringify(newData, null, 2);
			const tempLink = document.createElement("a");
			const file = new Blob([jsonString], { type: "text/json" });
			tempLink.href = URL.createObjectURL(file);
			tempLink.download = `[EXT-CTM] ${formatDatetime()}.json`;
			tempLink.click();
			document.getElementById("tab_list").innerHTML = "";
			showMesssage("JSON data downloaded!");
		}

		if (lastKeyword === "") {
			queryOpenedTabs("<all>", callback);
			return;
		}

		callback();
	});
	document.getElementById("restore_from_json").addEventListener("click", async () => {
		const tempInput = document.createElement("input");
		tempInput.accept = "application/json";
		tempInput.type = "file";
		tempInput.onchange = async (event) => {
			const file = event.target.files[0];
			if (!file) {
				showMesssage("No file loaded!", false);
				return;
			}

			try {
				const text = await file.text();
				const data = JSON.parse(text);
				if (!Array.isArray(data)) {
					showMesssage("Invalid JSON format!", false);
					return;
				}

				const urls = data.map((object) => object.url).filter(Boolean);
				if (!urls.length) {
					showMesssage("No valid data found!", false);
					return;
				}

				chrome.runtime.sendMessage({ restoreTabs: true, data: urls }).then((response) => {
					if (response.status === "OK") {
						showMesssage("Tabs restored successfully!");
					} else {
						showMesssage("Failed to restore tabs!", false);
					}
				});
			} catch {
				showMesssage("Failed to open JSON data!", false);
			}
		};
		tempInput.click();
	});
});
