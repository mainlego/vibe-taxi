#!/bin/bash

# Vibe Taxi Deployment Script
# Usage: ./scripts/deploy.sh

set -e

echo "🚀 Starting Vibe Taxi deployment..."

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env.production exists
if [ ! -f .env.production ]; then
    echo -e "${RED}Error: .env.production file not found!${NC}"
    echo "Please create .env.production from .env.production.example"
    exit 1
fi

# Load environment variables
export $(grep -v '^#' .env.production | xargs)

echo -e "${YELLOW}Step 1: Pulling latest changes...${NC}"
git pull origin main

echo -e "${YELLOW}Step 2: Building Docker images...${NC}"
docker-compose -f docker-compose.prod.yml build --no-cache

echo -e "${YELLOW}Step 3: Stopping old containers...${NC}"
docker-compose -f docker-compose.prod.yml down

echo -e "${YELLOW}Step 4: Starting new containers...${NC}"
docker-compose -f docker-compose.prod.yml up -d

echo -e "${YELLOW}Step 5: Running database migrations...${NC}"
docker-compose -f docker-compose.prod.yml exec -T api npx prisma migrate deploy

echo -e "${YELLOW}Step 6: Seeding database (if needed)...${NC}"
docker-compose -f docker-compose.prod.yml exec -T api npx prisma db seed || true

echo -e "${YELLOW}Step 7: Checking container status...${NC}"
docker-compose -f docker-compose.prod.yml ps

echo -e "${GREEN}✅ Deployment completed!${NC}"
echo ""
echo "Services:"
echo "  - Client: http://YOUR_IP:80"
echo "  - Driver: http://YOUR_IP:8080"
echo "  - API:    http://YOUR_IP:3001"
echo ""
echo "Check logs with: docker-compose -f docker-compose.prod.yml logs -f"
