package newsblur

import (
	"context"
	"net/url"
	"strconv"
	"strings"
)

// ValidStoryHash accepts bounded NewsBlur feed/hash identifiers, never URLs.
func ValidStoryHash(hash string) bool {
	feed, digest, ok := strings.Cut(hash, ":")
	id, err := strconv.Atoi(feed)
	if !ok || err != nil || id < 1 || len(hash) > 256 || digest == "" {
		return false
	}
	for _, c := range digest {
		if !((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '-' || c == '_') {
			return false
		}
	}
	return true
}

// SetStoryState applies exactly one explicit reading action without retrying it.
// The fixed action list prevents browser input from selecting an upstream path.
func (c *Client) SetStoryState(ctx context.Context, hash, action string) error {
	if !ValidStoryHash(hash) {
		return ErrInvalidResponse
	}
	var path string
	switch action {
	case "read":
		path = "/reader/mark_story_hashes_as_read"
	case "unread":
		path = "/reader/mark_story_hash_as_unread"
	case "save":
		path = "/reader/mark_story_hash_as_starred"
	case "unsave":
		path = "/reader/mark_story_hash_as_unstarred"
	default:
		return ErrInvalidResponse
	}
	return sessionError(c.post(ctx, path, url.Values{"story_hash": {hash}}))
}
