const buttonText = 'Video-Link kopieren';
const buttonTextCopied = 'In Zwischenablage kopiert';
const buttonChangeDuration = 3000;

const url = new URL(window.location.href);

document.addEventListener('DOMContentLoaded', () => {
	document.title = 'Beratung - Videoanruf';
	
	// prepend share button to body for prejoin page (if user is moderator of the video call)
	if (isModerator()) {
		document.body.classList.add('isModerator');

		waitForElement('#new-toolbox', 0)
		.then(function () {
			createShareUrlButton(document.querySelector('#new-toolbox'));
		})
		.catch(() => {
			console.error('toolbox not loaded properly');
		});
	}

	/* initialize event handling for conference destruction by moderator departure */
	const inVideoRoom = () => {
		const url = window.location.pathname;
		return !(url.includes('close3.html') || url.includes('authError.html'));
	}
	waitForElement('#new-toolbox', 0).then(() => {
		if (inVideoRoom()) {
			handleConferenceDestruction();
		}
	})
});

const createShareUrlButton = (parentElement) => {
	const button = document.createElement('button');
	button.innerHTML = buttonText;
	button.classList.add('shareUrlButton');
	button.setAttribute('title', buttonText);
	button.addEventListener('click', (event) =>
		copyUrltoClipboard(event, getShareableUrl())
	);
	parentElement.prepend(button);
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
	const jwtParam = url.searchParams.get('jwt');
	const jwt = parseJwt(jwtParam);
	return jwt.guestVideoCallUrl;
}

const isModerator = () => {
	const jwtParam = url.searchParams.get('jwt');
	const jwt = parseJwt(jwtParam);
	return !!jwt.moderator;
}

const handleConferenceDestruction = () => {
	/* wait for jitsi room to be properly initialized */
	if (typeof APP !== "undefined" && typeof APP.conference !== "undefined" && APP.conference.getMyUserId()){
		/* add listener to the conference */
		APP.conference._room.on("conference.failed", function (error) {
			if (error === "conference.destroyed") {
				document.location.href = "static/close3.html";
			}
		});
	} else {
		setTimeout(handleConferenceDestruction, 250);
	}
}

/**
 * Wait for an element before resolving a promise
 * @param {String} querySelector - Selector of element to wait for
 * @param {Integer} timeout - Milliseconds to wait before timing out, or 0 for no timeout              
 */
function waitForElement(querySelector, timeout=0){
    const startTime = new Date().getTime();
    return new Promise((resolve, reject)=>{
        const timer = setInterval(()=>{
            const now = new Date().getTime();
            if(document.querySelector(querySelector)){
                clearInterval(timer);
                resolve();
            }else if(timeout && now - startTime >= timeout){
                clearInterval(timer);
                reject();
            }
        }, 100);
    });
}

/**
 * Get decoded object of jwt
 */
 function parseJwt (token) {
    var base64Url = token.split('.')[1];
    var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    var jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    return JSON.parse(jsonPayload);
};