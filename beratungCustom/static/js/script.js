const buttonText = 'Video-Link kopieren';
const buttonTextCopied = 'In Zwischenablage kopiert';
const buttonChangeDuration = 3000;

const e2eEncText = 'Dieser Video-Call ist mit der Ende-zu-Ende Verschlüsselung gesichert.';
const transportEncText = 'Dieser Video-Call ist mit der Transportverschlüsselung gesichert';

const url = new URL(window.location.href);

const waitForApp = () => {
	return new Promise((resolve, reject) => {
		if (APP?.store) {
			resolve();
		} else {
			setTimeout(() => {
				waitForApp()
					.then(resolve)
					.catch(reject);
			}, 250);
		}
	});
}

let e2eeBanner = null;

const changeE2EEBanner = (type) => {
	switch (type) {
		case 'e2ee':
			e2eeBanner.querySelector('.text').innerText = e2eEncText;
			break;
		case 'transport':
			e2eeBanner.querySelector('.text').innerText = transportEncText;
			break;
	}
}

let eventsRegistered = false;
let e2eeActivationTimeout = null;
let e2eeDisabling = false;
let e2eeEnabling = false;
let e2eeLastState = null;

document.addEventListener('DOMContentLoaded', () => {
	if (!JitsiMeetJS.app) {
		return;
	}

	if (!document.getElementById('e2ee-banner')) {
		createE2EEBanner();
	}

	waitForApp()
		.then(() => {
			e2eeLastState = APP.store.getState()['features/e2ee']?.enabled ?? false;
			APP.store.subscribe(() => {
				const featuresBaseConnection = APP.store.getState()['features/base/connection'];
				if (featuresBaseConnection.error?.name === 'connection.passwordRequired') {
					document.location.href = "/static/authError.html";
				}

				const featuresLobby = APP.store.getState()['features/lobby'];
				const featuresE2ee = APP.store.getState()['features/e2ee'];
				const featuresBaseConference = APP.store.getState()['features/base/conference'];
				const featuresBaseJwt = APP.store.getState()['features/base/jwt'];

				if (e2eeLastState !== featuresE2ee.enabled) {
					e2eeLastState = featuresE2ee.enabled;
					if (featuresE2ee.enabled === true) {
						e2eeEnabling = false;
					} else {
						e2eeDisabling = false;
					}
				}

				if (isModerator(featuresBaseJwt.jwt)) {
					// If no one is knocking
					if (featuresLobby.knockingParticipants.length <= 0) {
						// Try to enable e2ee
						if (
							!featuresE2ee.enabled &&
							featuresE2ee.everyoneSupportE2EE === true &&
							!e2eeEnabling
						) {
							e2eeEnabling = true;
							// Wait some seconds until user joined and key exchange will work
							e2eeActivationTimeout = setTimeout(() => {
								APP.store.dispatch({
									type: 'TOGGLE_E2EE',
									enabled: true
								});
							}, 5000);
						}
					} else {
						if (e2eeActivationTimeout) {
							clearTimeout(e2eeActivationTimeout);
							e2eeEnabling = false;
						}

						if (featuresE2ee.enabled && !e2eeDisabling) {
							e2eeDisabling = true;
							APP.store.dispatch({
								type: 'TOGGLE_E2EE',
								enabled: false
							});
						}
					}

					if (!document.body.classList.contains('isModerator')) {
						document.body.classList.add('isModerator');
					}

					const featuresToolbox = APP.store.getState()['features/toolbox'];

					const room = featuresBaseConference?.conference?.room;
					if (room && room?.joined && featuresToolbox.enabled) {
						createShareUrlButton(document.querySelector('#new-toolbox .toolbox-content-items'), featuresBaseJwt.jwt);
					}
				}

				// Show/Hide e2ee banner for everyone
				const room = featuresBaseConference?.conference?.room;
				if (room && room?.joined) {
					if (Object.keys(room?.members).length > 1) {
						if (featuresE2ee.enabled === true) {
							changeE2EEBanner('e2ee');
						} else if (featuresE2ee.enabled === false) {
							changeE2EEBanner('transport');
						}
					} else {
						changeE2EEBanner('transport');
					}

					if (!eventsRegistered) {
						eventsRegistered = true;

						room.on(JitsiMeetJS.events.conference.CONFERENCE_FAILED, (error) => {
							if (error === JitsiMeetJS.errors.conference.CONFERENCE_DESTROYED) {
								document.location.href = "/static/close2.html";
							}
						});
					}
				}
			});
		});
});

const createE2EEBanner = () => {
	const banner = document.createElement('div');
	banner.setAttribute('id', 'e2ee-banner');

	const bannerIconFilled = document.createElement('div');
	bannerIconFilled.classList.add('e2ee-banner__icon-filled');
	bannerIconFilled.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#000000"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/></svg>`;
	const bannerIconOutline = document.createElement('div');
	bannerIconOutline.classList.add('e2ee-banner__icon-outline');
	bannerIconOutline.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#000000"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm7 10c0 4.52-2.98 8.69-7 9.93-4.02-1.24-7-5.41-7-9.93V6.3l7-3.11 7 3.11V11zm-11.59.59L6 13l4 4 8-8-1.41-1.42L10 14.17z"/></svg>`;

	banner.append(bannerIconOutline);
	banner.append(bannerIconFilled);

	const bannerText = document.createElement('div');
	bannerText.classList.add('text');
	bannerText.innerText = transportEncText;
	banner.append(bannerText);

	e2eeBanner = banner;
	document.body.prepend(banner);
}

const createShareUrlButton = (parentElement, token) => {
	let shareableUrl = getShareableUrl(token);
	if (!shareableUrl) {
		if (!window.location.hash) {
			return;
		}

		const urlSearchParams = new URLSearchParams(window.location.hash.substring(1));
		if (!urlSearchParams.has("interfaceConfig.shareableUrl")) {
			return;
		}

		const shareableUrlParam = urlSearchParams.get("interfaceConfig.shareableUrl");
		if (!shareableUrlParam || !shareableUrlParam.replaceAll('"', '')) {
			return;
		}

		shareableUrl = shareableUrlParam.replaceAll('"', '');
	}

	const id = 'ca-share-url-button';
	if (parentElement.querySelector(`#${id}`)) {
		return;
	}

	const buttonContainer1 = document.createElement('div');
	buttonContainer1.classList.add('share-url-button');
	buttonContainer1.classList.add('toolbox-button');

	const buttonContainer2 = document.createElement('div');
	buttonContainer1.append(buttonContainer2);

	const buttonContainer3 = document.createElement('div');
	buttonContainer3.classList.add('toolbox-icon');
	buttonContainer2.append(buttonContainer3);

	const button = document.createElement('button');
	button.innerHTML = buttonText;
	button.classList.add('shareUrlButton');
	button.setAttribute('id', 'ca-share-url-button');
	button.setAttribute('title', buttonText);
	button.addEventListener('click', (event) =>
		copyUrltoClipboard(event, shareableUrl)
	);

	buttonContainer3.append(button);

	parentElement.prepend(buttonContainer1);
}

const copyUrltoClipboard = (event, url) => {
	event.target.classList.add('shareUrlButton--copied');
	event.target.innerHTML = buttonTextCopied;
	// textarea is used to copy the url to the clipboard
	const textarea = document.createElement('textarea');
	textarea.value = url;
	// hide the textarea
	textarea.setAttribute('readonly', '');
	textarea.style.position = 'absolute';
	textarea.style.left = '-9999px';
	document.body.appendChild(textarea);
	// select the textarea content
	textarea.select();
	// copy the selected url to the clipboard
	document.execCommand('copy');
	// remove the textarea
	document.body.removeChild(textarea);
	// remove copied class after some seconds
	setTimeout(() => {
		event.target.classList.remove('shareUrlButton--copied');
		event.target.innerHTML = buttonText;
	}, buttonChangeDuration);
}

const getShareableUrl = (token) => {
	const jwt = parseJwt(token);
	return jwt?.guestVideoCallUrl;
}

const isModerator = (token) => {
	const jwt = parseJwt(token);
	return !!jwt?.moderator;
}

/**
 * Get decoded object of jwt
 */
function parseJwt(token) {

	const base64Url = token.split('.')[1];
	const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
	const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
		return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
	}).join(''));

	return JSON.parse(jsonPayload);
}
