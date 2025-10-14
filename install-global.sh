#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}Installing Invoice Generator globally...${NC}"

# Build the project
echo "Building TypeScript files..."
npm run build

# Create a global link
echo "Creating global 'invoice' command..."
npm link

echo -e "${GREEN}✅ Installation complete!${NC}"
echo ""
echo "You can now use the 'invoice' command from anywhere:"
echo ""
echo "  invoice xferall                    # Generate and send invoice"
echo "  invoice xferall --test             # Test mode (only to your email)"
echo "  invoice xferall --dry-run          # Generate without sending"
echo "  invoice xferall --weeks 4          # Custom period (default: 2)"
echo ""
echo -e "${YELLOW}Don't forget to set up your Gmail app password in .env!${NC}"