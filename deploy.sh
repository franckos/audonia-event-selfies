#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VUE_DIR="$SCRIPT_DIR/selfsnap-project/selfsnap-web"
VPS="audonia-vps"
VPS_PUBLIC_DIR="/home/audonia/docker/app/public/events"

echo "==> Install dépendances..."
cd "$VUE_DIR"
npm install

echo "==> Build Vue..."
npx vite build --base="/events/frames/" --outDir="$VUE_DIR/dist"

echo "==> Envoi vers le VPS ($VPS:$VPS_PUBLIC_DIR)..."
ssh "$VPS" "mkdir -p /tmp/events-deploy"
rsync -avz --delete "$VUE_DIR/dist/" "$VPS:/tmp/events-deploy/"
ssh "$VPS" "docker exec laravel-app bash -c 'rm -rf /var/www/html/public/events && mkdir -p /var/www/html/public/events && chown www-data:www-data /var/www/html/public/events' && docker cp /tmp/events-deploy/. laravel-app:/var/www/html/public/events/ && docker exec laravel-app chown -R www-data:www-data /var/www/html/public/events && rm -rf /tmp/events-deploy"

echo "==> Deploy terminé ✓"
echo "    URL : https://www.audonia.fr/events/frames?event=<slug>"
