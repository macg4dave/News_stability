package article

import (
	"strings"
	"unicode"
)

// Excerpt returns up to 1200 Unicode characters of sanitized article text, enough
// for newspaper introductions. It collapses whitespace and prefers a word ending
// near the limit. It never fetches content or returns executable HTML.
func Excerpt(sanitizedHTML string) string {
	text := strings.Join(strings.Fields(articleText(sanitizedHTML)), " ")
	runes := []rune(text)
	if len(runes) <= 1200 {
		return text
	}
	end := 1199
	for i := end; i > end-80; i-- {
		if unicode.IsSpace(runes[i]) {
			end = i
			break
		}
	}
	return strings.TrimSpace(string(runes[:end])) + "…"
}
