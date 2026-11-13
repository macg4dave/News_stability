// Command reader runs the News Stability HTTP service.
package main

import (
	"context"
	"crypto/x509"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"newsstability/internal/config"
	"newsstability/internal/httpserver"
	"newsstability/internal/newsblur"
	"newsstability/internal/session"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stderr, nil))
	if err := run(logger); err != nil {
		logger.Error("reader stopped", "error", err)
		os.Exit(1)
	}
}

func run(logger *slog.Logger) error {
	cfg, err := config.Load(os.Getenv)
	if err != nil {
		return fmt.Errorf("load configuration: %w", err)
	}
	var roots *x509.CertPool
	if cfg.NewsBlurCAFile != "" {
		pem, err := os.ReadFile(cfg.NewsBlurCAFile)
		if err != nil {
			return fmt.Errorf("cannot read NEWSBLUR_CA_FILE")
		}
		roots, err = x509.SystemCertPool()
		if err != nil {
			return fmt.Errorf("cannot load system certificate roots")
		}
		if !roots.AppendCertsFromPEM(pem) {
			return fmt.Errorf("NEWSBLUR_CA_FILE contains no usable certificates")
		}
	}
	newClient := func() (*newsblur.Client, error) { return newsblur.NewWithRootCAs(cfg.NewsBlurOrigin, roots) }
	if _, err := newClient(); err != nil {
		return fmt.Errorf("configure NewsBlur: %w", err)
	}
	sessions, err := session.New(1024)
	if err != nil {
		return err
	}
	auth := httpserver.NewAuth(cfg.PublicOrigin, sessions, newClient)
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	return httpserver.Run(ctx, &http.Server{
		Addr:              cfg.HTTPAddr,
		Handler:           httpserver.NewHandler(auth),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
		ErrorLog:          slog.NewLogLogger(logger.Handler(), slog.LevelError),
	}, logger)
}
