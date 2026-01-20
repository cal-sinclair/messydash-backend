# Builder stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code
COPY tsconfig.json ./
COPY src ./src

# Build
RUN npm run build

# Runner stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built artifacts from builder
COPY --from=builder /app/dist ./dist

# Create data directory for SQLite volume
RUN mkdir -p /app/data && chown node:node /app/data

# Use non-root user
USER node

# Expose port
EXPOSE 3000

# Start command
CMD ["node", "dist/index.js"]
