document.addEventListener('DOMContentLoaded', (event) => {
	document.title = 'Beratung & Hilfe - Videoanruf';

	/* rename prejoin join button */
	const joinButton = document.querySelector('.prejoin-preview-dropdown-container .action-btn.primary');
	if (joinButton) {
		joinButton.innerHTML = 'Jetzt Teilnehmen';
	}
});

