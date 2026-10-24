#!/bin/sh
set -eu
psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set=app_password="$APP_DB_PASSWORD" <<'SQL'
CREATE ROLE healthguard_app LOGIN PASSWORD :'app_password';
GRANT CONNECT ON DATABASE healthguard TO healthguard_app;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
SQL
