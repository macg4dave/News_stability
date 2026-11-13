package httpserver

import (
	"errors"
	"net/http"

	"newsstability/internal/newsblur"
)

func (a *Auth) fullText(w http.ResponseWriter, r *http.Request) {
	e, ok := a.readingSession(w, r)
	if !ok {
		return
	}
	hash := r.PathValue("hash")
	if !newsblur.ValidStoryHash(hash) {
		apiError(w, http.StatusBadRequest, "invalid_request", "Choose a valid story.")
		return
	}
	story, err := e.Client.FullText(r.Context(), hash)
	if err != nil {
		if errors.Is(err, newsblur.ErrFullTextUnavailable) {
			apiError(w, http.StatusNotFound, "full_text_unavailable", "Full text is unavailable from NewsBlur.")
		} else {
			a.readingFailure(w, e, err, "Could not load full text from NewsBlur.")
		}
		return
	}
	if _, ok := a.store.Get(e.ID); !ok {
		apiError(w, http.StatusUnauthorized, "session_expired", "Your session expired. Sign in again.")
		return
	}
	presented := a.presentStories([]newsblur.Story{story}, e.Client)[0]
	if presented.Excerpt == "" {
		apiError(w, http.StatusNotFound, "full_text_unavailable", "Full text is unavailable from NewsBlur.")
		return
	}
	writeJSON(w, http.StatusOK, struct {
		Hash           string   `json:"hash"`
		HTML           string   `json:"html"`
		ReadingMinutes int      `json:"reading_minutes"`
		Links          []string `json:"links"`
		Picture        string   `json:"picture,omitempty"`
		Pictures       []string `json:"pictures,omitempty"`
	}{presented.Hash, presented.HTML, presented.ReadingMinutes, presented.Links, presented.Picture, presented.Pictures})
}
