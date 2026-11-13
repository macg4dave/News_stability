# Debugging

## Native Go: fastest feedback

Requires Go 1.26 or newer. From the repository root:

```sh
go run ./cmd/reader
```

Open http://127.0.0.1:8090/healthz for `{"status":"ok"}`. This starts the Go
service only, not the Nginx/static page. Press Ctrl+C to drain
requests and stop. The Go process uses `HTTP_ADDR` from the environment, defaulting
to `127.0.0.1:8090`; it does not load `.env`. Compose alone reads `.env`.

PowerShell override:

```powershell
$env:HTTP_ADDR = '127.0.0.1:8091'
go run ./cmd/reader
Remove-Item Env:HTTP_ADDR
```

Logs use `log/slog` JSON on stderr, including the bound address, startup failure,
and shutdown. Request logging will be added with real feature endpoints; it must
exclude credentials, cookies, query strings, and story content.

## VS Code / compatible Go extension

Install the recommended `golang.go` extension. Use its **Go: Install/Update Tools**
command to install `gopls` and `dlv` (Delve) compatible with your Go version.
Then choose **Go: reader** in Run and Debug and press F5. Put a breakpoint in
`internal/httpserver/handler.go`, request `/healthz`, and inspect the request.
**Go: current package tests** debugs tests in the directory of the active Go file.
Use the supplied build/test tasks or the extension's individual test controls.

The extension manages debug compilation and its local debugger. No debugger port
is published by Compose. Delve is not included in the runtime image. If the
debugger rejects a newer Go version, update Delve before disabling any checks.

For CLI debugging after installing Delve:

```sh
dlv debug ./cmd/reader
```

Setup verification used Delve 1.27.2 with local Go 1.27: the health-handler
breakpoint stopped a real request, `print r.Method` returned `"GET"`, and
continuing returned the expected health response. The VS Code configuration
has not been launched in an editor during setup. Delve installs into the Go bin
directory; if `dlv` is not on PATH, use `go env GOPATH` to locate `bin/dlv`
(`bin/dlv.exe` on Windows), or let the Go extension manage the tool.

Enter `break newsstability/internal/httpserver.health`, then `continue`; request
the health endpoint from another terminal. Use `locals`, `stack`, and `next` to
inspect it. See [Go diagnostics](https://go.dev/doc/diagnostics) for debugger and
profiling guidance. For a manually compiled debug binary, disable optimization
and inlining with `go build -gcflags="all=-N -l" -o bin/reader ./cmd/reader`.
On Windows use output name `bin/reader.exe`.

## Full Docker stack

```sh
docker compose up --build -d web
docker compose ps
docker compose logs -f app web
```

Open http://localhost:8080 for the page, `/healthz` for Nginx, and `/api/healthz`
for the Go service through Nginx. An `ok` liveness response does not prove that
NewsBlur is reachable or a session is authenticated. A Go change needs a rebuild:
`docker compose up --build -d app web`. Static `web/` edits are mounted directly.

If Docker reports a missing `dockerDesktopLinuxEngine` pipe, start Docker Desktop
in Linux-container mode and check `docker version`. If a reader API returns 502, verify the Go `NEWSBLUR_ORIGIN`,
container DNS/connectivity, and `NEWSBLUR_CA_FILE` trust configuration. Go now owns
the upstream HTTPS connection; Nginx no longer forwards directly to NewsBlur.
Use the exact `PUBLIC_ORIGIN` in the browser for login/logout Origin checks.
Do not export request traces with credentials or cookies.
If Nginx health works but `/api/healthz` fails, inspect `docker compose ps app`
and the app logs. Stop the stack with `docker compose down`.

## Tests and deeper diagnostics

```sh
go test -v ./...
go test -count=1 ./internal/httpserver
go test -race ./...
```

The race detector needs a compatible C toolchain locally; Linux CI runs it.
You can also use `docker build --target test -f Dockerfile.reader .`; that target
installs the compiler in a build stage and runs the race suite, keeping those
tools out of the runtime image.
No HTTP profiling listener is currently enabled. For an observed performance
problem, start with a targeted benchmark or test profile; e.g.:

```sh
go test -cpuprofile=cpu.prof ./internal/httpserver
go tool pprof cpu.prof
```

Current tests are small, so that example may collect few samples. Add a realistic
benchmark before drawing performance conclusions. Keep generated profiles out of
Git. If a profiling listener becomes necessary, bind it separately to loopback,
disabled by default, and test that public routes cannot reach it.
