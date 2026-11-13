package newsblur

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"strings"
)

// ErrFullTextUnavailable means NewsBlur could not extract this story's text.
var ErrFullTextUnavailable = errors.New("NewsBlur full text unavailable")

// FullText requests NewsBlur's existing text extraction by story hash. It never
// accepts a publisher URL, forces a refetch, or changes reading state.
func (c *Client) FullText(ctx context.Context, hash string) (Story, error) {
	if !ValidStoryHash(hash) {
		return Story{}, ErrInvalidResponse
	}
	body, err := c.request(ctx, http.MethodGet, "/rss_feeds/original_text?"+url.Values{"story_hash": {hash}}.Encode(), nil)
	if err != nil {
		var status *StatusError
		if errors.As(err, &status) && (status.StatusCode == 404 || status.StatusCode == 405) {
			return Story{}, ErrFullTextUnavailable
		}
		return Story{}, sessionError(err)
	}
	var result struct {
		Hash          string `json:"story_hash"`
		Text          string `json:"original_text"`
		Failed        *bool  `json:"failed"`
		Code          *int   `json:"code"`
		Authenticated *bool  `json:"authenticated"`
	}
	if json.Unmarshal(body, &result) != nil {
		return Story{}, ErrInvalidResponse
	}
	if result.Authenticated != nil && !*result.Authenticated {
		return Story{}, ErrSessionExpired
	}
	if (result.Code != nil && *result.Code < 0) || (result.Failed != nil && *result.Failed) {
		return Story{}, ErrFullTextUnavailable
	}
	if result.Hash != hash || result.Failed == nil {
		return Story{}, ErrInvalidResponse
	}
	if strings.TrimSpace(result.Text) == "" {
		return Story{}, ErrFullTextUnavailable
	}
	// Decode image metadata through the same adapter used by feed story reads.
	var wire wireStory
	if json.Unmarshal(body, &wire) != nil {
		return Story{}, ErrInvalidResponse
	}
	story, err := wire.story()
	story.Content = result.Text
	return story, err
}
