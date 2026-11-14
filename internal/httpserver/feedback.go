package httpserver

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"unicode/utf8"

	"newsstability/internal/newsblur"
)

func (a *Auth) feedback(w http.ResponseWriter, r *http.Request) {
	e, ok := a.mutation(w, r)
	if !ok {
		return
	}
	if e.Client == nil {
		apiError(w, 401, "session_expired", "Sign in to train NewsBlur.")
		return
	}
	if r.Header.Get("Content-Type") != "application/json" {
		apiError(w, 415, "invalid_request", "Send feedback as JSON.")
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 4096)
	var input struct {
		Action string `json:"action"`
		Target string `json:"target"`
		Value  string `json:"value"`
	}
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	hash := r.PathValue("hash")
	if decoder.Decode(&input) != nil || decoder.Decode(&struct{}{}) != io.EOF || !newsblur.ValidStoryHash(hash) ||
		(input.Action != "like" && input.Action != "dislike" && input.Action != "clear") ||
		(input.Target != "title" && input.Target != "author" && input.Target != "tag") || strings.TrimSpace(input.Value) == "" || utf8.RuneCountInString(input.Value) > 255 {
		apiError(w, 400, "invalid_request", "Choose a headline, author, or topic from this story.")
		return
	}
	story, err := e.Client.StoryByHash(r.Context(), hash)
	if err != nil {
		a.readingFailure(w, e, err, "Could not load this story for training.")
		return
	}
	matches := input.Target == "title" && input.Value == story.Title || input.Target == "author" && input.Value == story.Author || input.Target == "tag" && slices.Contains(story.Tags, input.Value)
	if !matches {
		apiError(w, 400, "invalid_request", "That training choice no longer belongs to this story. Refresh and try again.")
		return
	}
	feed, _, _ := strings.Cut(hash, ":")
	feedID, _ := strconv.Atoi(feed)
	if _, ok := a.store.Get(e.ID); !ok {
		apiError(w, 401, "session_expired", "Your session expired. Sign in again.")
		return
	}
	if err := e.Client.Train(r.Context(), feedID, input.Target, input.Value, input.Action); err != nil {
		if errors.Is(err, newsblur.ErrRejected) {
			apiError(w, 409, "feedback_rejected", "NewsBlur could not apply this training. Your feedback has not been confirmed.")
			return
		}
		a.readingFailure(w, e, err, "Could not confirm training with NewsBlur. Refresh before trying again.")
		return
	}
	if _, ok := a.store.Get(e.ID); !ok {
		apiError(w, 401, "session_expired", "Your session expired. Sign in again.")
		return
	}
	writeJSON(w, 200, map[string]string{"hash": hash, "action": input.Action, "target": input.Target, "value": input.Value})
}
