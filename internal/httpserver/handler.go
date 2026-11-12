// Package httpserver owns reader HTTP routing and server lifecycle.
package httpserver

import "net/http"

// NewHandler returns the reader routes without contacting NewsBlur.
func NewHandler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", health)
	return mux
}

func health(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	// The response is constant; failed writes mean the client has gone away.
	_, _ = w.Write([]byte("{\"status\":\"ok\"}\n"))
}
