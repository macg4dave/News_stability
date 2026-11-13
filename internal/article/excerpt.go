package article

import "strings"

// Excerpt returns up to 240 Unicode characters of the sanitized article text,
// with collapsed whitespace. It never fetches content or returns executable HTML.
func Excerpt(sanitizedHTML string) string {
	text := strings.Join(strings.Fields(articleText(sanitizedHTML)), " ")
	runes := []rune(text)
	if len(runes) <= 240 {
		return text
	}
	return strings.TrimSpace(string(runes[:239])) + "…"
}
