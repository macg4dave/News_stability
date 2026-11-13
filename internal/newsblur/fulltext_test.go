package newsblur

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestFullTextContract(t *testing.T) {
	for _, tc := range []struct {
		name, body string
		status     int
		want       error
	}{
		{"ready", `{"story_hash":"1:abc","original_text":"<p>Complete article.</p>","failed":false}`, 200, nil},
		{"extraction failed", `{"original_text":null,"failed":true,"code":-1}`, 200, ErrFullTextUnavailable},
		{"empty", `{"story_hash":"1:abc","original_text":" ","failed":false}`, 200, ErrFullTextUnavailable},
		{"unsupported", ``, 404, ErrFullTextUnavailable},
		{"expired", ``, 401, ErrSessionExpired},
		{"wrong identity", `{"story_hash":"1:other","original_text":"Other article","failed":false}`, 200, ErrInvalidResponse},
		{"malformed", `<html>Login</html>`, 200, ErrInvalidResponse},
		{"missing outcome", `{"story_hash":"1:abc","original_text":"Content"}`, 200, ErrInvalidResponse},
	} {
		t.Run(tc.name, func(t *testing.T) {
			calls := 0
			upstream := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				calls++
				if r.Method != "GET" || r.URL.Path != "/rss_feeds/original_text" || r.URL.Query().Get("story_hash") != "1:abc" || len(r.URL.Query()) != 1 {
					t.Error("unexpected full-text request")
				}
				w.WriteHeader(tc.status)
				fmt.Fprint(w, tc.body)
			}))
			defer upstream.Close()
			client := trustedClient(t, upstream)
			result, err := client.FullText(context.Background(), "1:abc")
			if !errors.Is(err, tc.want) {
				t.Fatalf("error = %v, want %v", err, tc.want)
			}
			if err == nil && (result.Hash != "1:abc" || result.Content != "<p>Complete article.</p>") {
				t.Fatal("lost full text")
			}
			if _, err := client.FullText(context.Background(), "https://other.invalid"); !errors.Is(err, ErrInvalidResponse) {
				t.Fatal("accepted URL in place of hash")
			}
			if calls != 1 {
				t.Fatalf("unexpected retries/invalid requests: %d", calls)
			}
		})
	}
}
