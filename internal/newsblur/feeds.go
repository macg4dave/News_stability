package newsblur

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"sort"
	"strconv"
)

// ErrSessionExpired means the upstream no longer recognizes the cookie session.
var ErrSessionExpired = errors.New("NewsBlur session expired")

// Feed is the reader's navigation contract, independent of upstream field names.
type Feed struct {
	ID       int    `json:"id"`
	Title    string `json:"title"`
	Positive int    `json:"positive"`
	Neutral  int    `json:"neutral"`
	Negative int    `json:"negative"`
}

// Folder preserves NewsBlur's ordering and nesting without copying story data.
type Folder struct {
	Title    string   `json:"title,omitempty"`
	FeedID   int      `json:"feed_id,omitempty"`
	Children []Folder `json:"children,omitempty"`
}

// Navigation contains subscriptions and their folder tree.
type Navigation struct {
	Feeds   []Feed   `json:"feeds"`
	Folders []Folder `json:"folders"`
}

// Feeds loads navigation from the candidate installed-server API. It requests no
// forced count recalculation and never changes subscriptions or reading state.
func (c *Client) Feeds(ctx context.Context) (Navigation, error) {
	body, err := c.request(ctx, http.MethodGet, "/reader/feeds?include_favicons=false", nil)
	if err != nil {
		return Navigation{}, sessionError(err)
	}
	var result struct {
		Authenticated *bool `json:"authenticated"`
		Code          *int  `json:"code"`
		Feeds         map[string]struct {
			Title    string `json:"feed_title"`
			Positive int    `json:"ps"`
			Neutral  int    `json:"nt"`
			Negative int    `json:"ng"`
		} `json:"feeds"`
		Folders []json.RawMessage `json:"folders"`
	}
	if json.Unmarshal(body, &result) != nil {
		return Navigation{}, ErrInvalidResponse
	}
	if result.Authenticated != nil && !*result.Authenticated {
		return Navigation{}, ErrSessionExpired
	}
	if result.Code != nil && *result.Code < 0 {
		return Navigation{}, ErrRejected
	}
	if result.Feeds == nil || result.Folders == nil {
		return Navigation{}, ErrInvalidResponse
	}
	nav := Navigation{Feeds: make([]Feed, 0, len(result.Feeds)), Folders: []Folder{}}
	for key, upstream := range result.Feeds {
		id, err := strconv.Atoi(key)
		if err != nil || id < 1 || upstream.Positive < 0 || upstream.Neutral < 0 || upstream.Negative < 0 {
			return Navigation{}, ErrInvalidResponse
		}
		nav.Feeds = append(nav.Feeds, Feed{ID: id, Title: upstream.Title, Positive: upstream.Positive, Neutral: upstream.Neutral, Negative: upstream.Negative})
	}
	sort.Slice(nav.Feeds, func(i, j int) bool {
		if nav.Feeds[i].Title == nav.Feeds[j].Title {
			return nav.Feeds[i].ID < nav.Feeds[j].ID
		}
		return nav.Feeds[i].Title < nav.Feeds[j].Title
	})
	nav.Folders, err = decodeFolders(result.Folders, 0)
	return nav, err
}

func sessionError(err error) error {
	var status *StatusError
	if errors.As(err, &status) && (status.StatusCode == 401 || status.StatusCode == 403 || status.StatusCode == 302) {
		return ErrSessionExpired
	}
	return err
}

func decodeFolders(values []json.RawMessage, depth int) ([]Folder, error) {
	if depth > 32 {
		return nil, ErrInvalidResponse
	}
	folders := make([]Folder, 0, len(values))
	for _, value := range values {
		var id int
		if json.Unmarshal(value, &id) == nil && id > 0 {
			folders = append(folders, Folder{FeedID: id})
			continue
		}
		var group map[string][]json.RawMessage
		if json.Unmarshal(value, &group) != nil || len(group) != 1 {
			return nil, ErrInvalidResponse
		}
		for title, children := range group {
			nested, err := decodeFolders(children, depth+1)
			if err != nil {
				return nil, err
			}
			folders = append(folders, Folder{Title: title, Children: nested})
		}
	}
	return folders, nil
}
