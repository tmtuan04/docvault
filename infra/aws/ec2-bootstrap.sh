#!/usr/bin/env bash
# Bootstrap Ubuntu EC2 for DocVault production Docker stack.
# Usage: sudo bash infra/aws/ec2-bootstrap.sh

set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root: sudo bash $0"
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

apt-get update -y
apt-get install -y ca-certificates curl git gnupg

# Docker Engine + Compose plugin
if ! command -v docker >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
fi

usermod -aG docker ubuntu 2>/dev/null || true

mkdir -p /opt/docvault

cat <<'EOF'

DocVault EC2 bootstrap complete.

Next steps:
  1. Clone repo:  git clone <repo-url> /opt/docvault
  2. Copy env:    cp infra/aws/.env.production.example /opt/docvault/.env
                  nano /opt/docvault/.env
  3. RDS init:    psql "$DATABASE_ADMIN_URL" -f infra/aws/rds-init.sql
  4. Migrate:     cd /opt/docvault && pnpm install && pnpm db:migrate
  5. Build/run:
       export NEXT_PUBLIC_API_URL=https://api.vaultdocs.cloud
       export DOCVAULT_ENV_FILE=/opt/docvault/.env
       docker compose -f infra/aws/docker-compose.prod.yml build
       docker compose -f infra/aws/docker-compose.prod.yml up -d

See docs/DEPLOY_AWS_EC2.md for full AWS setup (RDS, ElastiCache, S3, ALB).

EOF
