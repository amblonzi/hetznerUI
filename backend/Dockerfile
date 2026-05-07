FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache python3 make g++ 
COPY package*.json ./
RUN npm uninstall sqlite3 && npm install
COPY . .
EXPOSE 3000
CMD ["npx", "tsx", "index.ts"]
