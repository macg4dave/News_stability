package newsblur

import (
	"context"
	"encoding/json"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"unicode/utf8"
)

// Train sends one explicit feed-scoped classifier change. The caller must use
// a value belonging to the requested story; it cannot choose a publisher rule.
func (c *Client) Train(ctx context.Context, feedID int, target, value, action string) error {
	if feedID < 1 || (target != "title" && target != "author" && target != "tag") || strings.TrimSpace(value) == "" || utf8.RuneCountInString(value) > 255 {
		return ErrInvalidResponse
	}
	form := url.Values{"feed_id": {strconv.Itoa(feedID)}}
	switch action {
	case "like", "dislike":
		form.Set(action+"_"+target, value)
	case "clear":
		form.Set("remove_like_"+target, value)
		form.Set("remove_dislike_"+target, value)
	default:
		return ErrInvalidResponse
	}
	body, err := c.request(ctx, http.MethodPost, "/classifier/save", strings.NewReader(form.Encode()))
	if err != nil {
		return sessionError(err)
	}
	// This endpoint uses code 0 for success (reading-state writes use code 1).
	var result struct {
		Code          *int  `json:"code"`
		Authenticated *bool `json:"authenticated"`
	}
	if json.Unmarshal(body, &result) != nil {
		return ErrInvalidResponse
	}
	if result.Authenticated != nil && !*result.Authenticated {
		return ErrSessionExpired
	}
	if result.Code == nil {
		return ErrInvalidResponse
	}
	if *result.Code != 0 {
		return ErrRejected
	}
	return nil
}
