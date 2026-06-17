#!/bin/bash

echo "🚀 Iniciando despliegue de Ambriz AI a Producción..."

# 1. Hacer el Build de React
echo "📦 Construyendo la interfaz de usuario (React)..."
cd client
npm run build
cd ..

# 2. Sincronizar con GitHub
echo "🐙 Sincronizando código con GitHub..."
git add .
git commit -m "Despliegue a Producción $(date +'%Y-%m-%d %H:%M')"
git push -u origin main

# 3. Conectar a Hostinger vía SSH y descargar código
echo "🌐 Conectando a Hostinger para actualizar el servidor..."
ssh -i ~/.ssh/id_rsa_panel u211138134@195.35.10.40 -p 65002 << 'ENDSSH'
  export PATH=/opt/alt/alt-nodejs20/root/usr/bin:$PATH
  cd domains/ai.ambrizydavalos.com/nodejs
  
  # Resguardar base de datos antes de jalar cambios
  if [ -f server/data/users.json ]; then
    echo "💾 Resguardando base de datos de usuarios antes del despliegue..."
    mkdir -p server/backups 2>/dev/null || true
    cp server/data/users.json server/backups/users_backup_$(date +%Y-%m-%d_%H%M%S).json
  fi

  if [ -f server/data/folders.json ]; then
    mkdir -p server/backups 2>/dev/null || true
    cp server/data/folders.json server/backups/folders_backup_$(date +%Y-%m-%d_%H%M%S).json
  fi

  if [ -f server/data/chats.json ]; then
    mkdir -p server/backups 2>/dev/null || true
    cp server/data/chats.json server/backups/chats_backup_$(date +%Y-%m-%d_%H%M%S).json
  fi
  
  echo "📥 Descargando la última versión desde GitHub..."
  git fetch --all
  git reset --hard origin/main
  
  echo "📦 Instalando dependencias del servidor..."
  cd server
  npm install --omit=dev
  
  echo "🔄 Reiniciando el servidor Node.js..."
  mkdir -p tmp 2>/dev/null || true
  touch tmp/restart.txt 2>/dev/null || true
  mkdir -p ../server/tmp 2>/dev/null || true
  touch ../server/tmp/restart.txt 2>/dev/null || true
  mkdir -p ../../public_html/tmp 2>/dev/null || true
  touch ../../public_html/tmp/restart.txt 2>/dev/null || true
ENDSSH

echo "✅ ¡Despliegue Finalizado Exitosamente!"
echo "Puedes revisar tu aplicación en: https://ai.ambrizydavalos.com"
