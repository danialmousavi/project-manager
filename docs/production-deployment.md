# Single-server production deployment

This configuration runs one app instance, PostgreSQL, MinIO and Caddy on one Linux server. Install Docker Engine and the Docker Compose plugin.

1. Copy `.env.production.example` to `.env.production` on the server. Keep this file private and set unique, strong secrets. Set `DATABASE_URL` to match the PostgreSQL credentials and use host `postgres`; URL-encode special characters in the URL password. Do not commit the populated file. Choose one access mode:

   - Internal network over HTTP: set `APP_URL=http://192.168.1.100` to the server's actual IP and `SESSION_COOKIE_SECURE=false`. Permit port 80 only from trusted company networks. HTTP does not encrypt passwords, sessions or files; use HTTPS if network traffic must be protected.
   - Domain with HTTPS: set `APP_URL=https://project.example.com` and `SESSION_COOKIE_SECURE=true`. Point DNS at the server and allow inbound TCP ports 80 and 443; Caddy obtains a certificate automatically. Access must use this exact origin.

   HTTPS on an IP using a private company certificate requires additional certificate and client-trust configuration; it is not provided by these two examples.
2. Start the stack and run database migrations:

   ```sh
   docker compose --env-file .env.production -f docker-compose.production.yml up -d --build
   ```

3. For a new installation only, create the initial administrator:

   ```sh
   docker compose --env-file .env.production -f docker-compose.production.yml --profile bootstrap run --rm seed
   ```

   The seed updates the account matching `ADMIN_EMAIL` and resets its password to `ADMIN_PASSWORD`; do not run it routinely. No demo data is loaded.

4. Check `docker compose --env-file .env.production -f docker-compose.production.yml ps` and inspect service logs if needed. Visit `APP_URL` and test login and file upload/download. When switching modes, update both `APP_URL` and `SESSION_COOKIE_SECURE`, recreate the services using the `up` command above, and access the new URL.

For upgrades, back up the database and MinIO data first, pull the intended revision, then repeat the `up -d --build` command. Migrations execute before the app starts; plan downtime and verify migration compatibility and recovery before upgrading. Back up PostgreSQL with `pg_dump` and back up MinIO objects using a suitable object-storage backup tool, storing both backups off-server and testing restoration. Docker volumes are persistent but are not backups. Never use `docker compose down -v` on a production installation.

The MinIO console and PostgreSQL are internal only. This configuration assumes one app instance; scaling requires shared cache and coordinated deployment configuration. The Caddy request limit accommodates the application's 25 MB individual upload limit. Configure server monitoring, disk capacity alerts, backup scheduling, firewall and operating-system updates before relying on this installation.
