package httpserver

import (
	"net/http"
	"strconv"

	"newsstability/internal/newsblur"
)

func (a *Auth) briefing(w http.ResponseWriter, r *http.Request) {
	e, ok := a.readingSession(w, r)
	if !ok {
		return
	}
	page := 1
	var err error
	if value := r.URL.Query().Get("page"); value != "" {
		page, err = strconv.Atoi(value)
	}
	if err != nil || page < 1 || page > 10000 {
		apiError(w, http.StatusBadRequest, "invalid_request", "Choose a valid briefing page.")
		return
	}
	result, err := e.Client.Briefing(r.Context(), page)
	if err != nil {
		a.readingFailure(w, e, err, "Could not load Daily Briefing. Your current view has been kept.")
		return
	}
	if _, ok := a.store.Get(e.ID); !ok {
		apiError(w, http.StatusUnauthorized, "session_expired", "Your session expired. Sign in again.")
		return
	}
	writeJSON(w, http.StatusOK, struct {
		Stories     []readerStory `json:"stories"`
		State       string        `json:"state"`
		Preview     bool          `json:"preview"`
		Page        int           `json:"page"`
		CanContinue bool          `json:"can_continue"`
	}{a.presentStories(result.Stories), result.State, result.Preview, result.Page, result.HasNext})
}

func (a *Auth) linkedStory(w http.ResponseWriter, r *http.Request) {
	e, ok := a.readingSession(w, r)
	if !ok {
		return
	}
	s, err := e.Client.StoryByHash(r.Context(), r.PathValue("hash"))
	if err != nil {
		a.readingFailure(w, e, err, "Could not load the linked story. Your current article has been kept.")
		return
	}
	if _, ok := a.store.Get(e.ID); !ok {
		apiError(w, http.StatusUnauthorized, "session_expired", "Your session expired. Sign in again.")
		return
	}
	writeJSON(w, http.StatusOK, a.presentStories([]newsblur.Story{s})[0])
}
