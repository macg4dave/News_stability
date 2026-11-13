package article

import (
	"net/url"
	"strings"

	"golang.org/x/net/html"
)

func deferPictures(sanitizedHTML string) string {
	// Never emit an image src from upstream HTML. Browser code supplies request
	// privacy attributes before enabling a validated deferred URL.
	var result strings.Builder
	tokens := html.NewTokenizer(strings.NewReader(sanitizedHTML))
	for {
		kind := tokens.Next()
		if kind == html.ErrorToken {
			return result.String()
		}
		if kind != html.StartTagToken && kind != html.SelfClosingTagToken {
			result.Write(tokens.Raw())
			continue
		}
		token := tokens.Token()
		if token.Data != "img" {
			result.WriteString(token.String())
			continue
		}
		var source, alt string
		for _, attr := range token.Attr {
			if attr.Key == "src" {
				source = PictureURL(attr.Val)
			}
			if attr.Key == "alt" {
				alt = attr.Val
			}
		}
		if source == "" {
			continue
		}
		token.Attr = []html.Attribute{{Key: "data-picture-src", Val: source}, {Key: "alt", Val: alt}}
		result.WriteString(token.String())
	}
}

// PictureURL accepts absolute HTTPS images without credentials or fragments.
// No network access is performed. HTTP images require an upstream HTTPS proxy.
func PictureURL(value string) string {
	if len(value) > 8192 {
		return ""
	}
	u, err := url.Parse(value)
	if err != nil || u.Scheme != "https" || u.Hostname() == "" || u.User != nil {
		return ""
	}
	u.Fragment = ""
	return u.String()
}

// FirstPicture uses NewsBlur's ordered image metadata, then sanitized inline
// images. Signed proxy URLs, where available, are supplied first by the adapter.
func FirstPicture(candidates []string, sanitizedHTML string) string {
	for _, candidate := range candidates {
		if safe := PictureURL(candidate); safe != "" {
			return safe
		}
	}
	tokens := html.NewTokenizer(strings.NewReader(sanitizedHTML))
	for {
		kind := tokens.Next()
		if kind == html.ErrorToken {
			return ""
		}
		if kind != html.StartTagToken && kind != html.SelfClosingTagToken {
			continue
		}
		token := tokens.Token()
		if token.Data != "img" {
			continue
		}
		for _, attr := range token.Attr {
			if attr.Key == "data-picture-src" {
				if safe := PictureURL(attr.Val); safe != "" {
					return safe
				}
			}
		}
	}
}
