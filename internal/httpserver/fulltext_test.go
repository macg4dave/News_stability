package httpserver_test

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"testing"
)

func TestFullTextIsAuthenticatedSanitizedAndBoundedToStory(t *testing.T) {
	reader, client, _ := loggedInReader(t, func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "GET" || r.URL.Path != "/rss_feeds/original_text" || r.URL.Query().Get("story_hash") != "1:abc" {
			t.Error("unexpected upstream request")
			w.WriteHeader(http.StatusNotFound)
			return
		}
		fmt.Fprint(w, `{"story_hash":"1:abc","original_text":"<h2>Full article</h2><p>Complete content beyond the feed preview.</p><script>bad()</script><img src='https://images.invalid/photo.jpg' onerror='bad()'>","failed":false}`)
	})
	response, err := client.Get(reader.URL + "/api/stories/1:abc/text")
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	var result struct {
		Hash, HTML     string
		ReadingMinutes int `json:"reading_minutes"`
	}
	if err := json.NewDecoder(response.Body).Decode(&result); err != nil {
		t.Fatal(err)
	}
	if response.StatusCode != 200 || result.Hash != "1:abc" || !strings.Contains(result.HTML, "Complete content") || result.ReadingMinutes < 1 || strings.Contains(result.HTML, "script") || strings.Contains(result.HTML, "onerror") || strings.Contains(result.HTML, " src=") {
		t.Fatalf("invalid presentation: %+v", result)
	}
	if response.Header.Get("Cache-Control") != "no-store" {
		t.Fatal("full text may be cached")
	}
	for _, path := range []string{"/api/stories/invalid/text", "/api/stories/1:abc/text?url=https://other.invalid"} {
		// A browser URL parameter never controls the upstream destination. The
		// valid hash still takes the same fixed request path and query above.
		res, err := client.Get(reader.URL + path)
		if err != nil {
			t.Fatal(err)
		}
		res.Body.Close()
		if path == "/api/stories/invalid/text" && res.StatusCode != 400 {
			t.Fatal("invalid hash was accepted")
		}
	}
	res, err := http.Get(reader.URL + "/api/stories/1:abc/text")
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if res.StatusCode != 401 {
		t.Fatal("anonymous full text was accepted")
	}
}
