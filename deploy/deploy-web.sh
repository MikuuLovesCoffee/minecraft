#!/bin/bash
# Installs / updates the CraftMine website on the server. Safe to re-run.
# Expects the release bundle in the directory given as $1 (api.tgz, web.tgz, deploy files).
# Creates only: user craftweb, /opt/craftmine, /etc/craftmine, Postgres role+db "craftmine",
# craftmine-api/web services, nginx site "mc". Never edits other sites or global configs.
set -euo pipefail
REL=${1:?release dir}
log(){ echo "[$(date +%T)] $*"; }

log "user"
id craftweb >/dev/null 2>&1 || useradd -r -M -d /opt/craftmine -s /usr/sbin/nologin craftweb
usermod -aG minecraft craftweb
mkdir -p /opt/craftmine /etc/craftmine

log "database"
if [ ! -f /etc/craftmine/api.env ]; then
  DBPASS=$(openssl rand -hex 24)
  sudo -u postgres psql -v ON_ERROR_STOP=1 -q <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'craftmine') THEN
    CREATE ROLE craftmine LOGIN PASSWORD '$DBPASS';
  ELSE
    ALTER ROLE craftmine PASSWORD '$DBPASS';
  END IF;
END \$\$;
SQL
  sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='craftmine'" | grep -q 1 \
    || sudo -u postgres createdb -O craftmine craftmine
  sudo -u postgres psql -q -c "REVOKE ALL ON DATABASE craftmine FROM PUBLIC"
  umask 027
  cat > /etc/craftmine/api.env <<ENV
PORT=3031
DATABASE_URL=postgres://craftmine:$DBPASS@127.0.0.1:5432/craftmine
JWT_SECRET=$(openssl rand -hex 32)
MC_DIR=/opt/minecraft/server
MC_HOST=127.0.0.1
MC_PORT=25565
ADMIN_PLAYERS=MikuuLovesCoffee
COOKIE_SECURE=true
SKINS_DIR=/opt/craftmine/web/public/skins
ENV
  umask 022
fi
chown root:craftweb /etc/craftmine/api.env; chmod 640 /etc/craftmine/api.env

log "api"
rm -rf /opt/craftmine/api.new && mkdir -p /opt/craftmine/api.new
tar -xzf "$REL/api.tgz" -C /opt/craftmine/api.new
(cd /opt/craftmine/api.new && npm ci --omit=dev --no-audit --no-fund --loglevel=error)
rm -rf /opt/craftmine/api.old; [ -d /opt/craftmine/api ] && mv /opt/craftmine/api /opt/craftmine/api.old
mv /opt/craftmine/api.new /opt/craftmine/api

log "web"
rm -rf /opt/craftmine/web.new && mkdir -p /opt/craftmine/web.new
tar -xzf "$REL/web.tgz" -C /opt/craftmine/web.new
mkdir -p /opt/craftmine/web.new/.next/cache
rm -rf /opt/craftmine/web.old; [ -d /opt/craftmine/web ] && mv /opt/craftmine/web /opt/craftmine/web.old
mv /opt/craftmine/web.new /opt/craftmine/web
chown -R root:root /opt/craftmine/api /opt/craftmine/web
chown -R craftweb:craftweb /opt/craftmine/web/.next/cache

log "services"
install -m 644 "$REL/craftmine-api.service" "$REL/craftmine-web.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable -q craftmine-api craftmine-web
systemctl restart craftmine-api; sleep 3; systemctl restart craftmine-web
for i in $(seq 1 20); do curl -fs -o /dev/null http://127.0.0.1:3031/api/status && curl -fs -o /dev/null http://127.0.0.1:3030/ && break; sleep 2; done
echo "api: $(systemctl is-active craftmine-api)  web: $(systemctl is-active craftmine-web)"

log "nginx"
install -m 644 "$REL/craftmine-proxy.conf" /etc/nginx/craftmine-proxy.conf
if [ ! -f /etc/nginx/sites-available/mc ]; then
  install -m 644 "$REL/nginx-mc.conf" /etc/nginx/sites-available/mc
  ln -sf /etc/nginx/sites-available/mc /etc/nginx/sites-enabled/mc
  nginx -t && systemctl reload nginx
  certbot --nginx -d mc.mikuuloves.coffee --non-interactive --redirect --keep-until-expiring | tail -3
fi
nginx -t 2>&1 | tail -1 && systemctl reload nginx
curl -s -o /dev/null -w "https: %{http_code}\n" https://mc.mikuuloves.coffee/
log "done"
