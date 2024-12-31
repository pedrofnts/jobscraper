#!/bin/bash

MAX_RETRIES=30
RETRY_INTERVAL=2

echo "Aguardando PostgreSQL iniciar..."

test_postgresql() {
   PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d postgres -c "SELECT 1;" >/dev/null 2>&1
   return $?
}

retry_count=0
while ! test_postgresql && [ $retry_count -lt $MAX_RETRIES ]; do
   echo "Tentativa $((retry_count + 1)) de $MAX_RETRIES. Aguardando $RETRY_INTERVAL segundos..."
   sleep $RETRY_INTERVAL
   retry_count=$((retry_count + 1))
done

if [ $retry_count -eq $MAX_RETRIES ]; then
   echo "Erro: Timeout aguardando PostgreSQL"
   exit 1
fi

echo "PostgreSQL está pronto!"

PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d postgres -c "CREATE DATABASE $DB_NAME;" || true

node src/database/init.js

if [ $? -eq 0 ]; then
   echo "Banco de dados inicializado com sucesso"
   exec npm start
else
   echo "Falha ao inicializar o banco de dados"
   exit 1
fi