package httpserver

import (
	"errors"
	"net/http"
	"strconv"

	"newsstability/internal/article"
	"newsstability/internal/newsblur"
	"newsstability/internal/session"
)

func (a *Auth) readingSession(w http.ResponseWriter, r *http.Request) (session.Entry, bool) {
	if !a.sameOrigin(r, false) {
		apiError(w, http.StatusForbidden, "origin_rejected", "Open the reader from its configured address.")
		return session.Entry{}, false
	}
	e, ok := a.current(r)
	if !ok || e.Client == nil {
		a.clearCookie(w)
		apiError(w, http.StatusUnauthorized, "session_expired", "Sign in to continue reading.")
		return session.Entry{}, false
	}
	return e, true
}

func (a *Auth) readingFailure(w http.ResponseWriter, e session.Entry, err error, message string) {
	if errors.Is(err, newsblur.ErrSessionExpired) {
		a.store.Delete(e.ID)
		a.clearCookie(w)
		apiError(w, http.StatusUnauthorized, "session_expired", "Your NewsBlur session expired. Sign in again.")
		return
	}
	if errors.Is(err, newsblur.ErrFocusUnavailable) {
		apiError(w, http.StatusBadGateway, "focus_unavailable", "This NewsBlur server did not provide intelligence scores. Choose All or Unread to continue.")
		return
	}
	if errors.Is(err, newsblur.ErrStoryNotFound) {
		apiError(w, http.StatusNotFound, "story_unavailable", "This linked story is no longer available.")
		return
	}
	apiError(w, http.StatusBadGateway, "upstream_unavailable", message)
}

func (a *Auth) feeds(w http.ResponseWriter, r *http.Request) {
	e, ok := a.readingSession(w, r)
	if !ok {
		return
	}

	nav, err := e.Client.Feeds(r.Context())
	if err != nil {
		a.readingFailure(w, e, err, "Could not refresh feeds. Your current view has been kept.")
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
	e, ok := a.readingSession(w, r)
	if !ok {
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
	filter := r.URL.Query().Get("read_filter")
	if filter == "" {
		filter = "all"
	}
	if !newsblur.ValidReadFilter(filter) || r.URL.Query().Has("query") {
		apiError(w, http.StatusBadRequest, "invalid_request", "Choose all, unread, or Focus stories.")
		return
	}
	result, err := e.Client.Stories(r.Context(), id, page, filter)
	if err != nil {
		a.readingFailure(w, e, err, "Could not load stories. Your current view has been kept.")
		return
	}
	if _, ok := a.store.Get(e.ID); !ok {
		apiError(w, http.StatusUnauthorized, "session_expired", "Your session expired. Sign in again.")
		return
	}
	items := a.presentStories(result.Stories, e.Client)
	writeJSON(w, http.StatusOK, struct {
		Stories     []readerStory `json:"stories"`
		Page        int           `json:"page"`
		CanContinue bool          `json:"can_continue"`
	}{items, result.Page, result.Page < 10000 && (len(items) > 0 || result.Hidden > 0)})
}

// readerStory is the sole presentation contract for feed, briefing, and linked
// story reads; raw upstream HTML cannot bypass the common sanitizer.
type readerStory struct {
	Hash           string                  `json:"hash"`
	Title          string                  `json:"title"`
	Author         string                  `json:"author"`
	Date           string                  `json:"date"`
	PublishedAt    string                  `json:"published_at,omitempty"`
	URL            string                  `json:"url,omitempty"`
	HTML           string                  `json:"html"`
	Excerpt        string                  `json:"excerpt"`
	Picture        string                  `json:"picture,omitempty"`
	Pictures       []string                `json:"pictures,omitempty"`
	Thumbnail      string                  `json:"thumbnail,omitempty"`
	Read           bool                    `json:"read"`
	Tags           []string                `json:"tags"`
	Score          int                     `json:"score"`
	ReadingMinutes int                     `json:"reading_minutes"`
	FeedID         int                     `json:"feed_id,omitempty"`
	FeedTitle      string                  `json:"feed_title,omitempty"`
	Kind           string                  `json:"kind,omitempty"`
	Related        []newsblur.RelatedStory `json:"related"`
	Links          []string                `json:"links"`
}

func (a *Auth) presentStories(stories []newsblur.Story, client *newsblur.Client) []readerStory {
	result := make([]readerStory, 0, len(stories))
	for _, s := range stories {
		sources := make(map[string]string, len(s.PictureSources))
		for original, replacement := range s.PictureSources {
			sources[original] = imageURL(client, replacement)
		}
		safeHTML := a.article.HTMLWithPictureBase(s.Content, sources, s.URL)
		candidates := make([]string, 0, len(s.Pictures))
		thumbnail := ""
		for _, value := range s.Pictures {
			candidates = append(candidates, imageURL(client, value))
			if thumbnail == "" {
				thumbnail = article.PictureURL(imageURL(client, s.Thumbnails[value]))
			}
		}
		pictures := article.PictureCandidates(candidates, safeHTML)
		related := s.Related
		if related == nil {
			related = []newsblur.RelatedStory{}
		}
		result = append(result, readerStory{Hash: s.Hash, Title: s.Title, Author: s.Author, Date: s.Date, PublishedAt: s.PublishedAt, URL: article.SafeURL(s.URL), HTML: safeHTML, Excerpt: article.Excerpt(safeHTML), Picture: article.FirstPicture(candidates, safeHTML), Pictures: pictures, Thumbnail: thumbnail, Read: s.Read, Tags: s.Tags, Score: s.Score, ReadingMinutes: article.ReadingMinutes(safeHTML), FeedID: s.FeedID, FeedTitle: s.FeedTitle, Kind: s.Kind, Related: related, Links: article.Links(safeHTML)})
	}
	return result
}
