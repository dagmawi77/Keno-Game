#!/bin/bash

# Keno Game Setup Script
# This script sets up the development environment for the Keno Game

set -e

echo "🎲 Setting up Keno Game Development Environment"
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

print_status "Node.js $(node -v) detected"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed. Please install npm first."
    exit 1
fi

print_status "npm $(npm -v) detected"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install
print_status "Dependencies installed"

# Create environment file if it doesn't exist
if [ ! -f .env ]; then
    echo ""
    echo "🔧 Creating environment configuration..."
    cp env.example .env
    print_status "Environment file created (.env)"
    print_warning "Please edit .env with your configuration before running the application"
else
    print_status "Environment file already exists"
fi

# Create logs directory
echo ""
echo "📁 Creating logs directory..."
mkdir -p logs
print_status "Logs directory created"

# Check if PostgreSQL is running
echo ""
echo "🗄️  Checking database connection..."
if command -v psql &> /dev/null; then
    # Try to connect to PostgreSQL
    if psql -h localhost -U postgres -c "SELECT 1;" &> /dev/null; then
        print_status "PostgreSQL connection successful"
    else
        print_warning "PostgreSQL is not running or not accessible"
        print_warning "Please start PostgreSQL and ensure it's accessible"
    fi
else
    print_warning "PostgreSQL client not found. Please install PostgreSQL"
fi

# Check if Redis is running
echo ""
echo "🔴 Checking Redis connection..."
if command -v redis-cli &> /dev/null; then
    if redis-cli ping &> /dev/null; then
        print_status "Redis connection successful"
    else
        print_warning "Redis is not running or not accessible"
        print_warning "Please start Redis server"
    fi
else
    print_warning "Redis client not found. Please install Redis"
fi

# Run database migrations
echo ""
echo "🗃️  Running database migrations..."
if npm run migrate &> /dev/null; then
    print_status "Database migrations completed"
else
    print_warning "Database migrations failed. Please check your database connection"
fi

# Run tests
echo ""
echo "🧪 Running tests..."
if npm test &> /dev/null; then
    print_status "All tests passed"
else
    print_warning "Some tests failed. Check the output above for details"
fi

# Run RNG statistical tests
echo ""
echo "🎲 Running RNG statistical tests..."
if npm run test:rng &> /dev/null; then
    print_status "RNG statistical tests passed"
else
    print_warning "RNG statistical tests failed. Check the output above for details"
fi

echo ""
echo "🎉 Setup completed!"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your configuration"
echo "2. Ensure PostgreSQL and Redis are running"
echo "3. Run 'npm run dev' to start the development server"
echo "4. Open http://localhost:3000 in your browser"
echo ""
echo "For production deployment:"
echo "1. Run 'docker-compose up -d' to start all services"
echo "2. Access the application at http://localhost"
echo ""
echo "Happy gaming! 🎲"
