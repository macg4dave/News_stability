package httpserver

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"newsstability/internal/newsblur"
)

func (a *Auth) storyState(w http.ResponseWriter, r *http.Request) {
	e, ok := a.mutation(w, r)
	if !ok {
		return
	}
	if e.Client == nil {
		apiError(w, http.StatusUnauthorized, "session_expired", "Sign in to change a story.")
		return
	}
	if r.Header.Get("Content-Type") != "application/json" {
		apiError(w, http.StatusUnsupportedMediaType, "invalid_request", "Send the story action as JSON.")
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 1024)
	var input struct {
		Action string `json:"action"`
	}
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	hash := r.PathValue("hash")
	if decoder.Decode(&input) != nil || decoder.Decode(&struct{}{}) != io.EOF || !newsblur.ValidStoryHash(hash) ||
		(input.Action != "read" && input.Action != "unread") {
		apiError(w, http.StatusBadRequest, "invalid_request", "Choose a valid story action.")
		return
	}
	if err := e.Client.SetStoryState(r.Context(), hash, input.Action); err != nil {
		if errors.Is(err, newsblur.ErrRejected) {
			apiError(w, http.StatusConflict, "action_rejected", "NewsBlur could not apply that action. The story may be unavailable or too old to mark unread.")
			return
		}
		a.readingFailure(w, e, err, "Could not confirm the change with NewsBlur. Refresh to check the story's state before trying again.")
		return
	}
	if _, ok := a.store.Get(e.ID); !ok {
		apiError(w, http.StatusUnauthorized, "session_expired", "Your session expired. Sign in again.")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"hash": hash, "action": input.Action})
}
