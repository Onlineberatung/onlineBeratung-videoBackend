const buttonText = 'Video-Link kopieren';
const buttonTextCopied = 'Video-Link wurde in die Zwischenablage kopiert';
const buttonChangeDuration = 3000;

const url = new URL(window.location.href);
const DEBUG = true;

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

let eventsRegistered = false;
let e2eeActivationTimeout = null;
let e2eeDisabling = false;
let e2eeEnabling = false;
let e2eeLastState = null;
let e2eeStateChanged = null;

const Logger = {
	log: (message) => DEBUG && console.log('[LOG][JITSI]', message),
	error: (message) => DEBUG && console.error('[ERROR][JITSI]', message),
	info: (message) => DEBUG && console.info('[INFO][JITSI]', message),
}

document.addEventListener('DOMContentLoaded', () => {
	if (!JitsiMeetJS.app) {
		return;
	}

	Logger.log("Wait for app ...");
	waitForApp()
		.then(() => {
			e2eeLastState = APP.store.getState()['features/e2ee']?.enabled ?? false;
			e2eeStateChanged = false;
			Logger.log("App store subscribe ...");
			APP.store.subscribe(() => {
				const featuresBaseConnection = APP.store.getState()['features/base/connection'];
				if (featuresBaseConnection.error?.name === 'connection.passwordRequired') {
					Logger.error("Password required!");
					document.location.href = "/static/authError.html";
				}

				const featuresLobby = APP.store.getState()['features/lobby'];
				const featuresE2ee = APP.store.getState()['features/e2ee'];
				const featuresBaseConference = APP.store.getState()['features/base/conference'];
				const featuresBaseJwt = APP.store.getState()['features/base/jwt'];
				const room = featuresBaseConference?.conference?.room;

				if (e2eeLastState !== featuresE2ee.enabled) {
					e2eeStateChanged = true;
					e2eeLastState = featuresE2ee.enabled;
					if (featuresE2ee.enabled === true) {
						Logger.log("E2EE State changed: enabled");
						e2eeEnabling = false;
					} else {
						Logger.log("E2EE State changed: disabled");
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
							!e2eeEnabling &&
							room && room.joined && Object.keys(room.members).length > 1
						) {
							Logger.log("Ready for enabling e2ee in 5 seconds!");
							e2eeEnabling = true;
							// Wait some seconds until user joined and key exchange will work
							e2eeActivationTimeout = setTimeout(() => {
								Logger.log("Start enabling e2ee ...");
								APP.store.dispatch({
									type: 'TOGGLE_E2EE',
									enabled: true
								});
							}, 5000);
						} else {
							if (room && room.joined && Object.keys(room.members).length <= 1) {
								// No log. Only to less members in room
							} else if (featuresE2ee.enabled) {
								Logger.log("E2EE could not be enabled because e2ee is already enabled!");
							} else if (featuresE2ee.everyoneSupportE2EE !== true) {
								Logger.error("E2EE could not be enabled because not everyone supports e2ee!");
							} else if (e2eeEnabling) {
								Logger.log("E2EE could not be enabled because enabling process already running!");
							}
						}
					} else {
						if (e2eeActivationTimeout) {
							Logger.log("Stop running e2ee enabling process");
							clearTimeout(e2eeActivationTimeout);
							e2eeActivationTimeout = null;
							e2eeEnabling = false;
						}

						if (featuresE2ee.enabled && !e2eeDisabling) {
							Logger.log("Disabling e2ee because of knocking participant");
							e2eeDisabling = true;
							APP.store.dispatch({
								type: 'TOGGLE_E2EE',
								enabled: false
							});
						} else if (featuresE2ee.enabled && e2eeDisabling) {
							Logger.log("E2EE disabling already in progress.");
						} else {
							Logger.log("E2EE already disabled.");
						}
					}

					if (!document.body.classList.contains('isModerator')) {
						document.body.classList.add('isModerator');
					}

					const featuresToolbox = APP.store.getState()['features/toolbox'];
					if (room && room?.joined && featuresToolbox.enabled) {
						createShareUrlButton(document.querySelector('#new-toolbox .toolbox-content-items'), featuresBaseJwt.jwt);
					}
				}

				// Show/Hide e2ee banner for everyone
				if (room && room?.joined) {

					if (e2eeStateChanged) {
						Logger.log("Room joined");
						if (Object.keys(room?.members).length > 1) {
							Logger.log("ENABLED " + APP.API._enabled);
							Logger.log("E2EE " + featuresE2ee.enabled);
							Logger.log("Sending custom e2ee toggle event enabled");
							APP.API._sendEvent({
								name: 'custom-e2ee-toggled',
								enabled: featuresE2ee.enabled
							});
						} else {
							Logger.log("Sending custom e2ee toggle event disabled");
							APP.API._sendEvent({
								name: 'custom-e2ee-toggled',
								enabled: false
							});
						}

						e2eeStateChanged = false;
					}

					if (!eventsRegistered) {
						eventsRegistered = true;

						room.on(JitsiMeetJS.events.conference.CONFERENCE_FAILED, (error) => {
							if (error === JitsiMeetJS.errors.conference.CONFERENCE_DESTROYED) {
								Logger.error("Conference destroyed!");
								document.location.href = "/static/close2.html";
							}
						});
					}
				}
			});
		});
});

const getParamFromUrl = (key) => {
	if (!window.location.hash) {
		return null;
	}

	const urlSearchParams = new URLSearchParams(window.location.hash.substring(1));
	if (!urlSearchParams.has(key)) {
		return null;
	}

	const param = urlSearchParams.get(key);
	if (!param || !param.replaceAll('"', '')) {
		return null;
	}

	return param.replaceAll('"', '');
}

const getShareableUrlFromUrl = () => {
	if (!window.location.hash) {
		return null;
	}

	const urlSearchParams = new URLSearchParams(window.location.hash.substring(1));
	if (!urlSearchParams.has("interfaceConfig.shareableUrl")) {
		return null;
	}

	const shareableUrlParam = urlSearchParams.get("interfaceConfig.shareableUrl");
	if (!shareableUrlParam || !shareableUrlParam.replaceAll('"', '')) {
		return null;
	}

	return shareableUrlParam.replaceAll('"', '');
}

const createShareUrlButton = (parentElement, token) => {
	let shareableUrl = getShareableUrlFromUrl();
	if (!shareableUrl) {
		shareableUrl = getShareableUrl(token);
	}

	const btnText = decodeURI(getParamFromUrl('interfaceConfig.btnText') ?? buttonText);
	const btnTextCopied = decodeURI(getParamFromUrl('interfaceConfig.btnTextCopied') ?? buttonTextCopied);

	const id = 'ca-share-url-button';
	if (parentElement.querySelector(`#${id}`)) {
		return;
	}
	Logger.log("Create share url button");

	const buttonContainer1 = document.createElement('div');
	buttonContainer1.classList.add('share-url-button');
	buttonContainer1.classList.add('toolbox-button');

	const buttonContainer2 = document.createElement('div');
	buttonContainer1.append(buttonContainer2);

	const buttonContainer3 = document.createElement('div');
	buttonContainer3.classList.add('toolbox-icon');
	buttonContainer2.append(buttonContainer3);

	const button = document.createElement('button');
	button.innerHTML = btnText;
	button.classList.add('shareUrlButton');
	button.setAttribute('id', 'ca-share-url-button');
	button.setAttribute('title', btnText);
	button.addEventListener('click', (event) =>
		copyUrltoClipboard(event, shareableUrl, btnText, btnTextCopied)
	);

	buttonContainer3.append(button);

	const tooltip = document.createElement('div');
	tooltip.innerHTML = btnTextCopied;
	tooltip.classList.add('shareUrlButton__tooltip');
	buttonContainer3.append(tooltip);

	parentElement.prepend(buttonContainer1);
}

const copyUrltoClipboard = (event, url, btnText, btnTextCopied) => {
	event.target.classList.add('shareUrlButton--copied');
	event.target.innerHTML = btnTextCopied;
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
		event.target.innerHTML = btnText;
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
