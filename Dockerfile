# Multi-stage build for Railway
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM python:3.11-slim AS ytm
WORKDIR /app
COPY ytm-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY ytm-service/ .

FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache python3 py3-pip supervisor
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=ytm /app /app/ytm-service
RUN pip install --no-cache-dir -r ytm-service/requirements.txt

COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf
EXPOSE 3001 8001
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]