#!/bin/bash

MAX_RETRIES=30
RETRY_INTERVAL=2

echo "Aguardando PostgreSQL iniciar..."

# Função para testar conexão com PostgreSQL
test_postgresql() {
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d postgres -c "SELECT 1;" >/dev/null 2>&1
    return $?
}

# Loop de retry com timeout
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

# Criar banco de dados se não existir
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d postgres -c "CREATE DATABASE $DB_NAME;" || true

# Executar script de inicialização
node src/database/init.js || exit 1

# Manter o container rodando
exec npm start 