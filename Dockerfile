FROM node:18-alpine

WORKDIR /app

# Instalar dependências do sistema
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    postgresql-client \
    bash

# Configurar variáveis de ambiente do Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    NODE_ENV=production

# Copiar arquivos de configuração primeiro
COPY package*.json ./
COPY config ./config/

# Instalar todas as dependências (incluindo devDependencies temporariamente)
RUN npm install

# Copiar script de inicialização
COPY scripts/init-db.sh /docker-entrypoint-initdb.d/
RUN chmod +x /docker-entrypoint-initdb.d/init-db.sh

# Copiar código fonte
COPY . .

# Expor porta
EXPOSE 3004

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3004/health || exit 1

# Executar script de inicialização e depois a aplicação
CMD ["/bin/bash", "-c", "/docker-entrypoint-initdb.d/init-db.sh && npm start"] 