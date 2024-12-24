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

# Copiar script de inicialização
COPY scripts/init-db.sh /docker-entrypoint-initdb.d/
RUN chmod +x /docker-entrypoint-initdb.d/init-db.sh

# Copiar código fonte
COPY . .

# Expor porta
EXPOSE 3004

# Criar script de inicialização
RUN echo '#!/bin/bash\n\
echo "Aguardando PostgreSQL..."\n\
sleep 10\n\
/docker-entrypoint-initdb.d/init-db.sh\n\
echo "Iniciando aplicação..."\n\
exec npm start' > /start.sh && chmod +x /start.sh

# Executar
CMD ["/bin/bash", "/start.sh"] 