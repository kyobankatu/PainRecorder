FROM node:20-alpine

WORKDIR /app

# openssl is required by Prisma
RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm install

COPY . .
RUN npx prisma generate

EXPOSE 3000

CMD ["sh", "scripts/start.sh"]
