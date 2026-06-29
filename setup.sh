#!/usr/bin/env bash
set -euo pipefail

echo "═══════════════════════════════════════════"
echo "  Retail Platform - Setup Script"
echo "═══════════════════════════════════════════"
echo ""

# Install dependencies for all services
echo "Installing dependencies..."
for dir in shared product-service order-service customer-service notification-service api-gateway scripts; do
    echo "  → $dir"
    (cd "$dir" && npm install --silent 2>/dev/null)
done

# Create shared symlinks for local development
echo ""
echo "Creating shared module symlinks..."
node -e "
const fs = require('fs');
const path = require('path');
const services = ['product-service', 'order-service', 'customer-service', 'notification-service', 'api-gateway'];
const root = process.cwd();
services.forEach(s => {
    const target = path.join(root, s, 'shared');
    if (!fs.existsSync(target)) {
        try {
            fs.symlinkSync(path.join(root, 'shared'), target, 'junction');
            console.log('  ✓ ' + s + '/shared');
        } catch(e) {
            console.log('  ✗ ' + s + ' - ' + e.message);
        }
    } else {
        console.log('  - ' + s + '/shared (exists)');
    }
});
"

echo ""
echo "═══════════════════════════════════════════"
echo "  Setup complete!"
echo ""
echo "  Quick Start:"
echo "    docker-compose up --build"
echo ""
echo "  Seed Demo Data:"
echo "    node scripts/seed-demo.js"
echo ""
echo "  Run Demo:"
echo "    node scripts/linkedin-demo.js"
echo "═══════════════════════════════════════════"
