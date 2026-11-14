package httpserver_test

import (
	"fmt"
	"net/http"
	"sync/atomic"
	"testing"
)

func TestFeedbackTrainsOnlyVerifiedStoryFields(t *testing.T) {
	var writes atomic.Int32
	var expected string
	reader, client, csrf := loggedInReader(t, func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/reader/river_stories":
			fmt.Fprint(w, `{"stories":[{"story_hash":"1:abc","story_title":"Headline","story_authors":"Writer","story_tags":["Science"]}]}`)
		case "/classifier/save":
			writes.Add(1)
			if err := r.ParseForm(); err != nil {
				t.Error(err)
			}
			if r.Method != "POST" || r.Form.Get("feed_id") != "1" || r.Form.Get(expected) == "" || r.Header.Get("X-CSRFToken") != "fixture-csrf" || r.Form.Has("like_feed") || r.Form.Has("dislike_feed") {
				t.Error("incorrect classifier mutation")
			}
			fmt.Fprint(w, `{"code":0}`)
		default:
			t.Errorf("unexpected request %s", r.URL.Path)
			w.WriteHeader(404)
		}
	})
	for _, tc := range []struct{ body, field string }{
		{`{"action":"like","target":"title","value":"Headline"}`, "like_title"},
		{`{"action":"dislike","target":"author","value":"Writer"}`, "dislike_author"},
		{`{"action":"like","target":"tag","value":"Science"}`, "like_tag"},
		{`{"action":"clear","target":"tag","value":"Science"}`, "remove_dislike_tag"},
	} {
		expected = tc.field
		response := authRequest(t, client, reader.URL, "/api/stories/1:abc/feedback", csrf, tc.body)
		response.Body.Close()
		if response.StatusCode != 200 {
			t.Fatalf("feedback HTTP %d", response.StatusCode)
		}
	}
	if writes.Load() != 4 {
		t.Fatal("missing or retried classifier write")
	}
	for _, tc := range []struct {
		body, token string
		status      int
	}{
		{`{"action":"like","target":"title","value":"Headline"}`, "wrong", 403},
		{`{"action":"like","target":"feed","value":"1"}`, csrf, 400},
		{`{"action":"like","target":"tag","value":"Unrelated"}`, csrf, 400},
		{`{"action":"like","target":"author","value":"Other writer"}`, csrf, 400},
		{`{"action":"save","target":"title","value":"Headline"}`, csrf, 400},
		{`{"action":"like","target":"title","value":"Headline","url":"https://other.invalid"}`, csrf, 400},
	} {
		response := authRequest(t, client, reader.URL, "/api/stories/1:abc/feedback", tc.token, tc.body)
		response.Body.Close()
		if response.StatusCode != tc.status {
			t.Errorf("invalid feedback HTTP %d, want %d", response.StatusCode, tc.status)
		}
	}
	if writes.Load() != 4 {
		t.Fatal("rejected feedback issued a write")
	}
}

func TestFeedbackFailureIsNotRetriedOrReportedAsSuccess(t *testing.T) {
	for _, tc := range []struct {
		name, body       string
		upstream, status int
	}{
		{"rejected", `{"code":-1}`, 200, 409}, {"malformed", `{}`, 200, 502}, {"wrong success code", `{"code":1}`, 200, 409}, {"unavailable", `private upstream text`, 503, 502}, {"expired", ``, 403, 401},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var writes atomic.Int32
			reader, client, csrf := loggedInReader(t, func(w http.ResponseWriter, r *http.Request) {
				if r.URL.Path == "/reader/river_stories" {
					fmt.Fprint(w, `{"stories":[{"story_hash":"1:abc","story_title":"Headline"}]}`)
					return
				}
				if r.URL.Path != "/classifier/save" {
					t.Errorf("unexpected request %s", r.URL.Path)
				}
				writes.Add(1)
				w.WriteHeader(tc.upstream)
				fmt.Fprint(w, tc.body)
			})
			response := authRequest(t, client, reader.URL, "/api/stories/1:abc/feedback", csrf, `{"action":"like","target":"title","value":"Headline"}`)
			response.Body.Close()
			if response.StatusCode != tc.status || writes.Load() != 1 {
				t.Fatalf("feedback failure status %d, writes %d", response.StatusCode, writes.Load())
			}
		})
	}
}
