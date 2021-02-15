const buttonText = 'Video-Link kopieren';
const buttonTextCopied = 'In Zwischenablage kopiert';
const buttonChangeDuration = 3000;

const initialUrl = window.location.href;

document.addEventListener('DOMContentLoaded', () => {
	document.title = 'Beratung & Hilfe - Videoanruf';
	
	console.log('is? initiator', isInitiator());
	// prepend share button to body for prejoin page (if user is initiator of the video call)
	if (isInitiator()) {
		document.body.classList.add('isInitiator');
		createShareUrlButton(document.querySelector('body'));
	}
	
	/* rename prejoin join button */
	const joinButton = document.querySelector('.prejoin-preview-dropdown-container .action-btn.primary');
	if (joinButton) {
		joinButton.innerHTML = 'Jetzt Teilnehmen';
	}
		
	/* Specify with class on the body that prejoin page is active */
	document.body.classList.add('prejoin-screen');
	joinButton.addEventListener('click', () => {
		/* Specify with class on the body that videocall page is active */
		document.body.classList.remove('prejoin-screen');
		document.body.classList.add('videocall-screen');

		/* remove share-URL-button of prejoin page */
		document.querySelector('body > .shareUrlButton').remove();

		/* add new share-URL-button to toolbox as soon the DOM-element is rendered */
		if (isInitiator()) {
			waitForElement('#new-toolbox', 0)
				.then(function () {
					createShareUrlButton(document.querySelector('#new-toolbox'));
				})
				.catch(() => {
					console.error('toolbox not loaded properly');
			});
		}
	});
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
	const url = new URL(initialUrl);
	const searchParams = url.searchParams;
	searchParams.delete('isInitiator');
	url.search = searchParams.toString();
	return url.toString();
}

const isInitiator = () => {
	const url = new URL(initialUrl);
	const searchParams = url.searchParams;
	return searchParams.get('isInitiator') === 'true';
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