# ============================================================
# KJ Gold Appraiser — Backend Production Dockerfile
# ============================================================
# Base: official Playwright image for v1.62.1 on Ubuntu 24.04 (Noble).
#
# This image ships Chromium and all required OS-level system libraries
# pre-installed, which solves the Render native-Node deployment failure:
#
#   su: Authentication failure
#   Failed to install browsers
#
# That error occurs because `npx playwright install --with-deps` needs
# root/sudo to install OS packages — Render's native Node sandbox does
# not allow it. Using this Docker image bypasses the problem entirely.
# ============================================================

FROM mcr.microsoft.com/playwright:v1.62.1-noble

WORKDIR /app

# ---- Dependency layer -----------------------------------------
# Copy manifests first so Docker can cache this layer separately.
# When only source files change, npm ci is not re-run.
COPY package*.json ./

# PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 tells the playwright postinstall
# script not to re-download Chromium — it is already installed in this
# image at $PLAYWRIGHT_BROWSERS_PATH (set by the base image).
#
# --omit=dev excludes nodemon and pm2; production only needs the
# runtime dependencies listed under "dependencies" in package.json.
RUN PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm ci --omit=dev

# ---- Application source ---------------------------------------
COPY src/ ./src/

# ---- Runtime --------------------------------------------------
# PORT is injected by Render at runtime; Express reads process.env.PORT.
# app.listen(PORT) without an explicit host binds to 0.0.0.0 on Linux,
# so the service is reachable on all container interfaces. No port is
# hardcoded here.
EXPOSE 10000

# Use the project's defined start script: node src/server.js.
CMD ["npm", "start"]
