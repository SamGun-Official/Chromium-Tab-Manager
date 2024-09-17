function changeColorTheme() {
	const body = document.querySelector("body");
	if (body.dataset.theme === "dark") {
		body.dataset.theme = "light";
		body.classList.add("light-theme");
		body.classList.remove("dark-theme");
		document.querySelectorAll("a").forEach((anchor) => {
			anchor.classList.add("light-theme-anchor");
			anchor.classList.remove("dark-theme-anchor");
		});
	} else {
		body.dataset.theme = "dark";
		body.classList.add("dark-theme");
		body.classList.remove("light-theme");
		document.querySelectorAll("a").forEach((anchor) => {
			anchor.classList.add("dark-theme-anchor");
			anchor.classList.remove("light-theme-anchor");
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
		document.querySelector("#opened_windows > span[data-identifier='1']").innerHTML = response.openedWindowCount;
	});
	chrome.runtime.sendMessage({ requestOpenedTabCount: true }).then((response) => {
		document.querySelector("#opened_tabs > span[data-identifier='2']").innerHTML = response.openedTabCount;
	});
	chrome.runtime.sendMessage({ requestCurrentWindowTabCount: true }).then((response) => {
		document.querySelector("#current_window_tabs > span[data-identifier='3']").innerHTML = response.currentWindowTabCount;
	});
	chrome.runtime.sendMessage({ requestOpenedPeakTabCount: true }).then((response) => {
		document.querySelector("#opened_peak_tabs > span[data-identifier='4']").innerHTML = response.openedPeakTabCount;
	});
	chrome.runtime.sendMessage({ getManifestInfo: true }).then((response) => {
		document.getElementById("extension_title").innerHTML = response.manifestName;
		document.getElementById("extension_version").innerHTML = `v${response.manifestVersion}`;
	});
}

function buttonColorOptions(event) {
	event.preventDefault();

	const badgeColor = this.dataset.badgeColor;
	chrome.runtime.sendMessage({ badgeColor: badgeColor }).then((response) => {
		console.info(`Badge background color switched to ${response.colorTheme}!`);
	});
}

document.addEventListener("DOMContentLoaded", () => {
	getSavedColorTheme();
	fetchAllData();

	document.getElementById("reset_peak_count").addEventListener("click", (event) => {
		event.preventDefault();
		chrome.runtime.sendMessage({ resetOpenedPeakTabCount: true }).then((response) => {
			document.querySelector("#opened_peak_tabs > span[data-identifier='4']").innerHTML = response.openedPeakTabCount;
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
