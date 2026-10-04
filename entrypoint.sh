#!/bin/sh
set -e

# Railway inyecta PORT para el servicio principal (Fastify)
export FASTIFY_PORT=${PORT:-3001}
export HOST=${HOST:-0.0.0.0}

# Iniciar Python YTM service en background (puerto 8001 interno)
cd /app/ytm-service
export PORT=8001
python app.py &
YTM_PID=$!

# Esperar a que Python esté listo
sleep 3

# Iniciar Fastify (usa $FASTIFY_PORT de Railway)
cd /app
export PORT=$FASTIFY_PORT
exec npx tsx server/src/index.ts