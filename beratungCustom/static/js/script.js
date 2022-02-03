const buttonText = 'Video-Link kopieren';
const buttonTextCopied = 'In Zwischenablage kopiert';
const buttonChangeDuration = 3000;

const url = new URL(window.location.href);

const waitForApp = () => {
	return new Promise((resolve, reject) => {
		if (APP?.conference && APP?.connection && APP?.store){
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

let unsubscribe = null;

document.addEventListener('DOMContentLoaded', () => {
	if (!JitsiMeetJS.app) {
		return;
	}

	waitForApp()
		.then(() => {
			unsubscribe = APP.store.subscribe(() => {
				if (isModerator() && !document.body.classList.contains('isModerator')) {
					document.body.classList.add('isModerator');
				}

				const room = APP?.conference?._room;
				if (room) {
					unsubscribe();

					if (isModerator()) {
						waitForElement('#new-toolbox', 0)
							.then(function () {
								createShareUrlButton(document.querySelector('#new-toolbox .toolbox-content-items'));
							});
					}

					room.on(JitsiMeetJS.events.conference.CONFERENCE_FAILED, function (error) {
						if (error === JitsiMeetJS.errors.conference.CONFERENCE_DESTROYED) {
							document.location.href = "static/close2.html";
						}
					});
				}
			});
		});
});

const createShareUrlButton = (parentElement) => {
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
		copyUrltoClipboard(event, getShareableUrl())
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

const getShareableUrl = () => {
	const jwt = parseJwt();
	return jwt?.guestVideoCallUrl;
}

const isModerator = () => {
	const jwt = parseJwt();
	return !!jwt?.moderator;
}

/**
 * Wait for an element before resolving a promise
 * @param {String} querySelector - Selector of element to wait for
 * @param {number} timeout - Milliseconds to wait before timing out, or 0 for no timeout
 */
function waitForElement(querySelector, timeout=0){
    const startTime = new Date().getTime();
    return new Promise((resolve, reject)=>{
        const timer = setInterval(()=>{
            const now = new Date().getTime();
            if (document.querySelector(querySelector)) {
                clearInterval(timer);
                resolve();
            } else if (timeout && now - startTime >= timeout) {
                clearInterval(timer);
                reject();
            }
        }, 100);
    });
}

/**
 * Get decoded object of jwt
 */
 function parseJwt () {
 	if (!APP.connection.token) {
 		return;
	}

    const base64Url = APP.connection.token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    return JSON.parse(jsonPayload);
}
