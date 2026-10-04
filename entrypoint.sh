#!/bin/sh
set -e

# Railway inyecta PORT, usamos 3001 por defecto local
export PORT=${PORT:-3001}
export HOST=${HOST:-0.0.0.0}

# Iniciar Python YTM service en background (puerto 8001 interno)
cd /app/ytm-service
python app.py &
YTM_PID=$!

# Esperar a que Python esté listo
sleep 3

# Iniciar Fastify (usa $PORT de Railway)
cd /app
exec npx tsx server/src/index.ts