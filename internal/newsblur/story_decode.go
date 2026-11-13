package newsblur

import (
	"encoding/json"
	"time"
)

// wireStory is shared by feed, individual-story, and briefing reads. Its raw
// HTML never leaves this package through JSON; presentation sanitizes Content.
type wireStory struct {
	Hash         string            `json:"story_hash"`
	Title        string            `json:"story_title"`
	Author       string            `json:"story_authors"`
	Date         string            `json:"story_date"`
	Timestamp    json.Number       `json:"story_timestamp"`
	URL          string            `json:"story_permalink"`
	Content      string            `json:"story_content"`
	ImageURLs    []string          `json:"image_urls"`
	SecureImages map[string]string `json:"secure_image_urls"`
	Thumbnails   map[string]string `json:"secure_image_thumbnails"`
	Read         int               `json:"read_status"`
	Saved        bool              `json:"starred"`
	FeedID       int               `json:"story_feed_id"`
	FeedTitle    string            `json:"feed_title"`
	Cluster      []struct {
		Hash      string `json:"story_hash"`
		Title     string `json:"story_title"`
		FeedTitle string `json:"feed_title"`
	} `json:"cluster_stories"`
}

func (s wireStory) story() (Story, error) {
	if s.Hash == "" {
		return Story{}, ErrInvalidResponse
	}
	related := make([]RelatedStory, 0)
	seen := map[string]bool{s.Hash: true}
	for _, item := range s.Cluster {
		if item.Hash == "" || seen[item.Hash] {
			continue
		}
		seen[item.Hash] = true
		related = append(related, RelatedStory{Hash: item.Hash, Title: item.Title, FeedTitle: item.FeedTitle})
		if len(related) == 50 {
			break
		}
	}
	pictures := make([]string, 0)
	for _, source := range s.ImageURLs {
		if secure := s.SecureImages[source]; secure != "" {
			pictures = append(pictures, secure)
		}
		pictures = append(pictures, source)
		if len(pictures) >= 24 {
			break
		}
	}
	// NewsBlur supplies epoch seconds as a string. Do not invent a timezone for
	// its separate, timezone-free story_date field when the timestamp is absent.
	publishedAt := ""
	if seconds, err := s.Timestamp.Float64(); err == nil && seconds > 0 && seconds < 253402300800 {
		publishedAt = time.Unix(int64(seconds), 0).UTC().Format(time.RFC3339)
	}
	return Story{Hash: s.Hash, Title: s.Title, Author: s.Author, Date: s.Date, PublishedAt: publishedAt, URL: s.URL, Content: s.Content, Pictures: pictures, PictureSources: s.SecureImages, Thumbnails: s.Thumbnails, Read: s.Read == 1, Saved: s.Saved, FeedID: s.FeedID, FeedTitle: s.FeedTitle, Related: related}, nil
}

func decodeStoryPage(body []byte, page int) (StoryPage, error) {
	var result struct {
		Authenticated *bool       `json:"authenticated"`
		Code          *int        `json:"code"`
		Hidden        int         `json:"hidden_stories_count"`
		Stories       []wireStory `json:"stories"`
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
	for _, value := range result.Stories {
		s, err := value.story()
		if err != nil {
			return StoryPage{}, err
		}
		output.Stories = append(output.Stories, s)
	}
	return output, nil
}
