package httpserver_test

import (
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync/atomic"
	"testing"
)

func TestNewsBlurPicturesAreAuthenticatedAndFixedOrigin(t *testing.T) {
	signed := "/imageproxy/sc,s" + strings.Repeat("A", 43) + "=/http://publisher.invalid/photo.png"
	thumb := strings.Replace(signed, "/sc,", "/192,sc,", 1)
	png, _ := base64.StdEncoding.DecodeString("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==")
	var imageCalls atomic.Int32
	reader, client, _ := loggedInReader(t, func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.URL.Path == "/reader/feed/1":
			_ = json.NewEncoder(w).Encode(map[string]any{"stories": []any{map[string]any{
				"story_hash": "1:image", "image_urls": []string{"http://publisher.invalid/photo.png"},
				"secure_image_urls":       map[string]string{"http://publisher.invalid/photo.png": signed},
				"secure_image_thumbnails": map[string]string{"http://publisher.invalid/photo.png": thumb},
				"story_content":           `<p>Story</p><img src="http://publisher.invalid/photo.png" alt="Scene">`,
			}}})
		case strings.HasPrefix(r.URL.Path, "/imageproxy/"):
			imageCalls.Add(1)
			if _, err := r.Cookie("newsblur_sessionid"); err != nil {
				t.Error("upstream session cookie missing")
			}
			w.Header().Set("Set-Cookie", "do-not-forward=private")
			_, _ = w.Write(png)
		default:
			t.Errorf("unexpected upstream path: %s", r.URL.Path)
			w.WriteHeader(404)
		}
	})
	response, err := client.Get(reader.URL + "/api/feeds/1/stories")
	if err != nil {
		t.Fatal(err)
	}
	var result struct {
		Stories []struct{ Picture, Thumbnail, HTML string } `json:"stories"`
	}
	if err := json.NewDecoder(response.Body).Decode(&result); err != nil || len(result.Stories) != 1 {
		t.Fatal("missing synthetic story")
	}
	response.Body.Close()
	if !strings.HasPrefix(result.Stories[0].Picture, "/api/newsblur-picture?") || !strings.Contains(result.Stories[0].Thumbnail, "192%2Csc") || !strings.Contains(result.Stories[0].HTML, "data-picture-src=\"/api/newsblur-picture?") {
		t.Fatalf("NewsBlur relative pictures not adapted: %+v", result)
	}
	imageURL := reader.URL + result.Stories[0].Picture
	response, err = client.Get(imageURL)
	if err != nil {
		t.Fatal(err)
	}
	body, _ := io.ReadAll(response.Body)
	response.Body.Close()
	if response.StatusCode != 200 || string(body) != string(png) || response.Header.Get("Content-Type") != "image/png" || response.Header.Get("Set-Cookie") != "" || response.Header.Get("Cache-Control") != "no-store" {
		t.Fatal("unsafe or unsuccessful image response")
	}
	response, err = http.Get(imageURL)
	if err != nil {
		t.Fatal(err)
	}
	response.Body.Close()
	if response.StatusCode != 401 {
		t.Fatal("anonymous image access allowed")
	}
	for _, target := range []string{"/api/logout", "/imageproxy/unsigned/http://publisher.invalid/photo.png", "https://other.invalid" + signed} {
		response, err = client.Get(reader.URL + "/api/newsblur-picture?" + url.Values{"path": {target}}.Encode())
		if err != nil {
			t.Fatal(err)
		}
		response.Body.Close()
		if response.StatusCode != 400 {
			t.Fatal("unsafe image path accepted")
		}
	}
	if imageCalls.Load() != 1 {
		t.Fatal("unsafe requests reached NewsBlur")
	}
}
