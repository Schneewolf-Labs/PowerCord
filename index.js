const express = require('express');
const app = express();
const PORT = 1100;

app.post('/ups-event', (req, res) => {
	const eventType = req.body.eventType;
	switch (eventType) {
		case 'onbattery':
			// Handle on battery event
			break;
		case 'offbattery':
			// Handle off battery event
			break;
		case 'commfailure':
			// Handle communication failure event
			break;
		case 'commok':
			// Handle communication restored event
			break;
		// ... handle other events as needed
	}
	res.sendStatus(200);
});

app.listen(PORT, () => {
	console.log(`Server listening on port ${PORT}`);
});
