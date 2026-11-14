package newsblur

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"sort"
	"strconv"
	"strings"
)

// ErrSessionExpired means the upstream no longer recognizes the cookie session.
var ErrSessionExpired = errors.New("NewsBlur session expired")

// Feed is the reader's navigation contract, independent of upstream field names.
type Feed struct {
	ID       int    `json:"id"`
	Title    string `json:"title"`
	Icon     string `json:"icon,omitempty"`
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
	body, err := c.request(ctx, http.MethodGet, "/reader/feeds?include_favicons=true", nil)
	if err != nil {
		return Navigation{}, sessionError(err)
	}
	var result struct {
		Authenticated *bool `json:"authenticated"`
		Code          *int  `json:"code"`
		Feeds         map[string]struct {
			Title    string `json:"feed_title"`
			Favicon  string `json:"favicon"`
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
		nav.Feeds = append(nav.Feeds, Feed{ID: id, Title: upstream.Title, Icon: feedIcon(upstream.Favicon), Positive: upstream.Positive, Neutral: upstream.Neutral, Negative: upstream.Negative})
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

// NewsBlur supplies base64-encoded PNG favicons. Keep arbitrary URLs and active
// formats out of navigation; unavailable icons do not prevent feed reading.
func feedIcon(value string) string {
	if len(value) > 128*1024 {
		return ""
	}
	raw, err := base64.StdEncoding.DecodeString(value)
	if err != nil || http.DetectContentType(raw) != "image/png" {
		return ""
	}
	return "data:image/png;base64," + base64.StdEncoding.EncodeToString(raw)
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

// CollectionFeedIDs resolves all subscriptions or a folder index path against
// this navigation snapshot. Repeated feeds and stale unsubscribed IDs are omitted.
func (nav Navigation) CollectionFeedIDs(path, title string) ([]int, error) {
	ids := make([]int, 0, len(nav.Feeds))
	if path == "" {
		for _, feed := range nav.Feeds {
			ids = append(ids, feed.ID)
		}
		return ids, nil
	}
	nodes := nav.Folders
	var chosen Folder
	parts := strings.Split(path, "/")
	if len(parts) > 32 {
		return nil, ErrInvalidResponse
	}
	for _, part := range parts {
		index, err := strconv.Atoi(part)
		if err != nil || index < 0 || index >= len(nodes) || nodes[index].FeedID != 0 {
			return nil, ErrInvalidResponse
		}
		chosen = nodes[index]
		nodes = chosen.Children
	}
	if chosen.Title != title {
		return nil, ErrInvalidResponse
	}
	allowed := make(map[int]bool, len(nav.Feeds))
	for _, feed := range nav.Feeds {
		allowed[feed.ID] = true
	}
	var collect func([]Folder)
	collect = func(nodes []Folder) {
		for _, node := range nodes {
			if node.FeedID != 0 && allowed[node.FeedID] {
				ids = append(ids, node.FeedID)
				delete(allowed, node.FeedID)
			}
			collect(node.Children)
		}
	}
	collect(chosen.Children)
	return ids, nil
}
