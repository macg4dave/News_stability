package article

import (
	"strings"

	"golang.org/x/net/html"
)

// Links returns unique safe links from the sanitized article, in display order.
// It does not fetch URLs, discover stories, or infer topic similarity.
func Links(sanitizedHTML string) []string {
	links := []string{}
	seen := make(map[string]bool)
	tokens := html.NewTokenizer(strings.NewReader(sanitizedHTML))
	for {
		typeID := tokens.Next()
		if typeID == html.ErrorToken {
			return links
		}
		if typeID != html.StartTagToken {
			continue
		}
		token := tokens.Token()
		if token.Data != "a" {
			continue
		}
		for _, attr := range token.Attr {
			if attr.Key != "href" {
				continue
			}
			value := SafeURL(attr.Val)
			if value == "" || seen[value] {
				continue
			}
			seen[value] = true
			links = append(links, value)
			if len(links) == 100 {
				return links
			}
		}
	}
}
