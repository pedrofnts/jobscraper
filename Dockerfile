FROM node:18-alpine

WORKDIR /app

# Instalar dependências do Puppeteer
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    postgresql-client

# Configurar variáveis de ambiente do Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Copiar arquivos de configuração primeiro
COPY package*.json ./
COPY config ./config/

# Instalar dependências
RUN npm ci --only=production

# Copiar código fonte
COPY . .

EXPOSE 3004

CMD ["npm", "start"] 