# ============================
# 🔹 1. Build Stage
# ============================
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /usr/src/app

# Copy package files first (for better build caching)
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy the full source code
COPY . .

# Build TypeScript into JavaScript
RUN npm run build

# ============================
# 🔹 2. Production Stage
# ============================
FROM node:20-alpine AS runner

# Set working directory
WORKDIR /usr/src/app

# Copy only necessary files from builder stage
COPY --from=builder /usr/src/app/package*.json ./
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/public ./public

# Install only production dependencies
RUN npm ci --omit=dev

# Set environment to production
ENV PATH="/etc/secrets:${PATH}"
ENV NODE_ENV=production
ENV PORT=4000

# Expose app port
EXPOSE 4000

# Healthcheck for AWS (optional)
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/health || exit 1

# Start the app
CMD ["node", "dist/server.js"]
