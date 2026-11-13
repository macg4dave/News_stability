package article

import (
	"strings"
	"testing"
)

func TestPicturesAreDeferredAndSanitized(t *testing.T) {
	sanitizer := New()
	for _, source := range []string{"http://example.invalid/a.jpg", "javascript:alert(1)", "data:image/svg+xml,bad", "/api/session", "//example.invalid/a.jpg", "https://user:pass@example.invalid/a.jpg", "https://", strings.Repeat("x", 8193)} {
		if got := sanitizer.HTML(`<img src="` + source + `" onerror="alert(1)" srcset="https://tracker.invalid/a.jpg 2x">`); strings.Contains(got, "<img") {
			t.Errorf("unsafe picture survived: %q", source)
		}
		if PictureURL(source) != "" {
			t.Errorf("unsafe metadata accepted: %q", source)
		}
	}
	output := sanitizer.HTML(`<p>Before</p><img src="https://images.invalid/photo.jpg?a=1&amp;b=2" alt="A &quot;view&quot;" onload="bad()" style="display:none" srcset="https://tracker.invalid/pixel 2x"><p>After</p>`)
	if !strings.Contains(output, `data-picture-src="https://images.invalid/photo.jpg?a=1&amp;b=2"`) ||
		!strings.Contains(output, `alt="A &#34;view&#34;"`) || strings.Contains(output, " src=") || strings.Contains(output, "srcset") || strings.Contains(output, "onload") {
		t.Fatalf("unexpected deferred picture HTML: %s", output)
	}
	if got := FirstPicture(nil, output); got != "https://images.invalid/photo.jpg?a=1&b=2" {
		t.Fatalf("inline picture = %q", got)
	}
	if got := FirstPicture([]string{"http://unsafe.invalid/a.jpg", "https://images.invalid/lead.jpg#fragment"}, output); got != "https://images.invalid/lead.jpg" {
		t.Fatalf("metadata picture = %q", got)
	}
	if FirstPicture(nil, "<p>No images</p>") != "" {
		t.Fatal("invented a picture")
	}
}

func TestInlinePicturesUseNewsBlurReplacements(t *testing.T) {
	sources := map[string]string{
		"http://publisher.invalid/photo.jpg":   "https://proxy.invalid/signed.jpg?token=synthetic&width=800",
		"https://publisher.invalid/second.jpg": "javascript:bad()",
	}
	output := New().HTMLWithPictures(`<p>Article</p><img src="http://publisher.invalid/photo.jpg" alt="Coast" onerror="bad()"><img src="https://publisher.invalid/second.jpg">`, sources)
	if !strings.Contains(output, `data-picture-src="https://proxy.invalid/signed.jpg?token=synthetic&amp;width=800"`) || !strings.Contains(output, `alt="Coast"`) || strings.Contains(output, "onerror") || strings.Contains(output, "javascript:") || strings.Contains(output, " src=") {
		t.Fatalf("unsafe or missing replacement: %s", output)
	}
	if !strings.Contains(output, `data-picture-src="https://publisher.invalid/second.jpg"`) {
		t.Fatal("unsafe replacement must retain a valid original")
	}
}

func TestLazyAndRelativePicturesArePreparedBeforeSanitizing(t *testing.T) {
	output := New().HTMLWithPictureBase(`<img src="data:image/gif;base64,AAAA" data-src="/photos/main.jpg" onerror="bad()" srcset="https://tracker.invalid/pixel 2x"><img data-original="//cdn.invalid/second.jpg"><img data-lazy-src="javascript:bad()" src="https://publisher.invalid/valid.jpg">`, nil, "https://publisher.invalid/stories/example")
	for _, source := range []string{"https://publisher.invalid/photos/main.jpg", "https://cdn.invalid/second.jpg", "https://publisher.invalid/valid.jpg"} {
		if !strings.Contains(output, `data-picture-src="`+source+`"`) {
			t.Errorf("missing recovered picture %s", source)
		}
	}
	for _, forbidden := range []string{"onerror", "srcset", "data-original", "data-lazy-src", "javascript:", "data:image", " src="} {
		if strings.Contains(output, forbidden) {
			t.Errorf("unsafe attribute retained: %s", forbidden)
		}
	}
}

func TestPictureFallbacksAreSafeAndBounded(t *testing.T) {
	relay := "/api/newsblur-picture?path=%2Fimageproxy%2Fsynthetic"
	output := New().HTMLWithPictures(`<img src="https://publisher.invalid/photo.jpg">`, map[string]string{"https://publisher.invalid/photo.jpg": relay})
	if values := PictureCandidates(nil, output); len(values) != 2 || values[1] != "https://publisher.invalid/photo.jpg" {
		t.Fatal("inline-only lead picture lost its original fallback")
	}
	if !strings.Contains(output, `data-picture-src="`+relay+`"`) || !strings.Contains(output, `data-picture-fallback="https://publisher.invalid/photo.jpg"`) {
		t.Fatal("safe relay fallback missing")
	}
	candidates := []string{"javascript:bad()", "/api/session", relay, relay, "https://images.invalid/1", "https://images.invalid/2", "https://images.invalid/3", "https://images.invalid/4", "https://images.invalid/5", "https://images.invalid/6"}
	values := PictureCandidates(candidates, output)
	if len(values) != 6 || values[0] != relay || values[5] != "https://images.invalid/5" {
		t.Fatalf("unbounded or unsafe fallback candidates: %v", values)
	}
}
