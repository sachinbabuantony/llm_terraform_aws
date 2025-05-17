FROM nginx:alpine

# Copy static files to be served
COPY frontend/static /usr/share/nginx/html

# Replace the default nginx site config (your custom server block)
COPY frontend/default.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

