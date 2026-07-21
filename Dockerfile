FROM node:20-alpine AS builder
WORKDIR /app

# Instalar dependências
COPY package*.json ./
RUN npm ci

# Copiar código e buildar
COPY . .
ENV DB_HOST="localhost"
ENV DB_PORT="5432"
ENV DB_NAME="dummy"
ENV DB_USER="dummy"
ENV DB_PASSWORD="dummy"
RUN npm run build

# ---- Runner ----
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copiar apenas o necessário para produção
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Diretório de armazenamento dos PDFs de "Resultados e Produtos".
# Em produção/local é montado como volume Docker (resultados_data:/app/storage).
RUN mkdir -p /app/storage/resultados /app/logs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
