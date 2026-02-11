#!/bin/bash

# BugTraceAI-WEB Installation Wizard
# ====================================

set -e

# Colors for better UX
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# ASCII Art Banner
echo -e "${BLUE}"
cat << "EOF"
╔══════════════════════════════════════════════╗
║                                              ║
║    ____  _____  _    ___  __        ______   ║
║   | __ )|_   _|/ \  |_ _| \ \      / / __ )  ║
║   |  _ \  | | / _ \  | |   \ \ /\ / /|  _ \  ║
║   | |_) | | |/ ___ \ | |    \ V  V / | |_) | ║
║   |____/  |_/_/   \_\___|    \_/\_/  |____/  ║
║                                              ║
║        BugTraceAI - Install Wizard           ║
║                                              ║
╚══════════════════════════════════════════════╝
EOF
echo -e "${NC}"

# Function to check if a port is available
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        return 1  # Port is in use
    else
        return 0  # Port is available
    fi
}

# Function to find available ports
find_available_ports() {
    local start_port=$1
    local count=$2
    local available_ports=()
    
    local current_port=$start_port
    while [ ${#available_ports[@]} -lt $count ] && [ $current_port -lt 65535 ]; do
        if check_port $current_port; then
            available_ports+=($current_port)
        fi
        ((current_port++))
    done
    
    echo "${available_ports[@]}"
}

# Function to display section header
section_header() {
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

# Welcome message
section_header "Welcome to BugTraceAI-WEB Installer"
echo "This wizard will help you set up and run BugTraceAI-WEB using Docker."
echo ""

# Check if Docker is installed
section_header "Step 1: Checking Docker Installation"
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed!${NC}"
    echo -e "${YELLOW}Please install Docker first: https://docs.docker.com/get-docker/${NC}"
    exit 1
else
    echo -e "${GREEN}✓ Docker is installed${NC}"
    docker --version
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${RED}❌ Docker Compose is not installed!${NC}"
    echo -e "${YELLOW}Please install Docker Compose first${NC}"
    exit 1
else
    echo -e "${GREEN}✓ Docker Compose is installed${NC}"
    if command -v docker-compose &> /dev/null; then
        docker-compose --version
    else
        docker compose version
    fi
fi

# Check if Docker daemon is running
if ! docker info &> /dev/null; then
    echo -e "${RED}❌ Docker daemon is not running!${NC}"
    echo -e "${YELLOW}Please start Docker first${NC}"
    exit 1
else
    echo -e "${GREEN}✓ Docker daemon is running${NC}"
fi

# Port selection
section_header "Step 2: Port Configuration"
echo "Default port: 6869"
echo ""

# Find available ports starting from 6869
echo "Scanning for available ports..."
available_ports=($(find_available_ports 6869 5))

if [ ${#available_ports[@]} -eq 0 ]; then
    echo -e "${RED}❌ No available ports found in the range!${NC}"
    exit 1
fi

# Check if default port is available
if check_port 6869; then
    echo -e "${GREEN}✓ Default port 6869 is available${NC}"
    default_port=6869
else
    echo -e "${YELLOW}⚠ Warning: Default port 6869 is already in use${NC}"
    default_port=${available_ports[0]}
fi

echo ""
echo "Available ports detected: ${available_ports[@]}"
echo ""
echo -e "${YELLOW}Which port would you like to use for the frontend?${NC}"
read -p "Enter port number (press Enter for $default_port): " selected_port

# Use default if no input
if [ -z "$selected_port" ]; then
    selected_port=$default_port
fi

# Validate port number
if ! [[ "$selected_port" =~ ^[0-9]+$ ]] || [ "$selected_port" -lt 1024 ] || [ "$selected_port" -gt 65535 ]; then
    echo -e "${RED}❌ Invalid port number. Must be between 1024 and 65535${NC}"
    exit 1
fi

# Check if selected port is available
if ! check_port $selected_port; then
    echo -e "${RED}❌ Port $selected_port is already in use!${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Port $selected_port will be used${NC}"

# Database configuration
section_header "Step 3: Database Configuration"
echo "Configure PostgreSQL database settings"
echo ""

read -p "Database name (default: bugtraceai_web): " db_name
db_name=${db_name:-bugtraceai_web}

read -p "Database user (default: bugtraceai): " db_user
db_user=${db_user:-bugtraceai}

read -sp "Database password (default: bugtraceai_dev_2026): " db_password
echo ""
db_password=${db_password:-bugtraceai_dev_2026}

# CLI Backend URL configuration
section_header "Step 4: CLI Backend Configuration"
echo "Configure the BugTraceAI CLI backend URL"
echo ""

read -p "CLI API URL (default: http://localhost:8000): " cli_api_url
cli_api_url=${cli_api_url:-http://localhost:8000}

# Create or update .env file
section_header "Step 5: Creating Configuration File"
cat > .env << EOF
# Frontend Configuration
FRONTEND_PORT=$selected_port

# Database Configuration
POSTGRES_DB=$db_name
POSTGRES_USER=$db_user
POSTGRES_PASSWORD=$db_password

# CLI Backend Configuration
VITE_CLI_API_URL=$cli_api_url
EOF

echo -e "${GREEN}✓ Configuration file (.env) created${NC}"
cat .env

# Confirmation
section_header "Step 6: Final Confirmation"
echo "The following configuration will be used:"
echo ""
echo -e "  ${BLUE}Frontend URL:${NC}     http://localhost:$selected_port"
echo -e "  ${BLUE}Database:${NC}         $db_name"
echo -e "  ${BLUE}Database User:${NC}    $db_user"
echo -e "  ${BLUE}CLI Backend:${NC}      $cli_api_url"
echo ""
read -p "Do you want to proceed with the installation? (yes/no): " confirm

if [[ ! "$confirm" =~ ^[Yy][Ee][Ss]$|^[Yy]$ ]]; then
    echo -e "${YELLOW}Installation cancelled by user${NC}"
    exit 0
fi

# Stop existing containers
section_header "Step 7: Stopping Existing Containers"
echo "Checking for existing containers..."
if docker-compose -f docker-compose.yml down -v 2>/dev/null; then
    echo -e "${GREEN}✓ Existing containers stopped${NC}"
else
    echo -e "${YELLOW}⚠ No existing containers found (this is ok for first run)${NC}"
fi

# Build and start containers
section_header "Step 8: Building and Starting Docker Containers"
echo "This may take a few minutes on first run..."
echo ""

if command -v docker-compose &> /dev/null; then
    docker-compose -f docker-compose.yml up --build -d
else
    docker compose -f docker-compose.yml up --build -d
fi

if [ $? -eq 0 ]; then
    # Success
    section_header "✓ Installation Complete!"
    echo -e "${GREEN}BugTraceAI-WEB is now running!${NC}"
    echo ""
    echo -e "${BLUE}Access the application at:${NC} ${GREEN}http://localhost:$selected_port${NC}"
    echo ""
    echo -e "${YELLOW}Useful commands:${NC}"
    echo "  • View logs:       docker-compose logs -f"
    echo "  • Stop services:   docker-compose down"
    echo "  • Restart:         docker-compose restart"
    echo "  • View status:     docker-compose ps"
    echo ""
    
    # Wait for services to be ready
    echo "Waiting for services to be ready..."
    sleep 5
    
    # Try to open browser
    if [ -n "$DISPLAY" ] && command -v xdg-open &> /dev/null; then
        echo -e "${BLUE}🚀 Opening browser...${NC}"
        xdg-open "http://localhost:$selected_port" 2>/dev/null &
    elif [ -n "$DISPLAY" ] && command -v firefox &> /dev/null; then
        echo -e "${BLUE}🚀 Opening Firefox...${NC}"
        firefox "http://localhost:$selected_port" 2>/dev/null &
    elif [ -n "$DISPLAY" ] && command -v google-chrome &> /dev/null; then
        echo -e "${BLUE}🚀 Opening Chrome...${NC}"
        google-chrome "http://localhost:$selected_port" 2>/dev/null &
    else
        echo -e "${YELLOW}💡 Open http://localhost:$selected_port in your browser${NC}"
    fi
    
else
    echo -e "${RED}❌ Installation failed!${NC}"
    echo ""
    echo "Please check the error messages above and try again."
    echo "Common issues:"
    echo "  • Docker daemon not running"
    echo "  • Port already in use"
    echo "  • Insufficient permissions (try with sudo)"
    exit 1
fi
