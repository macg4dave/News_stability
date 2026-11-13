package article

import (
	"net/url"
	"strings"

	"golang.org/x/net/html"
)

func deferPictures(sanitizedHTML string, sources map[string]string) string {
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
		var source, fallback, alt string
		for _, attr := range token.Attr {
			if attr.Key == "src" {
				fallback = PictureURL(attr.Val)
				source = PictureURL(sources[attr.Val])
				if source == "" {
					source = PictureURL(attr.Val)
				}
			}
			if attr.Key == "alt" {
				alt = attr.Val
			}
		}
		if source == "" {
			continue
		}
		token.Attr = []html.Attribute{{Key: "data-picture-src", Val: source}, {Key: "alt", Val: alt}}
		if fallback != "" && fallback != source {
			token.Attr = append(token.Attr, html.Attribute{Key: "data-picture-fallback", Val: fallback})
		}
		result.WriteString(token.String())
	}
}

// PictureURL accepts absolute HTTPS images and the reader's constrained picture
// relay. No network access is performed. Other reader-local paths are rejected.
func PictureURL(value string) string {
	if len(value) > 8192 {
		return ""
	}
	u, err := url.Parse(value)
	if err == nil && u.Scheme == "" && u.Host == "" && u.Path == "/api/newsblur-picture" && u.Fragment == "" && len(u.Query()) == 1 && len(u.Query()["path"]) == 1 && strings.HasPrefix(u.Query().Get("path"), "/imageproxy/") {
		return u.String()
	}
	if err != nil || u.Scheme != "https" || u.Hostname() == "" || u.User != nil {
		return ""
	}
	u.Fragment = ""
	return u.String()
}

// FirstPicture uses NewsBlur's ordered image metadata, then sanitized inline
// images. Signed proxy URLs, where available, are supplied first by the adapter.
func FirstPicture(candidates []string, sanitizedHTML string) string {
	values := PictureCandidates(candidates, sanitizedHTML)
	if len(values) == 0 {
		return ""
	}
	return values[0]
}

// PictureCandidates returns at most six distinct, validated metadata/inline
// images. Browser fallbacks are bounded and never fetch publisher pages.
func PictureCandidates(candidates []string, sanitizedHTML string) []string {
	values := make([]string, 0)
	seen := make(map[string]bool)
	add := func(value string) {
		if safe := PictureURL(value); safe != "" && !seen[safe] && len(values) < 6 {
			seen[safe] = true
			values = append(values, safe)
		}
	}
	for _, candidate := range candidates {
		add(candidate)
	}
	tokens := html.NewTokenizer(strings.NewReader(sanitizedHTML))
	for {
		kind := tokens.Next()
		if kind == html.ErrorToken {
			return values
		}
		if kind != html.StartTagToken && kind != html.SelfClosingTagToken {
			continue
		}
		token := tokens.Token()
		if token.Data != "img" {
			continue
		}
		for _, attr := range token.Attr {
			if attr.Key == "data-picture-src" || attr.Key == "data-picture-fallback" {
				add(attr.Val)
			}
		}
	}
}

// preparePictures promotes common lazy image attributes and resolves picture
// paths against a validated story URL. The complete result is sanitized next;
// no upstream event handlers, data attributes or srcsets bypass the allowlist.
func preparePictures(untrusted, baseURL string, sources map[string]string) string {
	base, _ := url.Parse(SafeURL(baseURL))
	var result strings.Builder
	tokens := html.NewTokenizer(strings.NewReader(untrusted))
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
		if token.Data == "img" {
			var selected string
			for _, name := range []string{"data-src", "data-original", "data-lazy-src", "src"} {
				for _, attr := range token.Attr {
					if attr.Key != name {
						continue
					}
					u, err := url.Parse(strings.TrimSpace(attr.Val))
					if err != nil || attr.Val == "" {
						continue
					}
					if base != nil && base.Host != "" {
						u = base.ResolveReference(u)
					}
					if safe := SafeURL(u.String()); safe != "" && (PictureURL(safe) != "" || PictureURL(sources[safe]) != "") {
						selected = safe
						break
					}
				}
				if selected != "" {
					break
				}
			}
			attrs := make([]html.Attribute, 0, len(token.Attr)+1)
			for _, attr := range token.Attr {
				if attr.Key != "src" {
					attrs = append(attrs, attr)
				}
			}
			if selected != "" {
				attrs = append(attrs, html.Attribute{Key: "src", Val: selected})
			}
			token.Attr = attrs
		}
		result.WriteString(token.String())
	}
}
