package httpserver

import (
	"errors"
	"net/http"
	"strconv"

	"newsstability/internal/article"
	"newsstability/internal/newsblur"
)

func (a *Auth) feeds(w http.ResponseWriter, r *http.Request) {
	if !a.sameOrigin(r, false) {
		apiError(w, http.StatusForbidden, "origin_rejected", "Open the reader from its configured address.")
		return
	}
	e, ok := a.current(r)
	if !ok || e.Client == nil {
		a.clearCookie(w)
		apiError(w, http.StatusUnauthorized, "session_expired", "Sign in to load your feeds.")
		return
	}
	nav, err := e.Client.Feeds(r.Context())
	if err != nil {
		if errors.Is(err, newsblur.ErrSessionExpired) {
			a.store.Delete(e.ID)
			a.clearCookie(w)
			apiError(w, http.StatusUnauthorized, "session_expired", "Your NewsBlur session expired. Sign in again.")
			return
		}
		apiError(w, http.StatusBadGateway, "upstream_unavailable", "Could not refresh feeds. Your current view has been kept.")
		return
	}
	// Logout may have occurred while NewsBlur was responding.
	if _, ok := a.store.Get(e.ID); !ok {
		apiError(w, http.StatusUnauthorized, "session_expired", "Your session expired. Sign in again.")
		return
	}
	writeJSON(w, http.StatusOK, nav)
}

func (a *Auth) stories(w http.ResponseWriter, r *http.Request) {
	if !a.sameOrigin(r, false) {
		apiError(w, http.StatusForbidden, "origin_rejected", "Open the reader from its configured address.")
		return
	}
	e, ok := a.current(r)
	if !ok || e.Client == nil {
		a.clearCookie(w)
		apiError(w, http.StatusUnauthorized, "session_expired", "Sign in to load stories.")
		return
	}
	id, idErr := strconv.Atoi(r.PathValue("id"))
	var err error
	page := 1
	if value := r.URL.Query().Get("page"); value != "" {
		page, err = strconv.Atoi(value)
	}
	if idErr != nil || err != nil || id < 1 || page < 1 || page > 10000 {
		apiError(w, http.StatusBadRequest, "invalid_request", "Choose a valid feed and page.")
		return
	}
	result, err := e.Client.Stories(r.Context(), id, page)
	if err != nil {
		if errors.Is(err, newsblur.ErrSessionExpired) {
			a.store.Delete(e.ID)
			a.clearCookie(w)
			apiError(w, http.StatusUnauthorized, "session_expired", "Your NewsBlur session expired. Sign in again.")
			return
		}
		apiError(w, http.StatusBadGateway, "upstream_unavailable", "Could not load stories. Your current view has been kept.")
		return
	}
	if _, ok := a.store.Get(e.ID); !ok {
		apiError(w, http.StatusUnauthorized, "session_expired", "Your session expired. Sign in again.")
		return
	}
	type story struct {
		Hash   string `json:"hash"`
		Title  string `json:"title"`
		Author string `json:"author"`
		Date   string `json:"date"`
		URL    string `json:"url,omitempty"`
		HTML   string `json:"html"`
		Read   bool   `json:"read"`
		Saved  bool   `json:"saved"`
	}
	items := make([]story, 0, len(result.Stories))
	for _, s := range result.Stories {
		items = append(items, story{Hash: s.Hash, Title: s.Title, Author: s.Author, Date: s.Date, URL: article.SafeURL(s.URL), HTML: a.article.HTML(s.Content), Read: s.Read, Saved: s.Saved})
	}
	writeJSON(w, http.StatusOK, struct {
		Stories     []story `json:"stories"`
		Page        int     `json:"page"`
		CanContinue bool    `json:"can_continue"`
	}{items, result.Page, result.Page < 10000 && (len(items) > 0 || result.Hidden > 0)})
}
