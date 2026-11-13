package newsblur

import (
	"context"
	"encoding/base64"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestImagePathsStayWithinSignedNewsBlurProxy(t *testing.T) {
	c, _ := New("https://newsblur.invalid")
	options := "sc,s" + strings.Repeat("A", 43) + "="
	valid := "/imageproxy/" + options + "/https://publisher.invalid/photo.png?width=800&height=600"
	for _, value := range []string{valid, "https://newsblur.invalid" + valid, strings.Replace(valid, "/sc,", "/192,sc,", 1)} {
		if c.ImagePath(value) == "" {
			t.Errorf("valid signed proxy path rejected")
		}
	}
	for _, value := range []string{
		"/api/logout", "https://other.invalid" + valid, "/imageproxy/unsigned/https://publisher.invalid/a.png",
		"/imageproxy/" + options + "/https://user:secret@publisher.invalid/a.png",
		"/imageproxy/" + options + "/https://publisher.invalid/../../../../api/logout",
		"/imageproxy/" + options + "/https://publisher.invalid/%2e%2e/%2e%2e/%2e%2e/%2e%2e/api/logout",
		"/imageproxy/" + options + "/javascript:bad()", valid + "#fragment", valid + "\r\nX-Bad: yes",
	} {
		if c.ImagePath(value) != "" {
			t.Errorf("unsafe image path accepted: %q", value)
		}
	}
}

func TestImageTransportBoundsTypesAndRedirects(t *testing.T) {
	png, _ := base64.StdEncoding.DecodeString("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==")
	for _, kind := range []string{"png", "html", "svg", "redirect", "oversized", "missing"} {
		t.Run(kind, func(t *testing.T) {
			calls := 0
			upstream := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				calls++
				if !strings.HasPrefix(r.URL.Path, "/imageproxy/") || r.Method != "GET" || r.Header.Get("Referer") != "" {
					t.Error("unexpected image transport request")
				}
				switch kind {
				case "png":
					w.Header().Set("Set-Cookie", "private=upstream-only")
					_, _ = w.Write(png)
				case "html":
					fmt.Fprint(w, "<html><script>bad()</script></html>")
				case "svg":
					fmt.Fprint(w, `<svg xmlns="http://www.w3.org/2000/svg" onload="bad()"/>`)
				case "redirect":
					http.Redirect(w, r, "/api/logout", http.StatusFound)
				case "oversized":
					w.Header().Set("Content-Length", fmt.Sprint(maxImageBytes+1))
					w.WriteHeader(http.StatusOK)
				default:
					w.WriteHeader(http.StatusNotFound)
				}
			}))
			defer upstream.Close()
			c := trustedClient(t, upstream)
			body, contentType, err := c.Image(context.Background(), "/imageproxy/sc,s"+strings.Repeat("A", 43)+"=/http://publisher.invalid/photo.png")
			if calls != 1 {
				t.Fatal("image request redirected or retried")
			}
			if kind == "png" {
				if err != nil || contentType != "image/png" || string(body) != string(png) {
					t.Fatal("raster image did not survive the transport")
				}
			} else if err == nil {
				t.Fatal("unsafe or failed response accepted")
			}
		})
	}
}
