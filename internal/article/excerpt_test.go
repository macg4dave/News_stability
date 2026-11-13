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
		{"unicode boundary", strings.Repeat("界", 241), strings.Repeat("界", 239) + "…"},
		{"exact limit", strings.Repeat("é", 240), strings.Repeat("é", 240)},
	} {
		t.Run(tc.name, func(t *testing.T) {
			got := Excerpt(New().HTML(tc.input))
			if got != tc.want || !utf8.ValidString(got) {
				t.Fatalf("excerpt = %q, want %q", got, tc.want)
			}
		})
	}
}
