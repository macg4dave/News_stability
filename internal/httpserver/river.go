package httpserver

import (
	"net/http"
	"strconv"

	"newsstability/internal/newsblur"
)

// A folder is addressed by its index path in the current upstream tree. Feed
// membership is resolved on the server, never trusted from browser-supplied IDs.
func (a *Auth) river(w http.ResponseWriter, r *http.Request) {
	e, ok := a.readingSession(w, r)
	if !ok {
		return
	}
	page := 1
	var err error
	if value := r.URL.Query().Get("page"); value != "" {
		page, err = strconv.Atoi(value)
	}
	filter := r.URL.Query().Get("read_filter")
	if filter == "" {
		filter = "all"
	}
	if err != nil || page < 1 || page > 400 || !newsblur.ValidReadFilter(filter) || r.URL.Query().Has("query") {
		apiError(w, 400, "invalid_request", "Choose a valid collection, reading mode, and page.")
		return
	}
	nav, err := e.Client.Feeds(r.Context())
	if err != nil {
		a.readingFailure(w, e, err, "Could not load your subscriptions.")
		return
	}
	ids, err := nav.CollectionFeedIDs(r.URL.Query().Get("folder"), r.URL.Query().Get("folder_title"))
	if err != nil {
		apiError(w, http.StatusBadRequest, "invalid_request", "That folder changed. Refresh your subscriptions.")
		return
	}
	result, err := e.Client.River(r.Context(), ids, page, filter)
	if err != nil {
		a.readingFailure(w, e, err, "Could not load this collection from NewsBlur. Your current view has been kept.")
		return
	}
	if _, ok := a.store.Get(e.ID); !ok {
		apiError(w, 401, "session_expired", "Your session expired. Sign in again.")
		return
	}
	// Resolve source names without requiring optional river response metadata.
	titles := make(map[int]string, len(nav.Feeds))
	for _, feed := range nav.Feeds {
		titles[feed.ID] = feed.Title
	}
	for i := range result.Stories {
		if result.Stories[i].FeedTitle == "" {
			result.Stories[i].FeedTitle = titles[result.Stories[i].FeedID]
		}
	}
	writeJSON(w, 200, struct {
		Stories      []readerStory `json:"stories"`
		Page         int           `json:"page"`
		Limited      bool          `json:"limited"`
		LimitReached bool          `json:"limit_reached"`
		CanContinue  bool          `json:"can_continue"`
	}{a.presentStories(result.Stories, e.Client), page, result.Limited, page == 400 && (len(result.Stories) > 0 || result.Hidden > 0), page < 400 && (len(result.Stories) > 0 || result.Hidden > 0)})
}
