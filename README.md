# PowerCord
Receive apcupsd events in Discord

## Prerequisites
Install `apcupsd`. Then edit the following files in `/etc/apcupsd/`:

`onbattery`:
```
curl -X POST -H "Content-Type: application/json" -d '{"eventType": "onbattery"}' http://localhost:1100/ups-event
```

`offbattery`:
```
curl -X POST -H "Content-Type: application/json" -d '{"eventType": "offbattery"}' http://localhost:1100/ups-event
```

`commfailure`:
```
curl -X POST -H "Content-Type: application/json" -d '{"eventType": "commfailure"}' http://localhost:1100/ups-event
```

`commok`:
```
curl -X POST -H "Content-Type: application/json" -d '{"eventType": "commok"}' http://localhost:1100/ups-event
```

## Configuration
Create a `.env` file in the root directory of the project and provide a Discord bot token and channel ID:
```
DISCORD_TOKEN=your_token_here
DISCORD_CHANNEL_ID=your_channel_id_here
```
Edit `config.json` to change the messages that are sent to Discord. Any apcupsd event can be forwarded: add its name and message to `config.json` and a matching `curl` to its script in `/etc/apcupsd/` (e.g. `powerout`, `mainsback`, `doshutdown`). Unknown events get a 400.

The server listens on `127.0.0.1:1100`. Set `HOST` and `PORT` in `.env` to change that; only expose it beyond localhost if apcupsd runs on another machine, since anyone who can reach it can post alerts.

## Running
```
npm install
npm start
```

## Tests
```
npm test
```

## Handing recovery to egirl
PowerCord only tells you the power went out. To have an [egirl](https://github.com/Schneewolf-Labs/egirl) instance check what died and restart it once power is back, add a second line to `offbattery` that creates a one-shot task over egirl's HTTP API:
```
curl -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $EGIRL_API_TOKEN" \
  -d '{"name": "power-recovery", "prompt": "Power just came back after running on battery. Check which services and long-running jobs on this box were interrupted, restart what should be running, and report what you found."}' \
  http://localhost:3000/tasks
```
Hook it to `offbattery`, not `onbattery`: nothing should be thinking while the UPS is draining, and apcupsd handles the shutdown itself.
