// Package article defines the reader's deliberate story-markup allowlist.
package article

import (
	"net/url"

	"github.com/microcosm-cc/bluemonday"
)

// Sanitizer keeps readable formatting while excluding active content, forms,
// embedded media, remote images, styles, IDs, and application-like controls.
type Sanitizer struct{ policy *bluemonday.Policy }

// New creates an immutable policy safe for concurrent sanitization.
func New() *Sanitizer {
	p := bluemonday.NewPolicy()
	p.AllowElements("p", "br", "hr", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "pre", "code", "strong", "b", "em", "i", "s", "del", "u", "ul", "ol", "li", "dl", "dt", "dd", "table", "thead", "tbody", "tr", "th", "td", "caption", "sup", "sub", "a")
	p.AllowAttrs("href", "title").OnElements("a")
	p.RequireParseableURLs(true)
	p.AllowRelativeURLs(false)
	p.AllowURLSchemes("https", "http")
	p.RequireNoFollowOnLinks(true)
	p.RequireNoReferrerOnLinks(true)
	p.AddTargetBlankToFullyQualifiedLinks(true)
	return &Sanitizer{policy: p}
}

// HTML sanitizes upstream story content as the final transformation.
func (s *Sanitizer) HTML(untrusted string) string { return s.policy.Sanitize(untrusted) }

// SafeURL allows only absolute HTTP(S) article links with no embedded credentials.
func SafeURL(value string) string {
	u, err := url.Parse(value)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Hostname() == "" || u.User != nil {
		return ""
	}
	return u.String()
}
