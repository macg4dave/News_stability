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
