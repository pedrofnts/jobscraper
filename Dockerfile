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
    curl

# Configurar variáveis de ambiente do Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    NODE_ENV=production

# Copiar arquivos de configuração primeiro
COPY package*.json ./
COPY config ./config/

# Instalar dependências
RUN npm install

# Copiar código fonte
COPY . .

# Tornar script executável
RUN chmod +x scripts/init-db.sh

# Expor porta
EXPOSE 3004

# Executar diretamente o script de inicialização
CMD ["./scripts/init-db.sh"] 