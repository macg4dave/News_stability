package newsblur

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestFeedIcons(t *testing.T) {
	const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII="
	for _, tc := range []struct{ name, value, want string }{
		{"PNG", png, "data:image/png;base64," + png},
		{"missing", "", ""},
		{"URL", "https://example.invalid/favicon.png", ""},
		{"SVG", base64.StdEncoding.EncodeToString([]byte(`<svg onload="bad()"/>`)), ""},
		{"oversized", strings.Repeat("A", 128*1024+1), ""},
	} {
		t.Run(tc.name, func(t *testing.T) {
			server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.Method != http.MethodGet || r.URL.Path != "/reader/feeds" || r.URL.Query().Get("include_favicons") != "true" {
					t.Error("navigation must request existing favicons without a mutation")
				}
				json.NewEncoder(w).Encode(map[string]any{"feeds": map[string]any{"1": map[string]any{"feed_title": "Example", "favicon": tc.value}}, "folders": []int{1}})
			}))
			defer server.Close()
			nav, err := trustedClient(t, server).Feeds(context.Background())
			if err != nil || len(nav.Feeds) != 1 {
				t.Fatalf("navigation unavailable: %v", err)
			}
			if nav.Feeds[0].Icon != tc.want || nav.Feeds[0].Title != "Example" {
				t.Fatal("icon adaptation changed navigation or accepted unsafe content")
			}
		})
	}
}
