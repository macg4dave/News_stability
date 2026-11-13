package httpserver

import (
	"net/http"
	"net/url"

	"newsstability/internal/newsblur"
)

func imageURL(client *newsblur.Client, value string) string {
	if imagePath := client.ImagePath(value); imagePath != "" {
		return "/api/newsblur-picture?" + url.Values{"path": {imagePath}}.Encode()
	}
	return value
}

func (a *Auth) picture(w http.ResponseWriter, r *http.Request) {
	e, ok := a.readingSession(w, r)
	if !ok {
		return
	}
	query, err := url.ParseQuery(r.URL.RawQuery)
	if err != nil || len(query) != 1 || len(query["path"]) != 1 || e.Client.ImagePath(query.Get("path")) != query.Get("path") || query.Get("path") == "" {
		apiError(w, http.StatusBadRequest, "invalid_request", "Choose a valid NewsBlur picture.")
		return
	}
	body, kind, err := e.Client.Image(r.Context(), query.Get("path"))
	if err != nil {
		apiError(w, http.StatusNotFound, "picture_unavailable", "Picture unavailable from NewsBlur.")
		return
	}
	if _, ok := a.store.Get(e.ID); !ok {
		apiError(w, http.StatusUnauthorized, "session_expired", "Sign in to continue reading.")
		return
	}
	w.Header().Set("Content-Type", kind)
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Content-Security-Policy", "default-src 'none'; sandbox")
	w.Header().Set("Cross-Origin-Resource-Policy", "same-origin")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(body)
}
