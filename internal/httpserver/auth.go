package httpserver

import (
	"context"
	"crypto/subtle"
	"crypto/x509"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"time"

	"newsstability/internal/article"
	"newsstability/internal/newsblur"
	"newsstability/internal/session"
)

// Auth connects reader sessions to one fixed NewsBlur origin. The factory creates
// a fresh upstream cookie jar for every login attempt.
type Auth struct {
	origin    string
	secure    bool
	store     *session.Store
	newClient func() (*newsblur.Client, error)
	article   *article.Sanitizer
}

// NewAuth creates authentication routes for a validated public reader origin.
func NewAuth(origin string, store *session.Store, factory func() (*newsblur.Client, error)) *Auth {
	return &Auth{origin: origin, secure: strings.HasPrefix(origin, "https://"), store: store, newClient: factory, article: article.New()}
}

func (a *Auth) cookieName() string {
	if a.secure {
		return "__Host-reader_session"
	}
	return "reader_session"
}

func (a *Auth) cookie(w http.ResponseWriter, e session.Entry) {
	http.SetCookie(w, &http.Cookie{Name: a.cookieName(), Value: e.ID, Path: "/", Secure: a.secure,
		HttpOnly: true, SameSite: http.SameSiteStrictMode, Expires: e.Expires})
}

func (a *Auth) clearCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{Name: a.cookieName(), Path: "/", Secure: a.secure,
		HttpOnly: true, SameSite: http.SameSiteStrictMode, MaxAge: -1, Expires: time.Unix(1, 0)})
}

func (a *Auth) current(r *http.Request) (session.Entry, bool) {
	cookie, err := r.Cookie(a.cookieName())
	if err != nil {
		return session.Entry{}, false
	}
	return a.store.Get(cookie.Value)
}

func (a *Auth) status(w http.ResponseWriter, r *http.Request) {
	if !a.sameOrigin(r, false) {
		apiError(w, http.StatusForbidden, "origin_rejected", "Open the reader from its configured address.")
		return
	}
	e, ok := a.current(r)
	if ok && e.Client != nil && !e.Client.HasSession() {
		a.store.Delete(e.ID)
		ok = false
	}
	if !ok {
		var err error
		e, err = a.store.Create()
		if err != nil {
			apiError(w, http.StatusServiceUnavailable, "session_capacity", "The reader is busy. Try again shortly.")
			return
		}
		a.cookie(w, e)
	}
	a.sessionResponse(w, e)
}

func (a *Auth) sessionResponse(w http.ResponseWriter, e session.Entry) {
	writeJSON(w, http.StatusOK, struct {
		Authenticated bool      `json:"authenticated"`
		Username      string    `json:"username,omitempty"`
		CSRF          string    `json:"csrf_token"`
		Expires       time.Time `json:"expires_at"`
	}{e.Client != nil, e.Username, e.CSRF, e.Expires})
}

func (a *Auth) sameOrigin(r *http.Request, write bool) bool {
	if site := r.Header.Get("Sec-Fetch-Site"); site != "" && site != "same-origin" && site != "none" {
		return false
	}
	origin := r.Header.Get("Origin")
	if write {
		return origin == a.origin
	}
	return origin == "" || origin == a.origin
}

func (a *Auth) mutation(w http.ResponseWriter, r *http.Request) (session.Entry, bool) {
	if !a.sameOrigin(r, true) {
		apiError(w, http.StatusForbidden, "origin_rejected", "Reload the reader from its configured address.")
		return session.Entry{}, false
	}
	e, ok := a.current(r)
	if !ok {
		a.clearCookie(w)
		apiError(w, http.StatusUnauthorized, "session_expired", "Your session expired. Sign in again.")
		return session.Entry{}, false
	}
	if subtle.ConstantTimeCompare([]byte(r.Header.Get("X-CSRF-Token")), []byte(e.CSRF)) != 1 {
		apiError(w, http.StatusForbidden, "csrf_rejected", "Reload the reader before trying again.")
		return session.Entry{}, false
	}
	return e, true
}

func (a *Auth) login(w http.ResponseWriter, r *http.Request) {
	e, ok := a.mutation(w, r)
	if !ok {
		return
	}
	if e.Client != nil {
		apiError(w, http.StatusConflict, "already_signed_in", "Sign out before changing accounts.")
		return
	}
	if r.Header.Get("Content-Type") != "application/json" {
		apiError(w, http.StatusUnsupportedMediaType, "invalid_request", "Send the sign-in form as JSON.")
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 16<<10)
	var credentials struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if decoder.Decode(&credentials) != nil || decoder.Decode(&struct{}{}) != io.EOF || strings.TrimSpace(credentials.Username) == "" {
		apiError(w, http.StatusBadRequest, "invalid_request", "Enter a username and password.")
		return
	}
	client, err := a.newClient()
	if err != nil {
		apiError(w, http.StatusServiceUnavailable, "upstream_unavailable", "Sign-in is unavailable. Try again later.")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 20*time.Second)
	defer cancel()
	if err = client.Prepare(ctx); err == nil {
		err = client.Login(ctx, credentials.Username, credentials.Password)
	}
	credentials.Password = ""
	if err != nil {
		var authority x509.UnknownAuthorityError
		var hostname x509.HostnameError
		var invalid x509.CertificateInvalidError
		if errors.As(err, &authority) || errors.As(err, &hostname) || errors.As(err, &invalid) {
			apiError(w, http.StatusBadGateway, "upstream_tls", "Could not verify NewsBlur's secure connection. The reader's trust settings need attention.")
			return
		}
		if errors.Is(err, newsblur.ErrRequestTooLarge) {
			apiError(w, http.StatusBadRequest, "invalid_request", "The sign-in details are too long.")
			return
		}
		if errors.Is(err, newsblur.ErrRejected) {
			apiError(w, http.StatusUnauthorized, "invalid_login", "NewsBlur did not accept those credentials.")
			return
		}
		apiError(w, http.StatusBadGateway, "upstream_unavailable", "Could not sign in to NewsBlur. Check the connection and try again.")
		return
	}
	if !client.HasSession() {
		apiError(w, http.StatusBadGateway, "invalid_upstream_session", "NewsBlur did not establish a session.")
		return
	}
	next, ok := a.store.Authenticate(e.ID, credentials.Username, client)
	if !ok {
		// An overlapping logout/login invalidated the anonymous session. Do not
		// expose the orphan upstream session to a different browser session.
		_ = client.Logout(r.Context())
		apiError(w, http.StatusConflict, "session_changed", "Your session changed. Reload the reader and sign in again.")
		return
	}
	a.cookie(w, next)
	a.sessionResponse(w, next)
}

func (a *Auth) logout(w http.ResponseWriter, r *http.Request) {
	e, ok := a.mutation(w, r)
	if !ok {
		return
	}
	a.store.Delete(e.ID)
	a.clearCookie(w)
	if e.Client != nil {
		if err := e.Client.Logout(r.Context()); err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"signed_out": true, "code": "upstream_logout_failed", "message": "Signed out of this reader. NewsBlur could not confirm upstream sign-out."})
			return
		}
	}
	writeJSON(w, http.StatusOK, map[string]bool{"signed_out": true})
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func apiError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, map[string]string{"code": code, "message": message})
}
