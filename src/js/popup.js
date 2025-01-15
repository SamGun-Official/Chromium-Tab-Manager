let searchTimer, messageTimer;

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

function isImageUrlValid(url, callback) {
	const img = new Image();
	img.onload = () => callback(true);
	img.onerror = () => callback(false);
	img.src = url;
}

function queryOpenedTabs(keyword) {
	chrome.runtime.sendMessage({ queryTabs: true, keyword: keyword }).then((response) => {
		if (response.status === "OK") {
			const data = response.data;
			document.getElementById("search_count").textContent = data.length;
			if (data.length <= 0) {
				document.getElementById("search_not_found").classList.remove("hidden");
			} else {
				document.getElementById("search_not_found").classList.add("hidden");
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
					});
					isImageUrlValid(faviconURL, (isValid) => {
						if (isValid) {
							tabIcon.classList.remove("default-icon");
						}
					});

					const linkButton = rowClone.querySelector("button");
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

					const urlLabel = rowClone.querySelector("label[for='url']");
					urlLabel.textContent = object.url;
					urlLabel.setAttribute("title", object.url);
					urlLabel.addEventListener("click", function () {
						const message = document.querySelector(".message");
						navigator.clipboard.writeText(this.textContent);
						message.classList.remove("hidden");
						clearTimeout(messageTimer);
						messageTimer = setTimeout(() => {
							message.classList.add("hidden");
						}, 1000);
					});

					document.getElementById("tab_list").appendChild(rowClone);
				});
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

	document.getElementById("filter_domain").addEventListener("input", (event) => {
		clearTimeout(searchTimer);
		searchTimer = setTimeout(() => {
			const keyword = event.target.value;
			document.getElementById("tab_list").innerHTML = "";
			if (keyword.length > 0) {
				document.getElementById("tab_query").classList.remove("hidden");
				document.getElementById("tab_counter").classList.add("hidden");

				queryOpenedTabs(keyword);
			} else {
				document.getElementById("tab_query").classList.add("hidden");
				document.getElementById("tab_counter").classList.remove("hidden");
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
});
