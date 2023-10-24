# PowerCord
Receive apcupsd events in Discord

# Prerequisites
Install `apcupsd`. Then edit the following files in `/etc/apcupsd/`:

`onbattery`:
```
curl -X POST -H "Content-Type: application/json" -d '{"eventType": "onbattery"}' http://localhost:3000/ups-event
```

`offbattery`:
```
curl -X POST -H "Content-Type: application/json" -d '{"eventType": "offbattery"}' http://localhost:3000/ups-event
```

`commfailure`:
```
curl -X POST -H "Content-Type: application/json" -d '{"eventType": "commfailure"}' http://localhost:3000/ups-event
```

`commok`:
```
curl -X POST -H "Content-Type: application/json" -d '{"eventType": "commok"}' http://localhost:3000/ups-event
```

# Configuration
Create a `.env` file in the root directory of the project and provide a Discord bot token and channel ID:
```
DISCORD_TOKEN=your_token_here
DISCORD_CHANNEL_ID=your_channel_id_here
```
Edit `config.json` to change the messages that are sent to Discord.

# Running
```
npm install
npm start
```
