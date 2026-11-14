package newsblur

import (
	"context"
	"net/http"
	"strconv"
	"strings"
)

// River reads a subscription collection. POST is NewsBlur's read-only river
// variant for feed lists too long for a URL; it does not alter reading state.
func (c *Client) River(ctx context.Context, ids []int, page int, filter string) (StoryPage, error) {
	if page < 1 || page > 400 || !ValidReadFilter(filter) {
		return StoryPage{}, ErrInvalidResponse
	}
	if len(ids) == 0 {
		return StoryPage{Stories: []Story{}, Page: page}, nil
	}
	values := readingValues(page, filter)
	for _, id := range ids {
		if id < 1 {
			return StoryPage{}, ErrInvalidResponse
		}
		values.Add("feeds", strconv.Itoa(id))
	}
	encoded := values.Encode()
	if len(encoded) > maxFormBytes {
		return StoryPage{}, ErrRequestTooLarge
	}
	body, err := c.request(ctx, http.MethodPost, "/reader/river_stories", strings.NewReader(encoded))
	if err != nil {
		return StoryPage{}, sessionError(err)
	}
	return focusedPage(body, page, filter)
}
