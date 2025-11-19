# PowerCord

[![CI/CD Pipeline](https://github.com/Schneewolf-Labs/PowerCord/actions/workflows/ci.yml/badge.svg)](https://github.com/Schneewolf-Labs/PowerCord/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A production-ready UPS monitoring service that sends real-time apcupsd events to Discord with rich embeds, comprehensive error handling, and enterprise-grade features.

## Features

- **Rich Discord Notifications**: Beautiful embeds with color-coded severity levels
- **Comprehensive Event Support**: Handles all 17 apcupsd event types
- **Production-Ready**: Error handling, logging, rate limiting, and graceful shutdown
- **Security**: Webhook authentication, Helmet.js protection, input validation
- **Health Checks**: Kubernetes-style `/health`, `/ready`, and `/alive` endpoints
- **Docker Support**: Multi-stage builds with health checks and resource limits
- **Message Queuing**: Never lose events, even during Discord disconnections
- **Extensive Testing**: 70%+ test coverage with Jest
- **CI/CD Pipeline**: Automated testing and Docker builds via GitHub Actions

## Quick Start

### Using Docker (Recommended)

1. **Clone the repository**
   ```bash
   git clone https://github.com/Schneewolf-Labs/PowerCord.git
   cd PowerCord
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your Discord credentials
   ```

3. **Start with Docker Compose**
   ```bash
   docker-compose up -d
   ```

### Using Node.js

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your Discord credentials
   ```

3. **Start the service**
   ```bash
   npm start
   ```

## Configuration

### Environment Variables

Create a `.env` file in the project root:

```bash
# Required
DISCORD_TOKEN=your_discord_bot_token
DISCORD_CHANNEL_ID=your_discord_channel_id

# Optional
PORT=1100                        # Server port (default: 1100)
NODE_ENV=production              # Environment: development, production, test
WEBHOOK_SECRET=your_secret_key   # Webhook authentication (recommended)
LOG_LEVEL=info                   # Logging level: error, warn, info, debug
```

### Discord Bot Setup

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Navigate to "Bot" and create a bot
4. Copy the bot token to `DISCORD_TOKEN` in your `.env`
5. Enable "Message Content Intent" under Bot settings
6. Invite bot to your server with permissions: `Send Messages`, `Embed Links`
7. Copy the channel ID where you want notifications (enable Developer Mode in Discord)

### Message Configuration

Edit `config.json` to customize Discord messages for each event type:

```json
{
  "onbattery": "⚠️ Warning: System is now running on battery power!",
  "offbattery": "✅ AC power has been restored.",
  ...
}
```

## apcupsd Integration

### Prerequisites

Install apcupsd on your system:

```bash
# Ubuntu/Debian
sudo apt-get install apcupsd

# CentOS/RHEL
sudo yum install apcupsd

# macOS
brew install apcupsd
```

### Configure Event Scripts

Edit the event scripts in `/etc/apcupsd/` to call PowerCord's webhook:

**With authentication (recommended):**

`/etc/apcupsd/onbattery`:
```bash
#!/bin/bash
curl -X POST -H "Content-Type: application/json" \
     -d '{"eventType": "onbattery", "secret": "your_webhook_secret"}' \
     http://localhost:1100/ups-event
```

**Without authentication:**

`/etc/apcupsd/onbattery`:
```bash
#!/bin/bash
curl -X POST -H "Content-Type: application/json" \
     -d '{"eventType": "onbattery"}' \
     http://localhost:1100/ups-event
```

Make scripts executable:
```bash
sudo chmod +x /etc/apcupsd/onbattery
sudo chmod +x /etc/apcupsd/offbattery
sudo chmod +x /etc/apcupsd/commfailure
sudo chmod +x /etc/apcupsd/commok
# ... and so on for other events
```

### Supported Events

PowerCord supports all apcupsd events:

| Event | Description | Severity |
|-------|-------------|----------|
| `onbattery` | UPS switched to battery | Critical |
| `offbattery` | AC power restored | Success |
| `commok` | Communication established | Success |
| `commfailure` | Communication lost | Warning |
| `failing` | UPS is failing | Critical |
| `changeme` | Battery needs replacement | Warning |
| `loadlimit` | Load limit exceeded | Warning |
| `runlimit` | Runtime limit exceeded | Warning |
| `doshutdown` | System shutdown initiated | Critical |
| `emergency` | Emergency shutdown | Critical |
| `battdetach` | Battery detached | Critical |
| `battattach` | Battery attached | Success |
| `startself` | Self-test started | Info |
| `timeout` | Operation timeout | Warning |
| `mainsback` | Mains power returned | Success |
| `annoyme` | UPS needs attention | Info |
| `remotedown` | Remote UPS down | Warning |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | API information |
| `/health` | GET | Basic health check |
| `/status` | GET | Detailed status including Discord connection |
| `/ready` | GET | Kubernetes readiness probe |
| `/alive` | GET | Kubernetes liveness probe |
| `/ups-event` | POST | Receive UPS events |

## Development

### Running Tests

```bash
# Run all tests with coverage
npm test

# Run tests in watch mode
npm run test:watch

# Run CI tests
npm run test:ci
```

### Linting

```bash
# Check for linting errors
npm run lint

# Fix linting errors
npm run lint:fix
```

### Development Mode

```bash
npm run dev
```

## Deployment

### Docker

Build and run with Docker:

```bash
# Build image
docker build -t powercord .

# Run container
docker run -d \
  --name powercord \
  --env-file .env \
  -p 1100:1100 \
  -v $(pwd)/logs:/app/logs \
  powercord
```

### Docker Compose

```bash
# Start service
docker-compose up -d

# View logs
docker-compose logs -f

# Stop service
docker-compose down
```

### Systemd Service

Create `/etc/systemd/system/powercord.service`:

```ini
[Unit]
Description=PowerCord UPS Monitor
After=network.target apcupsd.service

[Service]
Type=simple
User=powercord
WorkingDirectory=/opt/powercord
ExecStart=/usr/bin/node index.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=powercord

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable powercord
sudo systemctl start powercord
```

## Monitoring

### Logs

Logs are stored in the `logs/` directory:
- `combined.log` - All logs
- `error.log` - Error logs only
- `exceptions.log` - Uncaught exceptions
- `rejections.log` - Unhandled promise rejections

### Health Checks

Check service health:
```bash
curl http://localhost:1100/health
curl http://localhost:1100/status
```

## Security Considerations

1. **Enable Webhook Authentication**: Always set `WEBHOOK_SECRET` in production
2. **Firewall**: Only allow apcupsd host to access port 1100
3. **Discord Token**: Never commit `.env` files or expose your bot token
4. **Rate Limiting**: Built-in protection against abuse (30 requests/minute)
5. **Input Validation**: All inputs are validated and sanitized

## Troubleshooting

### Discord Connection Issues

Check Discord status:
```bash
curl http://localhost:1100/status | jq .discord
```

View logs:
```bash
tail -f logs/combined.log
```

### Events Not Triggering

1. Test webhook manually:
   ```bash
   curl -X POST -H "Content-Type: application/json" \
        -d '{"eventType": "onbattery"}' \
        http://localhost:1100/ups-event
   ```

2. Check apcupsd event scripts are executable
3. Verify PowerCord is running on the correct port
4. Check firewall settings

### High Memory Usage

Adjust Docker resource limits in `docker-compose.yml`

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Write tests for new features
4. Ensure all tests pass
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details

## Support

- Report bugs: [GitHub Issues](https://github.com/Schneewolf-Labs/PowerCord/issues)
- Questions: Open a discussion on GitHub

## Acknowledgments

- Built with [discord.js](https://discord.js.org/)
- Designed for [apcupsd](http://www.apcupsd.org/)
- Inspired by the need for reliable UPS monitoring
