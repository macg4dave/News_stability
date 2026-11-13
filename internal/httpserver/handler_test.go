package httpserver_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"newsstability/internal/httpserver"
)

func TestRoutes(t *testing.T) {
	handler := httpserver.NewHandler(nil)
	for _, tc := range []struct {
		method string
		path   string
		status int
	}{
		{http.MethodGet, "/healthz", http.StatusOK},
		{http.MethodPost, "/healthz", http.StatusMethodNotAllowed},
		{http.MethodGet, "/missing", http.StatusNotFound},
		{http.MethodGet, "/healthz/other", http.StatusNotFound},
	} {
		t.Run(tc.method+tc.path, func(t *testing.T) {
			response := httptest.NewRecorder()
			handler.ServeHTTP(response, httptest.NewRequest(tc.method, tc.path, nil))
			if response.Code != tc.status {
				t.Fatalf("status = %d, want %d", response.Code, tc.status)
			}
			if tc.status == http.StatusOK {
				if response.Body.String() != "{\"status\":\"ok\"}\n" {
					t.Errorf("unexpected health body: %q", response.Body.String())
				}
				if response.Header().Get("Cache-Control") != "no-store" {
					t.Error("health response must not be cached")
				}
			}
		})
	}
}
