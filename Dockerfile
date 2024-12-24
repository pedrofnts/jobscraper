FROM node:18-alpine

WORKDIR /app

# Instalar dependências do sistema incluindo Chrome
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    postgresql-client \
    bash \
    udev \
    ttf-liberation \
    fontconfig \
    dbus \
    xvfb

# Configurar variáveis de ambiente do Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    NODE_ENV=production \
    DISPLAY=:99

# Copiar arquivos de configuração primeiro
COPY package*.json ./
COPY config ./config/

# Instalar dependências
RUN npm install

# Copiar script de inicialização
COPY scripts/init-db.sh /docker-entrypoint-initdb.d/
RUN chmod +x /docker-entrypoint-initdb.d/init-db.sh

# Copiar código fonte
COPY . .

# Expor porta
EXPOSE 3004

# Criar script de inicialização com Xvfb
RUN echo '#!/bin/sh\nXvfb :99 -screen 0 1024x768x16 & /docker-entrypoint-initdb.d/init-db.sh && npm start' > /start.sh && \
    chmod +x /start.sh

# Executar com Xvfb
CMD ["/start.sh"] 