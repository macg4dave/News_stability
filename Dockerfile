FROM nginx:stable-alpine@sha256:583b7f2fce1cdb8da5ad5c39ebd3c33b98b87d493190e548bdee1fa8c619c311
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY web/ /usr/share/nginx/html/
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1
