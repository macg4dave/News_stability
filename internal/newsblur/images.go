package newsblur

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/url"
	"path"
	"regexp"
	"strings"
)

const maxImageBytes = 8 << 20

var imageOptions = regexp.MustCompile(`^(?:[1-9][0-9]{0,3},)?sc,s[A-Za-z0-9_-]{43}=?$`)

// ImagePath recognizes only NewsBlur's signed imageproxy paths, including
// absolute URLs on this client's configured origin. External hosts stay external.
func (c *Client) ImagePath(value string) string {
	if strings.HasPrefix(value, c.origin+"/imageproxy/") {
		value = strings.TrimPrefix(value, c.origin)
	}
	if len(value) > 8192 || !strings.HasPrefix(value, "/imageproxy/") || strings.ContainsAny(value, "\\\r\n\x00") {
		return ""
	}
	parts := strings.SplitN(strings.TrimPrefix(value, "/imageproxy/"), "/", 2)
	if len(parts) != 2 || !imageOptions.MatchString(parts[0]) {
		return ""
	}
	original, err := url.Parse(parts[1])
	if err != nil || (original.Scheme != "http" && original.Scheme != "https") || original.Hostname() == "" || original.User != nil || original.Fragment != "" {
		return ""
	}
	u, err := url.Parse(value)
	if err != nil || u.Host != "" || !strings.HasPrefix(path.Clean(u.Path), "/imageproxy/"+parts[0]+"/") {
		return ""
	}
	return value
}

// Image reads a bounded raster image from the configured NewsBlur origin only.
// NewsBlur verifies the embedded signature. No redirects or publisher requests
// are followed, and upstream cookies/headers never leave the configured origin.
func (c *Client) Image(ctx context.Context, imagePath string) ([]byte, string, error) {
	if c.ImagePath(imagePath) != imagePath || imagePath == "" {
		return nil, "", ErrInvalidResponse
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.origin+imagePath, nil)
	if err != nil {
		return nil, "", ErrInvalidResponse
	}
	req.Header.Set("Accept", "image/avif,image/webp,image/*")
	req.Header.Set("User-Agent", "NewsStability/0.1")
	resp, err := c.http.Do(req)
	if err != nil {
		var urlErr *url.Error
		if errors.As(err, &urlErr) {
			err = urlErr.Err
		}
		return nil, "", &requestError{cause: err}
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, "", &StatusError{StatusCode: resp.StatusCode}
	}
	if resp.ContentLength > maxImageBytes {
		return nil, "", ErrResponseTooLarge
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, maxImageBytes+1))
	if err != nil {
		return nil, "", &requestError{cause: err}
	}
	if len(body) > maxImageBytes {
		return nil, "", ErrResponseTooLarge
	}
	kind := http.DetectContentType(body)
	// DetectContentType does not recognize AVIF's ISO-BMFF container.
	if len(body) >= 16 && string(body[4:8]) == "ftyp" && (string(body[8:12]) == "avif" || string(body[8:12]) == "avis") {
		kind = "image/avif"
	}
	switch kind {
	case "image/png", "image/jpeg", "image/gif", "image/webp", "image/avif":
		return body, kind, nil
	default:
		// In particular, never publish HTML or active SVG on the reader origin.
		return nil, "", ErrInvalidResponse
	}
}
