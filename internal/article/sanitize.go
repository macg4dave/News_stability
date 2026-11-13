// Package article defines the reader's deliberate story-markup allowlist.
package article

import (
	"net/url"

	"github.com/microcosm-cc/bluemonday"
)

// Sanitizer keeps readable formatting while excluding active content, forms,
// embedded media, styles, IDs, and application-like controls. Images are emitted
// as inert placeholders; the browser enables them under the picture preference.
type Sanitizer struct{ policy *bluemonday.Policy }

// New creates an immutable policy safe for concurrent sanitization.
func New() *Sanitizer {
	p := bluemonday.NewPolicy()
	p.AllowElements("p", "br", "hr", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "pre", "code", "strong", "b", "em", "i", "s", "del", "u", "ul", "ol", "li", "dl", "dt", "dd", "table", "thead", "tbody", "tr", "th", "td", "caption", "sup", "sub", "a")
	p.AllowAttrs("href", "title").OnElements("a")
	p.AllowElements("img")
	p.AllowAttrs("src", "alt").OnElements("img")
	p.RequireParseableURLs(true)
	p.AllowRelativeURLs(false)
	p.AllowURLSchemes("https", "http")
	p.RequireNoFollowOnLinks(true)
	p.RequireNoReferrerOnLinks(true)
	p.AddTargetBlankToFullyQualifiedLinks(true)
	return &Sanitizer{policy: p}
}

// HTML sanitizes upstream story content and defers validated picture URLs.
func (s *Sanitizer) HTML(untrusted string) string {
	return s.HTMLWithPictures(untrusted, nil)
}

// HTMLWithPictures uses NewsBlur-supplied HTTPS image replacements before
// deferring image loading. Replacement URLs pass the same image URL validation.
func (s *Sanitizer) HTMLWithPictures(untrusted string, sources map[string]string) string {
	return s.HTMLWithPictureBase(untrusted, sources, "")
}

// HTMLWithPictureBase resolves publisher-relative pictures before sanitization.
func (s *Sanitizer) HTMLWithPictureBase(untrusted string, sources map[string]string, baseURL string) string {
	return deferPictures(s.policy.Sanitize(preparePictures(untrusted, baseURL, sources)), sources)
}

// SafeURL allows only absolute HTTP(S) article links with no embedded credentials.
func SafeURL(value string) string {
	u, err := url.Parse(value)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Hostname() == "" || u.User != nil {
		return ""
	}
	return u.String()
}
