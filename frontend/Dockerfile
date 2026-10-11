FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

FROM nginx:1.29-alpine

RUN mkdir -p \
      /tmp/nginx/client_temp \
      /tmp/nginx/proxy_temp \
      /tmp/nginx/fastcgi_temp \
      /tmp/nginx/uwsgi_temp \
      /tmp/nginx/scgi_temp \
    && chown -R 101:101 /tmp/nginx

COPY nginx.conf /etc/nginx/nginx.conf
COPY --from=build --chown=101:101 /app/dist /usr/share/nginx/html

USER 101:101

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1

ENTRYPOINT ["nginx"]
CMD ["-g", "daemon off;"]
