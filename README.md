# Invoice Generator

Automated invoice generation system that analyzes **GitHub repository commits** to create accurate, deliverable-focused invoices.

## Key Advantages

**Why GitHub-First?** This tool fetches commits directly from GitHub repositories, giving you invoices based on what was actually delivered to your clients - not just what's on your local machine. This provides:
- 🎯 Accurate billing based on pushed/merged code
- 📈 Client-visible work history
- 🔍 Transparent, auditable invoicing

## Features

- 🚀 **GitHub-First**: Fetches commits directly from GitHub repos (what was actually delivered)
- 📊 Smart fallback to local repositories when needed
- 📧 Sends formatted HTML emails via Gmail
- 🗓️ Flexible scheduling (bi-weekly, weekly, monthly, custom)
- 👥 Multi-client support with configuration files
- 🛡️ **Safe by default**: Preview mode (display-only, no sending) unless explicitly told to send
- 📝 Automatically categorizes work based on commit messages
- ⏰ Configurable hours per week per client
- 🔧 Easy to add new clients without code changes
- 🌐 Works from anywhere on your machine with `invoice-gen` command

## Installation

1. Install dependencies:
```bash
npm install
```

2. Set up Gmail credentials:
```bash
cp .env.template .env
# Edit .env with your Gmail app password
```

3. Build the TypeScript files:
```bash
npm run build
```

4. Install globally (optional):
```bash
./install-global.sh
```

## Configuration

The system uses a `invoice-configs.json` file to manage multiple invoice configurations.

### Configuration File Format

```json
{
  "version": "1.0.0",
  "global": {
    "defaultFromEmail": "your@email.com",
    "defaultBcc": ["your@email.com"]
  },
  "invoices": [
    {
      "id": "client-biweekly",
      "name": "Client Name Bi-Weekly Invoice",
      "customer": "ClientName",
      "enabled": true,
      "schedule": {
        "type": "bi-weekly-sunday",
        "startDate": "2024-09-15"
      },
      "email": {
        "to": ["client@example.com"],
        "cc": ["manager@example.com"],
        "bcc": ["your@email.com"],
        "subject": "Invoice from {{startDate}} - {{endDate}}",
        "fromName": "Your Name"
      },
      "git": {
        "repos": ["owner/repo"],              // GitHub repos (primary source)
        "repoDirs": ["/path/to/local/*"],     // Local dirs (fallback)
        "weeks": 2,
        "hoursPerWeek": 30
      }
    }
  ]
}
```

### Schedule Types

- **bi-weekly-sunday**: Every other Sunday (requires `startDate`)
- **weekly-sunday**: Every Sunday
- **monthly-first**: First day of each month
- **monthly-last**: Last day of each month
- **custom**: Custom cron expression (coming soon)

### Git Configuration

The `git` section supports two types of sources:

**Primary: GitHub Repositories (`repos`)**
- Format: `"owner/repo"` (e.g., `"xferall/xferinpatient"`)
- Fetches commits via GitHub API using `gh` CLI
- Shows what was actually pushed/delivered to client
- Multiple repos supported: `["owner/repo1", "owner/repo2"]`

**Fallback: Local Directories (`repoDirs`)**
- Glob patterns supported: `"/opt/dev/xferall*"`
- Only used if GitHub fetch returns no commits
- Useful for offline work or historical data

**Example:**
```json
"git": {
  "repos": ["xferall/xferinpatient"],      // ← Try GitHub first
  "repoDirs": ["/opt/dev/xferall*"],       // ← Fallback to local
  "weeks": 2,
  "hoursPerWeek": 30
}
```

## Usage

The `invoice-gen` command works from anywhere on your system.

### List Available Configurations

```bash
invoice-gen
# or
invoice-gen --list
```

### Generate Invoice (Default: Display Only)

```bash
# Preview invoice (NO EMAIL SENT - safe by default)
invoice-gen xferall-biweekly

# With verbose output to see GitHub API calls
invoice-gen xferall-biweekly --verbose
```

### Send Invoice (Test Mode)

```bash
# Send ONLY to your test email (b@stokedconsulting.com)
invoice-gen xferall-biweekly --test
```

### Send Invoice (Production with Confirmation)

```bash
# Prompts for confirmation before sending to customers
invoice-gen xferall-biweekly --send

# Example prompt:
# "Are you sure you want to send this invoice to:
#   - chris.mountzouris@xferall.com
#   - tony.forma@xferall.com
#  CC: brianstoker@gmail.com
#
#  [Invoice preview displayed]
#
#  Send invoice? (y/n)"
```

## Automated Scheduling

### Set Up Scheduler

The scheduler automatically runs all enabled invoices based on their schedules:

```bash
./setup-scheduler.sh
```

This creates a launchd job that runs every Sunday at 9:00 AM and checks which invoices should run that day.

### Manage Scheduler

```bash
# Check status
launchctl list | grep invoice

# Stop scheduler
launchctl unload ~/Library/LaunchAgents/com.stokedconsulting.invoice-generator.plist

# Start scheduler
launchctl load ~/Library/LaunchAgents/com.stokedconsulting.invoice-generator.plist

# View logs
tail -f scheduler.log
```

## Adding a New Client

1. Edit `invoice-configs.json`
2. Add a new invoice configuration:

```json
{
  "id": "newclient-monthly",
  "name": "New Client Monthly Invoice",
  "customer": "NewClient",
  "enabled": true,
  "schedule": {
    "type": "monthly-first"
  },
  "email": {
    "to": ["client@newclient.com"],
    "subject": "Monthly Invoice {{startDate}} - {{endDate}}"
  },
  "git": {
    "repos": ["/opt/dev/newclient*"],
    "weeks": 4,
    "hoursPerWeek": 40
  }
}
```

3. Test it:
```bash
invoice newclient-monthly --test --dry-run
```

4. Enable when ready - it will automatically run on schedule!

## Gmail Setup

1. Enable 2-factor authentication on your Google account
2. Generate an app password:
   - Go to https://myaccount.google.com/security
   - Click on "2-Step Verification"
   - Click on "App passwords"
   - Generate a new password for "Mail"
3. Add the password to `.env` file:
```
GMAIL_USER=your@email.com
GMAIL_APP_PASSWORD=your-app-password-here
```

## Invoice Format

The invoice includes:
- Week-by-week breakdown
- Task categorization based on commit analysis
- Configurable hours per week
- HTML formatted email with professional styling

## Commit Analysis

The system categorizes commits into:
- Bug fixes and error resolution
- New feature development
- Code refactoring and optimization
- Testing and quality assurance
- Documentation updates
- UI/UX improvements
- Database and data management
- API development
- Deployment and DevOps
- Domain-specific categories (fax, dashboard, etc.)
- General development and maintenance

Hours are distributed proportionally based on commit activity in each category.

## Troubleshooting

### Email not sending
- Check `.env` file has correct Gmail app password
- Verify 2-factor authentication is enabled
- Check `scheduler-error.log` for errors

### Scheduler not running
- Verify launchd job is loaded: `launchctl list | grep invoice`
- Check logs in `scheduler.log` and `scheduler-error.log`
- Ensure Node.js path is correct in plist file

### No commits found
- Verify git repositories exist at configured paths
- Check glob patterns in config match your repos
- Run with `--verbose` flag for detailed output

### Config not found
- Verify `invoice-configs.json` exists in project root
- Check JSON is valid (no trailing commas, proper quotes)
- Ensure config ID matches exactly (case-sensitive)

## Development

### Project Structure

```
invoice-generator/
├── src/
│   ├── types/
│   │   └── config.ts          # Configuration type definitions
│   ├── cli.ts                 # Command-line interface
│   ├── scheduler.ts           # Automated scheduler
│   ├── config-loader.ts       # Configuration management
│   ├── invoice-generator.ts   # Invoice generation logic
│   └── email-sender.ts        # Email sending logic
├── invoice-configs.json       # Invoice configurations
├── .env                       # Gmail credentials (not in git)
└── package.json
```

### Building

```bash
npm run build
```

### Testing

```bash
# Test invoice generation
npm run test

# Test specific config
invoice your-config-id --test --dry-run --verbose
```

## Contributing

This is a personal project, but feel free to fork and adapt for your own use!

## Credits

**Product Manager**: Brian Stoker
**Developer**: Claude (Anthropic AI Assistant)

## License

MIT
