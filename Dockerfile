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
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Copiar arquivos de configuração primeiro
COPY package*.json ./
COPY config ./config/

# Copiar script de inicialização
COPY scripts/init-db.sh /docker-entrypoint-initdb.d/
RUN chmod +x /docker-entrypoint-initdb.d/init-db.sh

# Instalar dependências
RUN npm ci --only=production

# Copiar código fonte
COPY . .

EXPOSE 3004

# Executar script de inicialização e depois a aplicação
CMD ["/bin/bash", "-c", "/docker-entrypoint-initdb.d/init-db.sh && npm start"] 