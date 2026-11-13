package newsblur

import (
	"context"
	"crypto/x509"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func trustedClient(t *testing.T, server *httptest.Server) *Client {
	t.Helper()
	c, err := New(server.URL)
	if err != nil {
		t.Fatal(err)
	}
	c.http.Transport = server.Client().Transport
	return c
}

func TestSessionFlow(t *testing.T) {
	var logins atomic.Int32
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.Header.Get("User-Agent") != "NewsStability/0.1" ||
			r.Header.Get("Content-Type") != "application/x-www-form-urlencoded" || r.Header.Get("Accept") != "application/json" {
			t.Error("incorrect request method or headers")
		}
		switch r.URL.Path {
		case "/api/login":
			logins.Add(1)
			if err := r.ParseForm(); err != nil {
				t.Error(err)
			}
			if r.Form.Get("username") != "reader+fixture" || r.Form.Get("password") != "a&b=synthetic" || r.URL.RawQuery != "" {
				t.Error("credentials not encoded exclusively in form body")
			}
			http.SetCookie(w, &http.Cookie{Name: "newsblur_sessionid", Value: "synthetic", Path: "/", Secure: true, HttpOnly: true})
		case "/api/logout":
			cookie, err := r.Cookie("newsblur_sessionid")
			if err != nil || cookie.Value != "synthetic" {
				w.WriteHeader(http.StatusUnauthorized)
				return
			}
			http.SetCookie(w, &http.Cookie{Name: "newsblur_sessionid", Path: "/", MaxAge: -1, Secure: true})
		default:
			t.Errorf("unexpected path %s", r.URL.Path)
		}
		fmt.Fprint(w, `{"code":1}`)
	}))
	defer server.Close()
	c := trustedClient(t, server)
	if err := c.Login(context.Background(), "reader+fixture", "a&b=synthetic"); err != nil {
		t.Fatal(err)
	}
	// A different reader must never inherit the first reader's upstream cookies.
	other := trustedClient(t, server)
	var status *StatusError
	if err := other.Logout(context.Background()); !errors.As(err, &status) || status.StatusCode != http.StatusUnauthorized {
		t.Fatalf("isolated logout error = %v", err)
	}
	if err := c.Logout(context.Background()); err != nil {
		t.Fatal(err)
	}
	if err := c.Logout(context.Background()); !errors.As(err, &status) || status.StatusCode != http.StatusUnauthorized {
		t.Fatalf("cookie was not cleared: %v", err)
	}
	if logins.Load() != 1 {
		t.Fatal("login was retried")
	}
}

func TestResponseFailures(t *testing.T) {
	for _, tc := range []struct {
		name   string
		status int
		body   string
		want   error
	}{
		{"invalid credentials", 200, `{"code":-1,"errors":{"password":"sensitive"}}`, ErrRejected},
		{"missing code", 200, `{}`, ErrInvalidResponse},
		{"null", 200, `null`, ErrInvalidResponse},
		{"wrong type", 200, `{"code":"sensitive"}`, ErrInvalidResponse},
		{"html", 200, `<html>sensitive</html>`, ErrInvalidResponse},
		{"trailing data", 200, `{"code":1}{}`, ErrInvalidResponse},
		{"oversized", 200, strings.Repeat("s", maxResponseBytes+1), ErrResponseTooLarge},
		{"forbidden", 403, `sensitive`, nil},
		{"server error", 503, `sensitive`, nil},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var calls atomic.Int32
			server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				calls.Add(1)
				w.WriteHeader(tc.status)
				fmt.Fprint(w, tc.body)
			}))
			defer server.Close()
			c := trustedClient(t, server)
			err := c.Login(context.Background(), "sensitive", "sensitive")
			if tc.want != nil {
				if !errors.Is(err, tc.want) {
					t.Fatalf("error = %v, want %v", err, tc.want)
				}
			} else {
				var status *StatusError
				if !errors.As(err, &status) || status.StatusCode != tc.status {
					t.Fatalf("error = %v", err)
				}
			}
			if err == nil || strings.Contains(err.Error(), "sensitive") || strings.Contains(err.Error(), server.URL) {
				t.Fatalf("unsafe or missing error: %v", err)
			}
			if calls.Load() != 1 {
				t.Fatal("write was retried")
			}
		})
	}
}

func TestRedirectsAreNotFollowed(t *testing.T) {
	for _, code := range []int{301, 302, 303, 307, 308} {
		t.Run(fmt.Sprint(code), func(t *testing.T) {
			var destinationCalls atomic.Int32
			destination := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				destinationCalls.Add(1)
			}))
			defer destination.Close()
			server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				http.Redirect(w, r, destination.URL+"/sensitive", code)
			}))
			defer server.Close()
			c := trustedClient(t, server)
			var status *StatusError
			if err := c.Login(context.Background(), "fixture", "synthetic"); !errors.As(err, &status) || status.StatusCode != code {
				t.Fatalf("redirect error = %v", err)
			}
			if destinationCalls.Load() != 0 {
				t.Fatal("redirect destination received request")
			}
		})
	}
}

func TestContextCancellation(t *testing.T) {
	started := make(chan struct{})
	stopped := make(chan struct{})
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, err := io.Copy(io.Discard, r.Body); err != nil {
			t.Error(err)
		}
		close(started)
		<-r.Context().Done()
		close(stopped)
	}))
	defer server.Close()
	c := trustedClient(t, server)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	done := make(chan error, 1)
	go func() { done <- c.Login(ctx, "fixture", "synthetic") }()
	<-started
	cancel()
	if err := <-done; !errors.Is(err, context.Canceled) {
		t.Fatalf("error = %v", err)
	}
	<-stopped
}

func TestCertificateVerification(t *testing.T) {
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("untrusted connection reached handler")
	}))
	defer server.Close()
	c, err := New(server.URL)
	if err != nil {
		t.Fatal(err)
	}
	var authorityError x509.UnknownAuthorityError
	if err := c.Login(context.Background(), "fixture", "synthetic"); !errors.As(err, &authorityError) || strings.Contains(err.Error(), server.URL) {
		t.Fatalf("expected safe certificate failure, got %v", err)
	}
}

func TestRequestTimeout(t *testing.T) {
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		io.Copy(io.Discard, r.Body)
		<-r.Context().Done()
	}))
	defer server.Close()
	c := trustedClient(t, server)
	c.http.Timeout = 50 * time.Millisecond
	if err := c.Login(context.Background(), "fixture", "synthetic"); !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("timeout error = %v", err)
	}
}

func TestOversizedCredentialsAreNotSent(t *testing.T) {
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("oversized credentials reached upstream")
	}))
	defer server.Close()
	c := trustedClient(t, server)
	for _, password := range []string{strings.Repeat("x", maxFormBytes+1), strings.Repeat("&", maxFormBytes/2)} {
		if err := c.Login(context.Background(), "fixture", password); !errors.Is(err, ErrRequestTooLarge) {
			t.Fatalf("oversized form error = %v", err)
		}
	}
}

func TestOriginValidation(t *testing.T) {
	for _, origin := range []string{
		"", "http://news101.lan", "https://", "https://user:secret@news101.lan",
		"https://news101.lan/", "https://news101.lan/api", "https://news101.lan?secret=x",
		"https://news101.lan?", "https://news101.lan#secret", "https://news101.lan#",
		"https://news101.lan:bad", "https:news101.lan",
		"https://news101.lan:0", "https://news101.lan:65536",
	} {
		if _, err := New(origin); err == nil || strings.Contains(err.Error(), "secret") {
			t.Errorf("origin should be rejected with a safe error: %q", origin)
		}
	}
	for _, origin := range []string{"https://news101.lan", "https://news101.lan:8443", "https://[::1]:8443"} {
		if _, err := New(origin); err != nil {
			t.Errorf("valid origin rejected: %v", err)
		}
	}
}
