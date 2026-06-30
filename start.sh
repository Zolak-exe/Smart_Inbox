#!/bin/bash
# Script de démarrage pour l'application Bureau Aegis Inbox

# Colors
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${CYAN}===================================================${NC}"
echo -e "${CYAN}             Aegis Inbox - Démarrage               ${NC}"
echo -e "${CYAN}===================================================${NC}"

# Get directory of the script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$DIR"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}Erreur: Node.js n'est pas installé.${NC}"
    exit 1
fi

# Run the Electron Dev script defined in root package.json
echo -e "${GREEN}[Système]${NC} Lancement de l'application de bureau..."
npm run dev
