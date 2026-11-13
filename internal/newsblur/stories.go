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
	Saved          bool              `json:"starred"`
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
}

// Stories delegates feed reading, unread filtering and search to NewsBlur without
// changing read state. Hidden stories may occupy an otherwise empty page.
func (c *Client) Stories(ctx context.Context, feedID, page int, filter, query string) (StoryPage, error) {
	if feedID < 1 || page < 1 || page > 10000 {
		return StoryPage{}, ErrInvalidResponse
	}
	if (filter != "all" && filter != "unread") || len(query) > 256 {
		return StoryPage{}, ErrInvalidResponse
	}
	values := url.Values{"page": {strconv.Itoa(page)}, "order": {"newest"}, "read_filter": {filter}}
	if query != "" {
		values.Set("query", query)
	}
	body, err := c.request(ctx, http.MethodGet, "/reader/feed/"+strconv.Itoa(feedID)+"?"+values.Encode(), nil)
	if err != nil {
		return StoryPage{}, sessionError(err)
	}
	return decodeStoryPage(body, page)
}

// SavedStories reads the user's existing saved stories, without changing tags.
func (c *Client) SavedStories(ctx context.Context, page int) (StoryPage, error) {
	if page < 1 || page > 10000 {
		return StoryPage{}, ErrInvalidResponse
	}
	body, err := c.request(ctx, http.MethodGet, "/reader/starred_stories?page="+strconv.Itoa(page), nil)
	if err != nil {
		return StoryPage{}, sessionError(err)
	}
	return decodeStoryPage(body, page)
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
