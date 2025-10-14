#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}Setting up Invoice Generator Scheduler${NC}"
echo "========================================"

# Get the absolute path to the invoice generator
INVOICE_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
NODE_PATH="$(which node)"
NPM_PATH="$(which npm)"

if [ -z "$NODE_PATH" ]; then
    echo -e "${RED}Error: Node.js not found. Please install Node.js first.${NC}"
    exit 1
fi

# Install dependencies
echo -e "${BLUE}Installing dependencies...${NC}"
cd "$INVOICE_DIR"
npm install

# Build the TypeScript files
echo -e "${BLUE}Building TypeScript files...${NC}"
npm run build

# Create the launchd plist file
PLIST_NAME="com.stokedconsulting.invoice-generator"
PLIST_PATH="$HOME/Library/LaunchAgents/${PLIST_NAME}.plist"

echo -e "${BLUE}Creating launchd plist...${NC}"

cat > "$PLIST_PATH" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${PLIST_NAME}</string>
    
    <key>ProgramArguments</key>
    <array>
        <string>${NODE_PATH}</string>
        <string>${INVOICE_DIR}/dist/scheduler.js</string>
    </array>
    
    <key>WorkingDirectory</key>
    <string>${INVOICE_DIR}</string>
    
    <key>StartCalendarInterval</key>
    <array>
        <dict>
            <key>Weekday</key>
            <integer>0</integer>
            <key>Hour</key>
            <integer>9</integer>
            <key>Minute</key>
            <integer>0</integer>
        </dict>
    </array>
    
    <key>StandardOutPath</key>
    <string>${INVOICE_DIR}/scheduler.log</string>
    
    <key>StandardErrorPath</key>
    <string>${INVOICE_DIR}/scheduler-error.log</string>
    
    <key>RunAtLoad</key>
    <false/>
    
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    </dict>
</dict>
</plist>
EOF

# Load the launchd job
echo -e "${BLUE}Loading launchd job...${NC}"
launchctl unload "$PLIST_PATH" 2>/dev/null
launchctl load "$PLIST_PATH"

echo -e "${GREEN}✅ Scheduler setup complete!${NC}"
echo ""
echo "The invoice generator will run every Sunday at 9:00 AM"
echo "It will only send invoices on the appropriate bi-weekly schedule"
echo ""
echo -e "${YELLOW}Important: Don't forget to set up your Gmail credentials!${NC}"
echo "Create a .env file with: GMAIL_APP_PASSWORD=your-app-password"
echo ""
echo "To test the scheduler manually, run:"
echo "  npm run test"
echo ""
echo "To generate an invoice manually, run:"
echo "  npm run invoice xferall"
echo ""
echo "To check the scheduler status:"
echo "  launchctl list | grep invoice"
echo ""
echo "To stop the scheduler:"
echo "  launchctl unload $PLIST_PATH"