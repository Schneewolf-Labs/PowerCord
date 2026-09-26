# PowerCord
Receive UPS events in Discord from apcupsd or Network UPS Tools (NUT)

There are two ways to get events in, and you can mix them:
- **Push**: the UPS daemon's event hooks `curl` PowerCord's `/ups-event` endpoint (apcupsd scripts, NUT's `NOTIFYCMD`).
- **Poll**: PowerCord asks the daemon for the UPS status over its network protocol (NUT's `upsd`, apcupsd's NIS) and reports changes. No hook scripts to edit, and it notices when the daemon itself dies.

## apcupsd event scripts
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

## NUT notify command
Point `upsmon` at a script that forwards its `NOTIFYTYPE`. NUT's names (`ONBATT`, `ONLINE`, `LOWBATT`, `COMMBAD`, `NOCOMM`, `COMMOK`, `REPLBATT`, `FSD`, `SHUTDOWN`) are mapped onto the apcupsd ones in `config.json`, and `ups` prefixes the message with the UPS name.

`/etc/nut/powercord.sh` (make it executable):
```sh
#!/bin/sh
curl -s -X POST -H "Content-Type: application/json" \
  -d "{\"eventType\": \"$NOTIFYTYPE\", \"ups\": \"$UPSNAME\"}" http://localhost:1100/ups-event
```

`/etc/nut/upsmon.conf`:
```
NOTIFYCMD /etc/nut/powercord.sh
NOTIFYFLAG ONBATT SYSLOG+EXEC
NOTIFYFLAG ONLINE SYSLOG+EXEC
NOTIFYFLAG LOWBATT SYSLOG+EXEC
NOTIFYFLAG COMMBAD SYSLOG+EXEC
NOTIFYFLAG COMMOK SYSLOG+EXEC
NOTIFYFLAG NOCOMM SYSLOG+EXEC
NOTIFYFLAG REPLBATT SYSLOG+EXEC
NOTIFYFLAG FSD SYSLOG+EXEC
```

## Polling
Set either or both in `.env` (comma-separate multiple UPSes):
```
NUT_UPS=myups@localhost          # ups@host[:port], same as upsc; port defaults to 3493
APCUPSD_NIS=localhost            # host[:port]; port defaults to 3551, needs NETSERVER on in apcupsd.conf
POLL_INTERVAL=5                  # seconds
```
Status changes become the same events as the hooks: `onbattery`, `offbattery`, `lowbattery`, `changeme` (replace battery), `doshutdown` (forced shutdown), `commfailure` and `commok`. If the daemon can't be reached, or it has lost the UPS, that's a `commfailure`. Anything abnormal at startup is reported, so a restart mid-outage doesn't hide it. With more than one UPS polled, messages are prefixed with the target name.

Don't poll a UPS whose hooks also post to PowerCord, or you'll get every alert twice.

## Configuration
Create a `.env` file in the root directory of the project and provide a Discord bot token and channel ID:
```
DISCORD_TOKEN=your_token_here
DISCORD_CHANNEL_ID=your_channel_id_here
```
Edit `config.json` to change the messages that are sent to Discord. Delete an entry to silence that event. Any apcupsd event can be forwarded: add its name and message to `config.json` and a matching `curl` to its script in `/etc/apcupsd/` (e.g. `powerout`, `mainsback`, `doshutdown`). Unknown events get a 400.

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
