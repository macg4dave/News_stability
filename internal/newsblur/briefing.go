package newsblur

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
)

// BriefingPage presents only summaries and source stories returned by NewsBlur.
// No summary generation or preferences mutation is exposed by the reader.
type BriefingPage struct {
	Stories []Story
	State   string
	Preview bool
	HasNext bool
	Page    int
}

// Briefing reads the candidate /briefing/stories contract. HTTP 404/405 means
// unsupported; an empty enabled account is not presumed to be generating.
func (c *Client) Briefing(ctx context.Context, page int) (BriefingPage, error) {
	if page < 1 || page > 10000 {
		return BriefingPage{}, ErrInvalidResponse
	}
	body, err := c.request(ctx, http.MethodGet, "/briefing/stories?page="+strconv.Itoa(page)+"&limit=5", nil)
	if err != nil {
		var status *StatusError
		if errors.As(err, &status) && (status.StatusCode == 404 || status.StatusCode == 405) {
			return BriefingPage{Stories: []Story{}, State: "unsupported", Page: page}, nil
		}
		return BriefingPage{}, sessionError(err)
	}
	var response struct {
		Enabled       *bool `json:"enabled"`
		Authenticated *bool `json:"authenticated"`
		Code          *int  `json:"code"`
		Preview       bool  `json:"is_preview"`
		HasNext       bool  `json:"has_next_page"`
		Briefings     []struct {
			Summary *wireStory  `json:"summary_story"`
			Sources []wireStory `json:"curated_stories"`
		} `json:"briefings"`
	}
	if json.Unmarshal(body, &response) != nil {
		return BriefingPage{}, ErrInvalidResponse
	}
	if response.Authenticated != nil && !*response.Authenticated {
		return BriefingPage{}, ErrSessionExpired
	}
	if response.Code != nil && *response.Code < 0 {
		return BriefingPage{}, ErrRejected
	}
	if response.Enabled == nil || response.Briefings == nil {
		return BriefingPage{}, ErrInvalidResponse
	}
	result := BriefingPage{Stories: []Story{}, State: "empty", Preview: response.Preview, HasNext: response.HasNext && page < 10000, Page: page}
	if !*response.Enabled {
		result.State = "disabled"
	}
	for _, briefing := range response.Briefings {
		sources := make([]Story, 0, len(briefing.Sources))
		for _, value := range briefing.Sources {
			s, err := value.story()
			if err != nil {
				return BriefingPage{}, err
			}
			s.Kind = "source_story"
			sources = append(sources, s)
		}
		if briefing.Summary != nil {
			s, err := briefing.Summary.story()
			if err != nil {
				return BriefingPage{}, err
			}
			s.Kind = "briefing_summary"
			s.FeedTitle = "NewsBlur Daily Briefing"
			s.Related = []RelatedStory{}
			for _, source := range sources {
				s.Related = append(s.Related, RelatedStory{Hash: source.Hash, Title: source.Title, FeedTitle: source.FeedTitle})
			}
			result.Stories = append(result.Stories, s)
		}
		result.Stories = append(result.Stories, sources...)
	}
	if len(result.Stories) > 0 {
		result.State = "ready"
	}
	return result, nil
}
