package httpserver_test

import (
	"context"
	"io"
	"log/slog"
	"net"
	"net/http"
	"testing"
	"time"

	"newsstability/internal/httpserver"
)

func TestRunDrainsActiveRequest(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	entered := make(chan struct{})
	release := make(chan struct{})
	defer close(release)
	server := &http.Server{
		Addr: "127.0.0.1:0",
		Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			close(entered)
			<-release
			w.WriteHeader(http.StatusNoContent)
		}),
	}
	// BaseContext exposes the listener address without polling or reserving a port.
	ready := make(chan string, 1)
	server.BaseContext = func(listener net.Listener) context.Context {
		ready <- listener.Addr().String()
		return context.Background()
	}
	finished := make(chan error, 1)
	go func() { finished <- httpserver.Run(ctx, server, slog.New(slog.NewTextHandler(io.Discard, nil))) }()
	var addr string
	select {
	case addr = <-ready:
	case err := <-finished:
		t.Fatalf("server stopped before ready: %v", err)
	case <-time.After(5 * time.Second):
		t.Fatal("server did not start")
	}
	requestDone := make(chan error, 1)
	go func() {
		client := &http.Client{Timeout: 5 * time.Second}
		response, err := client.Get("http://" + addr)
		if err == nil {
			err = response.Body.Close()
		}
		requestDone <- err
	}()
	select {
	case <-entered:
	case <-time.After(5 * time.Second):
		t.Fatal("request did not enter handler")
	}
	cancel()
	select {
	case err := <-finished:
		t.Fatalf("server returned before active request completed: %v", err)
	default:
	}
	release <- struct{}{}
	select {
	case err := <-requestDone:
		if err != nil {
			t.Errorf("active request failed: %v", err)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("request did not finish")
	}
	select {
	case err := <-finished:
		if err != nil {
			t.Errorf("Run: %v", err)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("server did not shut down")
	}
}
