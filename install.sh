#!/usr/bin/env bash
# ==============================================================================
# One-Click Installer & Safari Developer Configurator
# Safari Web Annotator & Highlighter
# ==============================================================================
set -euo pipefail

PURPLE='\033[0;35m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m' # No Color

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_SUPPORT="$HOME/Library/Application Support/SafariWebAnnotator"

echo -e "${PURPLE}${BOLD}"
echo "  ╔══════════════════════════════════════════════════════╗"
echo "  ║        Safari Web Annotator - One-Click Setup        ║"
echo "  ║        Highlighter & Drawing Tool for Safari         ║"
echo "  ╚══════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo -e "${BOLD}[1/4] Configuring Safari Developer Settings...${NC}"
defaults write com.apple.Safari IncludeDevelopMenu -bool true
defaults write com.apple.Safari.SandboxBroker ShowDevelopMenu -bool true
defaults write com.apple.Safari WebKitDeveloperExtrasEnabledPreferenceKey -bool true
defaults write com.apple.Safari "com.apple.Safari.ContentPageGroupIdentifier.WebKit2DeveloperExtrasEnabled" -bool true
echo -e "${GREEN}✓ Safari Developer Menu enabled successfully.${NC}"

echo -e "\n${BOLD}[2/4] Deploying Extension to Application Support...${NC}"
mkdir -p "$APP_SUPPORT"
rsync -a --delete \
  --exclude ".git" \
  --exclude ".DS_Store" \
  "$DIR/" "$APP_SUPPORT/"
echo -e "${GREEN}✓ Extension bundle installed at: ${APP_SUPPORT}${NC}"

echo -e "\n${BOLD}[3/4] Registering Helper Commands...${NC}"
chmod +x "$APP_SUPPORT/"*.sh 2>/dev/null || true
echo -e "${GREEN}✓ Scripts configured.${NC}"

echo -e "\n${BOLD}[4/4] Opening Safari Test Harness...${NC}"
open -a Safari "$APP_SUPPORT/test/test-page.html"

osascript << 'APPLESCRIPT' >/dev/null 2>&1 || true
tell application "Safari"
  activate
end tell
APPLESCRIPT

echo -e "\n${GREEN}${BOLD}══════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}   Setup Complete! Just 2 quick manual clicks in Safari:        ${NC}"
echo -e "${GREEN}${BOLD}══════════════════════════════════════════════════════════════════${NC}"
echo -e " 1. In Safari's menu bar, click ${PURPLE}${BOLD}Develop${NC} > check ${PURPLE}${BOLD}Allow Unsigned Extensions${NC}."
echo -e " 2. Go to ${PURPLE}${BOLD}Safari > Settings > Extensions${NC} > check ${PURPLE}${BOLD}Safari Web Annotator${NC}."
echo -e "\n${YELLOW}Hotkeys: ${NC}Alt+Shift+A (Toolbar), Alt+Shift+H (Highlighter), Alt+Shift+D (Pen)\n"
