#!/bin/bash

# Esperar o PostgreSQL iniciar
echo "Aguardando PostgreSQL iniciar..."
sleep 10

# Criar banco de dados se não existir
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d postgres -c "CREATE DATABASE $DB_NAME;" || true

# Executar script de inicialização
node src/database/init.js 