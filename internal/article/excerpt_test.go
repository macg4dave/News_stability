package article

import (
	"strings"
	"testing"
	"unicode/utf8"
)

func TestExcerptOfSanitizedContent(t *testing.T) {
	for _, tc := range []struct{ name, input, want string }{
		{"empty", "", ""},
		{"inline and blocks", "<p>A <em>read</em>er &amp; friend.</p><p>Next\n\t paragraph.</p>", "A reader & friend. Next paragraph."},
		{"text resembling markup", "<p>&lt;img src=x onerror=bad&gt;</p>", "<img src=x onerror=bad>"},
		{"hostile content", `<script>secret()</script><img src="https://tracker.invalid/pixel"><p>Visible text.</p>`, "Visible text."},
		{"unicode boundary", strings.Repeat("界", 1201), strings.Repeat("界", 1199) + "…"},
		{"exact limit", strings.Repeat("é", 1200), strings.Repeat("é", 1200)},
		{"word boundary", strings.Repeat("a", 1190) + " " + strings.Repeat("b", 20), strings.Repeat("a", 1190) + "…"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			got := Excerpt(New().HTML(tc.input))
			if got != tc.want || !utf8.ValidString(got) {
				t.Fatalf("excerpt = %q, want %q", got, tc.want)
			}
		})
	}
}
