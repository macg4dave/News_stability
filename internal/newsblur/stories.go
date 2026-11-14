package newsblur

import (
	"context"
	"errors"
	"net/http"
	"net/url"
	"strconv"
)

// Story contains source data for the reader adapter. Content is deliberately
// excluded from JSON: only the HTTP presentation layer may emit sanitized HTML.
type Story struct {
	Hash           string            `json:"story_hash"`
	Title          string            `json:"story_title"`
	Author         string            `json:"story_authors"`
	Date           string            `json:"story_date"`
	PublishedAt    string            `json:"-"`
	URL            string            `json:"story_permalink"`
	Content        string            `json:"-"`
	Pictures       []string          `json:"-"`
	PictureSources map[string]string `json:"-"`
	Thumbnails     map[string]string `json:"-"`
	Read           bool              `json:"read"`
	Tags           []string          `json:"-"`
	Score          int               `json:"-"`
	Scored         bool              `json:"-"`
	FeedID         int               `json:"-"`
	FeedTitle      string            `json:"-"`
	Related        []RelatedStory    `json:"-"`
	Kind           string            `json:"-"`
}

// RelatedStory is a source story or cluster member identified by NewsBlur.
type RelatedStory struct {
	Hash      string `json:"hash"`
	Title     string `json:"title"`
	FeedTitle string `json:"feed_title,omitempty"`
}

// ErrStoryNotFound means NewsBlur did not return the requested story.
var ErrStoryNotFound = errors.New("NewsBlur story not found")

// StoryPage retains pagination position and upstream hidden-story information.
type StoryPage struct {
	Stories []Story
	Page    int
	Hidden  int
	Limited bool
}

// Stories reads a feed in NewsBlur order. Focus selects positive upstream scores.
func (c *Client) Stories(ctx context.Context, feedID, page int, filter string) (StoryPage, error) {
	if feedID < 1 || page < 1 || page > 10000 || !ValidReadFilter(filter) {
		return StoryPage{}, ErrInvalidResponse
	}
	values := readingValues(page, filter)
	body, err := c.request(ctx, http.MethodGet, "/reader/feed/"+strconv.Itoa(feedID)+"?"+values.Encode(), nil)
	if err != nil {
		return StoryPage{}, sessionError(err)
	}
	return focusedPage(body, page, filter)
}

// ValidReadFilter reports the three supported reading modes.
func ValidReadFilter(filter string) bool {
	return filter == "all" || filter == "unread" || filter == "focus"
}

func readingValues(page int, filter string) url.Values {
	read := filter
	if filter == "focus" {
		read = "unread"
	}
	return url.Values{"page": {strconv.Itoa(page)}, "order": {"newest"}, "read_filter": {read}}
}

// ErrFocusUnavailable means this server returned no usable intelligence scores.
var ErrFocusUnavailable = errors.New("NewsBlur intelligence unavailable")

func focusedPage(body []byte, page int, filter string) (StoryPage, error) {
	result, err := decodeStoryPage(body, page)
	if err != nil || filter != "focus" {
		return result, err
	}
	visible := make([]Story, 0, len(result.Stories))
	for _, story := range result.Stories {
		if !story.Scored {
			return StoryPage{}, ErrFocusUnavailable
		}
		if story.Score > 0 {
			visible = append(visible, story)
		} else {
			result.Hidden++
		}
	}
	result.Stories = visible
	return result, nil
}

// StoryByHash follows a NewsBlur-supplied reference through its documented
// river endpoint. The browser cannot choose an upstream URL or arbitrary path.
func (c *Client) StoryByHash(ctx context.Context, hash string) (Story, error) {
	if !ValidStoryHash(hash) {
		return Story{}, ErrStoryNotFound
	}
	body, err := c.request(ctx, http.MethodGet, "/reader/river_stories?h="+url.QueryEscape(hash), nil)
	if err != nil {
		return Story{}, sessionError(err)
	}
	result, err := decodeStoryPage(body, 1)
	if err != nil {
		return Story{}, err
	}
	for _, s := range result.Stories {
		if s.Hash == hash {
			return s, nil
		}
	}
	return Story{}, ErrStoryNotFound
}
