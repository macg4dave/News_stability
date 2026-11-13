# Deployment and recovery

## HTTPS entry point

Run one reader instance behind an HTTPS reverse proxy. Keep Compose's Nginx
port on loopback and the Go port unpublished. Set `.env` to the exact browser
origin (without a trailing slash), for example:

```dotenv
PUBLIC_ORIGIN=https://reader.example.test
NEWSBLUR_ORIGIN=https://news101.lan
WEB_PORT=8080
```

The hostname is an example: use a name you control and a certificate trusted by
your clients. A host Nginx proxy can forward the HTTPS virtual host to the local
Compose entry point:

```nginx
server {
    listen 443 ssl;
    server_name reader.example.test;
    ssl_certificate /etc/ssl/reader/fullchain.pem;
    ssl_certificate_key /etc/ssl/reader/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    client_max_body_size 16k;
    access_log off;
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_connect_timeout 5s;
        proxy_read_timeout 40s;
    }
}
server {
    listen 80;
    server_name reader.example.test;
    return 308 https://reader.example.test$request_uri;
}
```

Preserve the browser's Origin header; do not replace it with a trusted value.
Cookie policy comes from `PUBLIC_ORIGIN`, not forwarded headers. HTTPS origins
receive a Secure, HttpOnly, host-only `__Host-reader_session` cookie with
SameSite=Strict. Configure HSTS at the HTTPS proxy after HTTPS/renewal works;
choose its duration and subdomain policy for your own domain.

The reader verifies NewsBlur TLS independently of browser-facing TLS. For a
private CA or self-signed server certificate, use the read-only PEM override in
[development](development.md#configuration), verify its fingerprint through your
server operator, and keep the PEM and override outside Git. Never copy private
keys into the reader image or disable hostname/certificate verification.

The supplied Nginx entry point limits `/api/login` and `/api/session` together
to 10 requests/minute per observed source address, with a burst of 20. Rejections
return JSON HTTP 429. Reading and logout do not consume that bucket. Behind an
outer reverse proxy this address may be shared by all readers. For larger
deployments enforce client-based limits at the trusted outer proxy and review
the inner limit; do not trust arbitrary `X-Forwarded-For` values. This is basic
burst protection, not a complete public-service abuse policy.

## Build and release

From the intended, reviewed source revision:

```sh
go vet ./...
go test ./...
go build ./...
docker build --target test -f Dockerfile.reader .
npm ci --ignore-scripts
npx playwright install chromium
npm run test:browser
python scripts/update_notices.py --check
docker compose config --quiet
docker compose up --build -d app web
docker compose ps
```

Go modules and browser-test packages are locked. Docker base image manifests are
pinned by digest in both Dockerfiles. Alpine package repositories still supply
the installed CA/compiler packages at build time; builds are not claimed to be
bit-for-bit reproducible. The runtime contains no Node, browser, or compiler.
Browser tooling is development-only and does not add a frontend bundling step.

Keep a record of source commit and built image IDs for each release. Retain the
previous release's complete source directory (including matching `web/` assets),
images, and local deployment configuration. The static directory is bind-mounted
in development, so rolling back only the Go image is insufficient.

For managed deployment, use a separate directory for each source revision and a
fixed Compose project name, such as `docker compose -p news-stability up --build
-d app web`. Carry the reviewed local override/certificate into each release
directory without committing them. Switch releases from the matching directory
using the same project name. Revert by running `up -d --no-build app web` from
the previous release directory with its retained image tags or image override.
Give release images unique tags before building another release; Compose's
default `latest` tags alone do not preserve rollback images. Never run both
release stacks against the same host port at once.

Rebuild after Go, Nginx, dependency, or trust configuration changes. A restart
invalidates in-memory reader sessions; readers must sign in again. There is no
reader database to migrate or restore. Feed subscriptions, story state, and
briefings remain in NewsBlur; back up that service using its own procedures.

Review base-image security updates regularly and update the pinned digests in a
reviewed change. Repeat the native, Linux race, browser, notice, and isolated
Compose checks before deploying. Upgrades must preserve third-party notices.

## Acceptance and troubleshooting

Check `/healthz` and `/api/healthz` for liveness, then follow
[installed acceptance](acceptance.md). Liveness does not prove upstream access.
Check resolution, routing, and the mounted trust file for `upstream_tls` or 502
errors. A wrong browser hostname/port causes Origin rejection. HTTP 429 means
wait and retry manually; the reader never retries a state-changing request.

Inspect service health and safe startup errors with `docker compose ps` and
`docker compose logs app web`. Do not export cookies, credentials, request bodies,
or private story content. A failed state change can have an uncertain outcome:
refresh from NewsBlur before retrying. See [debugging](debugging.md).

The example HTTPS proxy, certificate renewal, and release rollback procedure
still require operator execution in the intended environment; local checks do
not certify a public deployment.
