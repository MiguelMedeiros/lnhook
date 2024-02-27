FROM node:20.11.1-alpine

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci

COPY src/ src/

RUN npx tsup src/index.ts --minify

CMD [ "node", "dist/index.js" ]
