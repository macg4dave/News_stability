// Package httpserver owns reader HTTP routing and server lifecycle.
package httpserver

import "net/http"

// NewHandler returns the reader routes. A nil Auth exposes health only.
func NewHandler(auth *Auth) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", health)
	if auth != nil {
		mux.HandleFunc("GET /api/session", auth.status)
		mux.HandleFunc("POST /api/login", auth.login)
		mux.HandleFunc("POST /api/logout", auth.logout)
		mux.HandleFunc("GET /api/feeds", auth.feeds)
		mux.HandleFunc("GET /api/saved", auth.savedStories)
		mux.HandleFunc("GET /api/feeds/{id}/stories", auth.stories)
		mux.HandleFunc("GET /api/briefing", auth.briefing)
		mux.HandleFunc("GET /api/stories/{hash}", auth.linkedStory)
		mux.HandleFunc("GET /api/stories/{hash}/text", auth.fullText)
		mux.HandleFunc("POST /api/stories/{hash}/state", auth.storyState)
	}
	return mux
}

func health(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	// The response is constant; failed writes mean the client has gone away.
	_, _ = w.Write([]byte("{\"status\":\"ok\"}\n"))
}
