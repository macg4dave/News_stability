package httpserver_test

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
)

func TestLogoutFailureInvalidatesSessionAndDiscardsInflightRead(t *testing.T) {
	started, release := make(chan struct{}), make(chan struct{})
	var unblock sync.Once
	reader, client, csrf := loggedInReader(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/logout" {
			w.WriteHeader(http.StatusServiceUnavailable)
			return
		}
		if r.URL.Path != "/reader/feeds" {
			t.Errorf("unexpected upstream request %s", r.URL.Path)
			w.WriteHeader(404)
			return
		}
		close(started)
		<-release
		fmt.Fprint(w, `{"feeds":{"1":{"feed_title":"Discard this private response"}},"folders":[1]}`)
	})
	t.Cleanup(func() { unblock.Do(func() { close(release) }) })
	type readResult struct {
		status int
		leaked bool
		err    error
	}
	done := make(chan readResult, 1)
	go func() {
		response, err := client.Get(reader.URL + "/api/feeds")
		if err != nil {
			done <- readResult{err: err}
			return
		}
		defer response.Body.Close()
		body, err := io.ReadAll(response.Body)
		done <- readResult{status: response.StatusCode, leaked: strings.Contains(string(body), "Discard this private response"), err: err}
	}()
	<-started
	response := authRequest(t, client, reader.URL, "/api/logout", csrf, `{}`)
	var outcome struct {
		SignedOut bool `json:"signed_out"`
	}
	if json.NewDecoder(response.Body).Decode(&outcome) != nil || response.StatusCode != 502 || !outcome.SignedOut {
		t.Error("upstream logout failure did not confirm local invalidation")
	}
	unblock.Do(func() { close(release) })
	result := <-done
	if result.err != nil || result.status != 401 || result.leaked {
		t.Fatalf("inflight response after logout: HTTP %d, leaked=%v, error=%v", result.status, result.leaked, result.err)
	}
	state, _ := readSession(t, client, reader.URL)
	if state.Authenticated {
		t.Fatal("logout failure retained local session")
	}
}

// All fixtures are invented; this server never contacts an installed NewsBlur.
func TestStoryExcerptAndPictureUseSanitizedPresentation(t *testing.T) {
	reader, client, _ := loggedInReader(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/reader/feed/1" {
			t.Errorf("unexpected upstream request %s", r.URL.Path)
			w.WriteHeader(http.StatusNotFound)
			return
		}
		fmt.Fprint(w, `{"stories":[{"story_hash":"1:excerpt","story_title":"Preview","story_timestamp":"1704067200","image_urls":["http://publisher.invalid/photo.jpg"],"secure_image_urls":{"http://publisher.invalid/photo.jpg":"https://images.invalid/signed.jpg"},"story_content":"<script>secret()</script><p>A <em>read</em>er &amp; friend.</p><img src='https://images.invalid/inline.jpg' alt='Coastal scene'>"}]}`)
	})
	response, err := client.Get(reader.URL + "/api/feeds/1/stories")
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	var result struct {
		Stories []struct {
			PublishedAt string `json:"published_at"`
			Excerpt     string `json:"excerpt"`
			Picture     string `json:"picture"`
			HTML        string `json:"html"`
		} `json:"stories"`
	}
	if err := json.NewDecoder(response.Body).Decode(&result); err != nil {
		t.Fatal(err)
	}
	if response.StatusCode != http.StatusOK || len(result.Stories) != 1 || result.Stories[0].Excerpt != "A reader & friend." {
		t.Fatalf("unexpected excerpt response: HTTP %d, %+v", response.StatusCode, result)
	}
	if result.Stories[0].PublishedAt != "2024-01-01T00:00:00Z" {
		t.Fatalf("publication instant missing from reader response: %+v", result.Stories[0])
	}
	if result.Stories[0].Picture != "https://images.invalid/signed.jpg" || !strings.Contains(result.Stories[0].HTML, `data-picture-src="https://images.invalid/inline.jpg"`) || strings.Contains(result.Stories[0].HTML, " src=") {
		t.Fatalf("picture contract was not sanitized: %+v", result.Stories[0])
	}
}

func loggedInReader(t *testing.T, handler http.HandlerFunc) (*httptest.Server, *http.Client, string) {
	t.Helper()
	upstream := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/":
			http.SetCookie(w, &http.Cookie{Name: "csrftoken", Value: "fixture-csrf", Secure: true, Path: "/"})
			fmt.Fprint(w, "synthetic landing")
		case "/api/login":
			http.SetCookie(w, &http.Cookie{Name: "newsblur_sessionid", Value: "fixture-session", Secure: true, Path: "/"})
			fmt.Fprint(w, `{"code":1}`)
		default:
			handler(w, r)
		}
	}))
	t.Cleanup(upstream.Close)
	reader, client := readerForUpstream(t, upstream, true)
	anonymous, _ := readSession(t, client, reader.URL)
	response := authRequest(t, client, reader.URL, "/api/login", anonymous.CSRF, `{"username":"fixture","password":"synthetic"}`)
	if response.StatusCode != http.StatusOK {
		t.Fatalf("fixture login HTTP %d", response.StatusCode)
	}
	var session sessionResponse
	if err := json.NewDecoder(response.Body).Decode(&session); err != nil {
		t.Fatal(err)
	}
	return reader, client, session.CSRF
}

func TestStoryActionsForwardOnlyAllowedWrites(t *testing.T) {
	var calls atomic.Int32
	var expectedPath string
	reader, client, csrf := loggedInReader(t, func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		if r.URL.Path != expectedPath || r.Method != http.MethodPost {
			t.Errorf("unexpected upstream action %s %s", r.Method, r.URL.Path)
		}
		if r.Header.Get("X-CSRFToken") != "fixture-csrf" {
			t.Error("upstream CSRF missing")
		}
		if err := r.ParseForm(); err != nil || r.Form.Get("story_hash") != "1:abc123" {
			t.Error("incorrect action form")
		}
		fmt.Fprint(w, `{"code":1}`)
	})
	for _, tc := range []struct{ action, path string }{
		{"read", "/reader/mark_story_hashes_as_read"}, {"unread", "/reader/mark_story_hash_as_unread"},
	} {
		expectedPath = tc.path
		response := authRequest(t, client, reader.URL, "/api/stories/1:abc123/state", csrf, `{"action":"`+tc.action+`"}`)
		if response.StatusCode != http.StatusOK {
			t.Fatalf("%s HTTP %d", tc.action, response.StatusCode)
		}
		io.Copy(io.Discard, response.Body)
	}
	if calls.Load() != 2 {
		t.Fatal("write retried or missing")
	}
	for _, tc := range []struct {
		path, token, body string
		status            int
	}{
		{"/api/stories/1:abc123/state", "wrong", `{"action":"read"}`, 403},
		{"/api/stories/1:abc123/state", csrf, `{"action":"delete"}`, 400},
		{"/api/stories/1:abc123/state", csrf, `{"action":"save"}`, 400},
		{"/api/stories/1:abc123/state", csrf, `{"action":"unsave"}`, 400},
		{"/api/stories/not-a-hash/state", csrf, `{"action":"read"}`, 400},
		{"/api/stories/1:abc123/state", csrf, `{"action":"read","url":"https://other.invalid"}`, 400},
		{"/api/stories/1:abc123/state", csrf, `{"action":"read"} {}`, 400},
	} {
		response := authRequest(t, client, reader.URL, tc.path, tc.token, tc.body)
		if response.StatusCode != tc.status {
			t.Errorf("invalid action HTTP %d, want %d", response.StatusCode, tc.status)
		}
	}
	if calls.Load() != 2 {
		t.Fatal("invalid input reached upstream")
	}
}

func TestStoryWriteFailureIsNotRetried(t *testing.T) {
	for _, tc := range []struct {
		name, body       string
		upstream, reader int
	}{
		{"rejected", `{"code":-1,"message":"private upstream text"}`, 200, 409},
		{"unavailable", `private upstream text`, 503, 502},
		{"expired", `private upstream text`, 403, 401},
		{"malformed", `{}`, 200, 502},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var calls atomic.Int32
			reader, client, csrf := loggedInReader(t, func(w http.ResponseWriter, r *http.Request) {
				calls.Add(1)
				w.WriteHeader(tc.upstream)
				fmt.Fprint(w, tc.body)
			})
			response := authRequest(t, client, reader.URL, "/api/stories/1:abc/state", csrf, `{"action":"unread"}`)
			body, _ := io.ReadAll(response.Body)
			if response.StatusCode != tc.reader || calls.Load() != 1 || strings.Contains(string(body), "private upstream text") {
				t.Fatalf("failure handling HTTP %d, calls %d", response.StatusCode, calls.Load())
			}
			if tc.name == "expired" {
				state, _ := readSession(t, client, reader.URL)
				if state.Authenticated {
					t.Fatal("expired session retained")
				}
			}
		})
	}
}

func TestReadingPaginationSanitizationAndFilters(t *testing.T) {
	reader, client, _ := loggedInReader(t, func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/reader/feed/1":
			if r.URL.Query().Get("page") == "2" {
				fmt.Fprint(w, `{"stories":[],"hidden_stories_count":2}`)
				return
			}
			if r.URL.Query().Get("read_filter") != "unread" || r.URL.Query().Has("query") {
				t.Error("unexpected reading parameters")
			}
			fmt.Fprint(w, `{"stories":[{"story_hash":"1:abc","story_title":"Synthetic","story_content":"<p>Readable</p><script>unsafe()</script><img src='https://tracker.invalid'>","story_permalink":"javascript:bad","read_status":0}]}`)
		default:
			t.Errorf("unexpected read %s", r.URL.Path)
			w.WriteHeader(404)
		}
	})
	for _, tc := range []struct {
		path  string
		more  bool
		count int
	}{
		{"/api/feeds/1/stories?read_filter=unread", true, 1},
		{"/api/feeds/1/stories?page=2", true, 0},
	} {
		response, err := client.Get(reader.URL + tc.path)
		if err != nil {
			t.Fatal(err)
		}
		var result struct {
			Stories     []struct{ HTML, URL string }
			CanContinue bool `json:"can_continue"`
		}
		err = json.NewDecoder(response.Body).Decode(&result)
		response.Body.Close()
		if err != nil || response.StatusCode != 200 || result.CanContinue != tc.more || len(result.Stories) != tc.count {
			t.Fatalf("invalid reading response HTTP %d", response.StatusCode)
		}
		for _, story := range result.Stories {
			if story.URL != "" || strings.Contains(story.HTML, "script") || strings.Contains(story.HTML, " src=") {
				t.Fatal("unsafe story reached reader")
			}
		}
	}
}

func TestBriefingStatesAndLinkedStoryIdentity(t *testing.T) {
	var body string
	var status = 200
	reader, client, _ := loggedInReader(t, func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(status); fmt.Fprint(w, body) })
	for _, tc := range []struct {
		body, state string
		status      int
	}{
		{`{"enabled":true,"briefings":[]}`, "empty", 200},
		{`{"enabled":false,"briefings":[]}`, "disabled", 200},
		{``, "unsupported", 404},
		{`{"enabled":true,"briefings":[{"summary_story":{"story_hash":"1:summary","story_content":"<script>bad()</script><p>Summary</p>"},"curated_stories":[{"story_hash":"1:source","story_title":"Source"}]}]}`, "ready", 200},
	} {
		body, status = tc.body, tc.status
		response, err := client.Get(reader.URL + "/api/briefing")
		if err != nil {
			t.Fatal(err)
		}
		var result struct {
			State   string
			Stories []struct {
				HTML    string
				Related []struct{ Hash string }
			}
		}
		err = json.NewDecoder(response.Body).Decode(&result)
		response.Body.Close()
		if err != nil || response.StatusCode != 200 || result.State != tc.state {
			t.Fatalf("briefing state %q, want %q", result.State, tc.state)
		}
		if tc.state == "ready" && (len(result.Stories) != 2 || len(result.Stories[0].Related) != 1 || strings.Contains(result.Stories[0].HTML, "script")) {
			t.Fatal("invalid briefing presentation")
		}
	}
	status, body = 200, `{"stories":[{"story_hash":"1:other"}]}`
	response, err := client.Get(reader.URL + "/api/stories/1:requested")
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	if response.StatusCode != 404 {
		t.Fatal("linked story identity mismatch accepted")
	}
}
