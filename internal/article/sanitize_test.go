package article

import (
	"fmt"
	"strings"
	"testing"

	"golang.org/x/net/html"
)

func TestSanitizerRemovesActiveMarkupAndTracking(t *testing.T) {
	input := `<h2 id="login">Readable heading</h2><p style="display:none" onclick="alert(1)">Useful <strong>text</strong></p><script>alert(1)</script><iframe src="https://tracker.invalid"></iframe><form action="https://tracker.invalid"><input name="password"></form><img src="https://tracker.invalid/pixel"><svg onload="alert(1)"></svg><a href="javascript:alert(1)">unsafe</a><a href="data:text/html,bad">data</a><a href="/api/logout">relative</a><a href="https://example.invalid/story">safe link</a>`
	output := New().HTML(input)
	for _, forbidden := range []string{"<script", "<iframe", "<form", "<input", "<img", "<svg", "onclick", "onload", "style=", "id=", "javascript:", "data:text", `href="/`} {
		if strings.Contains(output, forbidden) {
			t.Errorf("unsafe %q in sanitized markup", forbidden)
		}
	}
	if !strings.Contains(output, "<strong>text</strong>") || !strings.Contains(output, "Readable heading") {
		t.Fatal("readable formatting removed")
	}
	tokens := html.NewTokenizer(strings.NewReader(output))
	for tokens.Next() != html.ErrorToken {
		token := tokens.Token()
		if token.Data != "a" {
			continue
		}
		attrs := map[string]string{}
		for _, attr := range token.Attr {
			attrs[attr.Key] = attr.Val
		}
		if attrs["href"] != "" && (attrs["target"] != "_blank" || !strings.Contains(attrs["rel"], "noreferrer") || !strings.Contains(attrs["rel"], "noopener")) {
			t.Fatal("external link lacks isolation")
		}
	}
}

func TestSafeURLAndBoundedLinks(t *testing.T) {
	for _, value := range []string{"javascript:bad", "//example.invalid", "/relative", "https://user:password@example.invalid", "https://", "data:text/plain,a"} {
		if SafeURL(value) != "" {
			t.Errorf("accepted unsafe URL %q", value)
		}
	}
	var content strings.Builder
	for i := range 110 {
		fmt.Fprintf(&content, `<a href="https://example.invalid/%d">link</a>`, i)
	}
	links := Links(New().HTML(content.String()))
	if len(links) != 100 {
		t.Fatalf("links = %d", len(links))
	}
	if len(Links(`<a href="https://example.invalid/">one</a><a href="https://example.invalid/">two</a>`)) != 1 {
		t.Fatal("links not deduplicated")
	}
}

func TestReadingTimeForDisplayedText(t *testing.T) {
	for _, tc := range []struct {
		html    string
		minutes int
	}{
		{"", 0}, {"<p>One <em>word</em>.</p>", 1}, {strings.Repeat("word ", 201), 2}, {strings.Repeat("中", 501), 2},
	} {
		if got := ReadingMinutes(tc.html); got != tc.minutes {
			t.Errorf("reading minutes = %d, want %d", got, tc.minutes)
		}
	}
}
