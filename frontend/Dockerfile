FROM node:20-alpine AS build
WORKDIR /app


COPY package*.json ./

RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY . .

RUN npm run build

FROM nginx:1.25-alpine

COPY --from=build /app/dist /usr/share/nginx/html

RUN rm -f /etc/nginx/conf.d/default.conf \
 && printf '%s\n' \
 'server {' \
 '  listen 80;' \
 '  server_name _;' \
 '  root /usr/share/nginx/html;' \
 '  index index.html;' \
 '' \
 '  # SPA fallback' \
 '  location / {' \
 '    try_files $uri $uri/ /index.html;' \
 '  }' \
 '' \
 '  # GraphQL → gateway:4000 (resolver dinâmico em tempo de requisição)' \
 '  location /graphql {' \
 '    resolver 127.0.0.11 ipv6=off valid=30s;' \
 '    set $gw http://gateway:4000;' \
 '    proxy_pass $gw;' \
 '    proxy_http_version 1.1;' \
 '    proxy_set_header Host $host;' \
 '    proxy_set_header X-Real-IP $remote_addr;' \
 '    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;' \
 '    proxy_set_header X-Forwarded-Proto $scheme;' \
 '  }' \
 '}' \
 > /etc/nginx/conf.d/default.conf


EXPOSE 80
