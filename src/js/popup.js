let searchTimer, messageTimer;

function createFilename() {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, "0");
	const day = String(now.getDate()).padStart(2, "0");
	const hours = String(now.getHours()).padStart(2, "0");
	const minutes = String(now.getMinutes()).padStart(2, "0");
	const seconds = String(now.getSeconds()).padStart(2, "0");
	const timestamp = `${year}-${month}-${day} ${hours}-${minutes}-${seconds}`;

	return timestamp;
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

		// Anchor Color
		document.querySelectorAll("a").forEach((anchor) => {
			anchor.classList.add("light-theme-anchor");
			anchor.classList.remove("dark-theme-anchor");
		});

		// Divider Color
		document.querySelectorAll(".divider").forEach((divider) => {
			divider.classList.add("dark-theme");
		});
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

		// Anchor Color
		document.querySelectorAll("a").forEach((anchor) => {
			anchor.classList.add("dark-theme-anchor");
			anchor.classList.remove("light-theme-anchor");
		});

		// Divider Color
		document.querySelectorAll(".divider").forEach((divider) => {
			divider.classList.remove("dark-theme");
		});
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

function fetchAllData() {
	chrome.runtime.sendMessage({ requestOpenedWindowCount: true }).then((response) => {
		document.querySelector("#opened_windows > span[data-identifier='1']").textContent = response.openedWindowCount;
	});
	chrome.runtime.sendMessage({ requestOpenedTabCount: true }).then((response) => {
		document.querySelector("#opened_tabs > span[data-identifier='2']").textContent = response.openedTabCount;
	});
	chrome.runtime.sendMessage({ requestCurrentWindowTabCount: true }).then((response) => {
		document.querySelector("#current_window_tabs > span[data-identifier='3']").textContent = response.currentWindowTabCount;
	});
	chrome.runtime.sendMessage({ requestOpenedPeakTabCount: true }).then((response) => {
		document.querySelector("#opened_peak_tabs > span[data-identifier='4']").textContent = response.openedPeakTabCount;
	});
	chrome.runtime.sendMessage({ getManifestInfo: true }).then((response) => {
		document.getElementById("extension_title").textContent = response.manifestName;
		document.getElementById("extension_version").textContent = `v${response.manifestVersion}`;
	});
}

function buttonColorOptions(event) {
	event.preventDefault();

	const badgeColor = this.dataset.badgeColor;
	chrome.runtime.sendMessage({ badgeColor: badgeColor }).then((response) => {
		console.info(`Badge background color switched to ${response.colorTheme}!`);
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

function queryOpenedTabs(keyword) {
	chrome.runtime.sendMessage({ queryTabs: true, keyword: keyword }).then((response) => {
		if (response.status === "OK") {
			const data = response.data;
			document.getElementById("search_count").textContent = data.length;
			if (data.length <= 0) {
				document.getElementById("search_not_found").classList.remove("hidden");
				document.getElementById("extra_btn").classList.add("hidden");
			} else {
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
								console.info(`Tab ${tabId} was closed successfully!`);
							} else {
								console.error(`Failed to close tab ${tabId}!`);
							}
						});
						parentElement.remove();
						document.getElementById("search_count").textContent = document.getElementById("tab_list").children.length;
						checkTabList();
					});
					isImageURLValid(faviconURL, (isValid) => {
						if (isValid) {
							tabIcon.classList.remove("default-icon");
						}
					});

					const linkButton = rowClone.querySelector("button.btn-link");
					linkButton.addEventListener("click", function () {
						const parentElement = this.closest("div[data-tabid]");
						const tabId = parseInt(parentElement.getAttribute("data-tabid"), 10);
						chrome.runtime.sendMessage({ switchToTab: true, tabId: tabId }).then((response) => {
							if (response.status === "OK") {
								console.info(`Tab switched to ${response.tabId}!`);
							}
						});
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
								showMesssage(isMuted ? "Tab Muted!" : "Tab Unmuted!", true);
								console.info(`Tab ${tabId} was muted successfully!`);
							} else {
								console.error(`Failed to mute tab ${tabId}!`);
							}
						});
					});
					if (object.audible) {
						const isMuted = object.mutedInfo.muted;
						const volumeIcon = volumeButton.querySelector("img");
						volumeIcon.src = isMuted ? "./src/images/volume_muted.png" : "./src/images/volume_unmuted.png";
						volumeButton.classList.remove("hidden");
					}

					const urlLabel = rowClone.querySelector("label[for='url']");
					urlLabel.textContent = object.url;
					urlLabel.setAttribute("title", object.url);
					urlLabel.addEventListener("click", function () {
						navigator.clipboard.writeText(this.textContent);
						showMesssage("URL Copied!");
					});

					document.getElementById("tab_list").appendChild(rowClone);
				});
				document.getElementById("search_not_found").classList.add("hidden");
				document.getElementById("extra_btn").classList.remove("hidden");
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

document.addEventListener("DOMContentLoaded", () => {
	getSavedColorTheme();
	fetchAllData();

	document.getElementById("close_modal").addEventListener("click", () => {
		document.getElementById("overlay").classList.add("hidden");
	});
	document.getElementById("filter_domain").focus();
	document.getElementById("filter_domain").addEventListener("input", (event) => {
		clearTimeout(searchTimer);
		searchTimer = setTimeout(() => {
			const keyword = event.target.value;
			document.getElementById("tab_list").innerHTML = "";
			if (keyword.length > 0) {
				if (keyword.toLowerCase() === "<all>") {
					queryOpenedTabs("<all>");
				} else if (keyword.toLowerCase() === "<sound>") {
					queryOpenedTabs("<sound>");
				} else {
					queryOpenedTabs(keyword);
				}

				document.getElementById("tab_query").classList.remove("hidden");
				document.getElementById("tab_counter").classList.add("hidden");
			} else {
				document.getElementById("tab_query").classList.add("hidden");
				document.getElementById("tab_counter").classList.remove("hidden");
				document.getElementById("search_not_found").classList.remove("hidden");
				document.getElementById("extra_btn").classList.add("hidden");
			}
		}, 1000);
	});
	document.getElementById("reset_peak_count").addEventListener("click", (event) => {
		event.preventDefault();
		chrome.runtime.sendMessage({ resetOpenedPeakTabCount: true }).then((response) => {
			document.querySelector("#opened_peak_tabs > span[data-identifier='4']").textContent = response.openedPeakTabCount;
		});
	});
	document.querySelectorAll(".color-options").forEach((button) => {
		button.addEventListener("click", buttonColorOptions);
	});
	document.getElementById("theme_toggle").addEventListener("click", (event) => {
		event.preventDefault();
		changeColorTheme();

		const body = document.querySelector("body");
		chrome.runtime.sendMessage({ colorTheme: body.dataset.theme }).then((response) => {
			console.info(`Popup window switched to ${response.colorTheme} theme!`);
		});
	});
	document.getElementById("close_all_tab").addEventListener("click", (event) => {
		event.preventDefault();
		document.getElementById("overlay").classList.remove("hidden");

		const popupContent = `
			<div class="flex flex-col gap-y-8 text-center text-xl">
				<span>Are you sure you want to close all listed tabs?</span>
				<div class="flex gap-x-3">
					<button id="keep_list" class="bg-[--c2] flex-1 text-[--sc] px-2 py-1 rounded-full button-border">No</button>
					<button id="remove_all" class="bg-[--c5] flex-1 text-[--sc] px-2 py-1 rounded-full button-border">Yes</button>
				</div>
			</div>`;
		document.getElementById("popup_content").innerHTML = popupContent;

		const btnAccept = document.getElementById("remove_all");
		btnAccept.addEventListener("click", () => {
			const listedTab = document.getElementById("tab_list").children;
			const tabIds = [];
			for (let tab of listedTab) {
				tabIds.push(parseInt(tab.getAttribute("data-tabid"), 10));
			}

			document.getElementById("tab_list").innerHTML = "";
			document.getElementById("search_count").textContent = document.getElementById("tab_list").children.length;
			chrome.tabs.remove(tabIds);
			checkTabList();
			document.getElementById("close_modal").click();
		});

		const btnReject = document.getElementById("keep_list");
		btnReject.addEventListener("click", () => {
			document.getElementById("close_modal").click();
		});
	});
	document.getElementById("bulk_edit_domain").addEventListener("click", (event) => {
		event.preventDefault();
		document.getElementById("overlay").classList.remove("hidden");

		const popupContent = `
			<div class="w-full flex flex-col gap-y-4 text-base">
				<div class="flex flex-col gap-y-2">
					<label for="target_old">Target Domain (Old):</label>
					<input type="text" class="border-2 border-primary rounded-lg p-2" name="target_old" id="target_old" placeholder="google.co.jp" />
				</div>
				<div class="flex flex-col gap-y-2">
					<label for="target_new">Target Domain (New):</label>
					<input type="text" class="border-2 border-primary rounded-lg p-2" name="target_new" id="target_new" placeholder="google.com" />
				</div>
				<button id="replace_domain" class="bg-[--c5] flex-1 text-[--sc] px-2 py-1 rounded-full button-border">Replace Target Domain</button>
			</div>`;
		document.getElementById("popup_content").innerHTML = popupContent;

		const btnReplace = document.getElementById("replace_domain");
		btnReplace.addEventListener("click", () => {
			const targetDomain = document.getElementById("target_old").value;
			const newDomain = document.getElementById("target_new").value;
			chrome.runtime.sendMessage({ replaceDomain: true, targetDomain: targetDomain, newDomain: newDomain }).then((response) => {
				if (response.status === "OK") {
					document.getElementById("tab_list").innerHTML = "";
					queryOpenedTabs(newDomain);
				}
			});
			document.getElementById("close_modal").click();
		});
	});
	document.getElementById("download_json").addEventListener("click", (event) => {
		event.preventDefault();

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
		tempLink.download = `[EXT-CTM] ${createFilename()}.json`;
		tempLink.click();
	});
});
