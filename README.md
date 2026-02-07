# Thend Web App

This repository contains a Next.js application with API routes, middleware security headers, and performance optimizations.

## Getting Started

```bash
npm install
npm run dev
```

## Production Build

```bash
npm run build
npm run start
```

## Deploying on Hostinger

You **can** host this app on Hostinger as long as your plan supports Node.js (typically Business/Cloud hosting or a VPS).

1. **Create a Node.js app in hPanel** (or connect via SSH on VPS).
2. **Set Node.js version** to match your `.nvmrc` (or use Node 18+ if not specified).
3. **Upload or git-clone** the repository to your hosting directory.
4. **Install dependencies**:
   ```bash
   npm install
   ```
5. **Set environment variables** in Hostinger’s “Environment Variables” section (or `.env` on VPS). At minimum:
   - `MYSQL_HOST`
   - `MYSQL_PORT` (optional, default 3306)
   - `MYSQL_USER`
   - `MYSQL_PASSWORD`
   - `MYSQL_DATABASE`
   - `ADMIN_EMAIL`
   - `ADMIN_PASSWORD_HASH` + `ADMIN_PASSWORD_SALT` (recommended) or `ADMIN_PASSWORD`
   - `ADMIN_SESSION_SECRET`
   - Any other secrets in `.env.local` for APIs/analytics.
6. **Build the app**:
   ```bash
   npm run build
   ```
7. **Configure the startup command** in hPanel:
   ```bash
   npm run start
   ```
   If you can set custom variables, ensure:
   - `HOSTNAME=0.0.0.0`
   - `PORT` matches the port Hostinger provides.
8. **Point your domain** to the Node.js app in hPanel and enable SSL.

### Notes
- If you use a CDN or reverse proxy, forward `x-forwarded-for` and `x-forwarded-proto` headers.
- For VPS deployments, you can run the app with PM2 or systemd and use Nginx as a reverse proxy.
- Run the MySQL schema in `HOSTINGER_MYSQL_SETUP.sql` on your Hostinger database before first launch.
- To generate a password hash locally:
  ```bash
  node -e "const {scryptSync, randomBytes} = require('crypto'); const salt=randomBytes(16).toString('hex'); const hash=scryptSync(process.argv[1], salt, 64).toString('hex'); console.log('ADMIN_PASSWORD_SALT='+salt); console.log('ADMIN_PASSWORD_HASH='+hash);" "your-password"
  ```
