package newsblur

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
)

// Story contains source data for the reader adapter. Content is deliberately
// excluded from JSON: only the HTTP presentation layer may emit sanitized HTML.
type Story struct {
	Hash    string `json:"story_hash"`
	Title   string `json:"story_title"`
	Author  string `json:"story_authors"`
	Date    string `json:"story_date"`
	URL     string `json:"story_permalink"`
	Content string `json:"-"`
	Read    bool   `json:"read"`
	Saved   bool   `json:"starred"`
}

// StoryPage retains pagination position and upstream hidden-story information.
type StoryPage struct {
	Stories []Story
	Page    int
	Hidden  int
}

// Stories loads a single feed without changing read state. Hidden stories can
// occupy an empty page; callers must not infer the end solely from an empty list.
func (c *Client) Stories(ctx context.Context, feedID, page int) (StoryPage, error) {
	if feedID < 1 || page < 1 || page > 10000 {
		return StoryPage{}, ErrInvalidResponse
	}
	body, err := c.request(ctx, http.MethodGet, "/reader/feed/"+strconv.Itoa(feedID)+"?page="+strconv.Itoa(page)+"&order=newest&read_filter=all", nil)
	if err != nil {
		return StoryPage{}, sessionError(err)
	}
	var result struct {
		Authenticated *bool `json:"authenticated"`
		Code          *int  `json:"code"`
		Hidden        int   `json:"hidden_stories_count"`
		Stories       []struct {
			Hash    string `json:"story_hash"`
			Title   string `json:"story_title"`
			Author  string `json:"story_authors"`
			Date    string `json:"story_date"`
			URL     string `json:"story_permalink"`
			Content string `json:"story_content"`
			Read    int    `json:"read_status"`
			Saved   bool   `json:"starred"`
		} `json:"stories"`
	}
	if json.Unmarshal(body, &result) != nil {
		return StoryPage{}, ErrInvalidResponse
	}
	if result.Authenticated != nil && !*result.Authenticated {
		return StoryPage{}, ErrSessionExpired
	}
	if result.Code != nil && *result.Code < 0 {
		return StoryPage{}, ErrRejected
	}
	if result.Stories == nil || result.Hidden < 0 {
		return StoryPage{}, ErrInvalidResponse
	}
	output := StoryPage{Stories: make([]Story, 0, len(result.Stories)), Page: page, Hidden: result.Hidden}
	for _, s := range result.Stories {
		if s.Hash == "" {
			return StoryPage{}, ErrInvalidResponse
		}
		output.Stories = append(output.Stories, Story{Hash: s.Hash, Title: s.Title, Author: s.Author, Date: s.Date, URL: s.URL, Content: s.Content, Read: s.Read == 1, Saved: s.Saved})
	}
	return output, nil
}
