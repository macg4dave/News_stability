# News Stability

A focused web reader for an existing self-hosted **NewsBlur** server at
`news101.lan`. Go provides the reader server; Nginx serves the web entry point.
NewsBlur remains responsible for feeds, stories, intelligence, and Daily Briefing
generation. We present those capabilities through a simpler reading interface.

Current status: working Go health service, development page/proxy, Docker setup,
debug configurations, tests, and focused AI rules. Login, the reader UI, and
Daily Briefing presentation are planned. No frontend framework is installed yet.

## Documentation

- [Architecture and project layout](docs/architecture.md)
- [Development and configuration](docs/development.md)
- [Debugging: Go, VS Code, Docker](docs/debugging.md)
- [Roadmap and milestone acceptance](docs/roadmap.md)
- [Blockers and unverified dependencies](docs/blockers.md)
- [Prioritized backlog](docs/backlog.md)
- [AI rule index](AGENTS.md)

## Native Go development

Requires Go 1.26 or newer. No third-party Go dependencies are currently needed.

```sh
go run ./cmd/reader
```

Open http://127.0.0.1:8090/healthz. This starts the Go service only. Use the
included **Go: reader** VS Code debug configuration for breakpoints; see the
[debugging guide](docs/debugging.md) for Go extension/Delve setup.

## Start development

Requires Docker Engine/Desktop with Linux containers and Docker Compose v2.

```sh
cp .env.example .env
docker compose up --build -d web
```

In PowerShell, use `Copy-Item .env.example .env` for the copy step.
Open http://localhost:8080. Compose starts both Nginx and the Go app.
Files in `web/` are mounted for immediate editing.
Set `WEB_PORT` or `NEWSBLUR_ORIGIN` in `.env` as needed, then recreate the service.
Use an origin without a trailing slash, for example `http://news101.lan` or
`https://news101.lan`. The container must be able to resolve and reach that host.
Nginx uses Docker DNS to resolve the upstream at request time.

```sh
docker compose logs -f app web
docker compose down
```

## Test

```sh
go fmt ./...
go vet ./...
go test ./...
go build ./...
docker build --target test -f Dockerfile.reader .
python -B -m unittest discover -s tests -v
docker compose config --quiet
docker compose --profile test run --rm test
docker compose -f compose.yaml -f compose.test.yaml --profile test run --build --rm integration
docker compose -f compose.yaml -f compose.test.yaml --profile test down
```

The integration test starts Nginx, the Go service, and a mock NewsBlur upstream;
it does not access `news101.lan` or require credentials. Linux CI also runs
`go test -race ./...`. See [verification rules](docs/ai/testing.md) for details.

## Early development references

- [NewsBlur API](https://www.newsblur.com/api)
- [NewsBlur source](https://github.com/samuelclay/newsblur)
- [Local NewsBlur](http://news101.lan)
- [Development and integration notes](docs/development.md)
- [AI contributor instructions](AGENTS.md)

Development binds to loopback by default. This HTTP setup is for local work;
configure HTTPS before exposing authenticated reader traffic beyond your machine.
