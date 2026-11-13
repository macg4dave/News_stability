// Package newsblur provides the reader's bounded, fixed-origin upstream client.
package newsblur

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"strconv"
	"strings"
	"time"
)

const maxResponseBytes = 1 << 20
const maxFormBytes = 16 << 10

var (
	// ErrRejected means NewsBlur returned an unsuccessful application result.
	ErrRejected = errors.New("NewsBlur rejected the operation")
	// ErrInvalidResponse means the response did not match the expected contract.
	ErrInvalidResponse = errors.New("invalid NewsBlur response")
	// ErrResponseTooLarge means the upstream body exceeded the client's limit.
	ErrResponseTooLarge = errors.New("NewsBlur response exceeds size limit")
	// ErrRequestTooLarge means the encoded authentication form exceeded its limit.
	ErrRequestTooLarge = errors.New("NewsBlur request exceeds size limit")
)

// StatusError reports an unexpected HTTP status without exposing upstream content.
type StatusError struct {
	StatusCode int
}

func (e *StatusError) Error() string {
	return fmt.Sprintf("NewsBlur returned HTTP %d", e.StatusCode)
}

// Client owns one upstream cookie session. Create a separate Client per reader
// session; never share one across users. It does not store passwords or log data.
type Client struct {
	origin string
	http   *http.Client
}

// New creates a client for a configured HTTPS origin with normal certificate
// verification. Private CAs must be trusted by the runtime's certificate store.
// Paths, userinfo, query strings, and fragments are not accepted in the origin.
func New(origin string) (*Client, error) {
	return NewWithRootCAs(origin, nil)
}

// NewWithRootCAs allows a deployment to trust its private CA without disabling
// hostname or certificate verification. A nil pool uses system trust.
func NewWithRootCAs(origin string, roots *x509.CertPool) (*Client, error) {
	u, err := url.Parse(origin)
	if err != nil || u.Scheme != "https" || u.Hostname() == "" || u.User != nil ||
		u.Path != "" || u.RawQuery != "" || u.ForceQuery || u.Fragment != "" ||
		strings.Contains(origin, "#") || u.Opaque != "" {
		return nil, errors.New("NewsBlur origin must be an HTTPS origin without credentials, path, query, or fragment")
	}
	if port := u.Port(); port != "" {
		number, err := strconv.Atoi(port)
		if err != nil || number < 1 || number > 65535 {
			return nil, errors.New("NewsBlur origin port must be between 1 and 65535")
		}
	}
	jar, err := cookiejar.New(nil)
	if err != nil {
		return nil, fmt.Errorf("create NewsBlur cookie jar: %w", err)
	}
	var transport http.RoundTripper = http.DefaultTransport
	if roots != nil {
		t := http.DefaultTransport.(*http.Transport).Clone()
		t.TLSClientConfig = &tls.Config{RootCAs: roots, MinVersion: tls.VersionTLS12}
		transport = t
	}
	return &Client{
		origin: origin,
		http: &http.Client{
			Transport: transport,
			Timeout:   15 * time.Second,
			Jar:       jar,
			// Even same-origin redirects are surfaced: a login page must not
			// masquerade as API success, nor may a POST be replayed elsewhere.
			CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse },
		},
	}, nil
}

// Login starts this client's upstream session using the candidate API contract.
// Installed-server acceptance is required before exposing this through the reader.
func (c *Client) Login(ctx context.Context, username, password string) error {
	if len(username) > maxFormBytes || len(password) > maxFormBytes {
		return ErrRequestTooLarge
	}
	return c.post(ctx, "/api/login", url.Values{"username": {username}, "password": {password}})
}

// Logout asks NewsBlur to invalidate this client's upstream session. A failure is
// returned to the caller; it must not be presented as successful upstream logout.
func (c *Client) Logout(ctx context.Context) error {
	return c.post(ctx, "/api/logout", nil)
}

// Prepare obtains the upstream CSRF cookie before authentication. Only cookie
// metadata is retained; the landing page is discarded and never rendered.
func (c *Client) Prepare(ctx context.Context) error {
	_, err := c.request(ctx, http.MethodGet, "/", nil)
	return err
}

// HasSession reports whether NewsBlur issued an unexpired session cookie.
func (c *Client) HasSession() bool {
	u, _ := url.Parse(c.origin + "/")
	for _, cookie := range c.http.Jar.Cookies(u) {
		if cookie.Name == "newsblur_sessionid" && cookie.Value != "" {
			return true
		}
	}
	return false
}

func (c *Client) post(ctx context.Context, path string, form url.Values) error {
	bodyForm := form.Encode()
	if len(bodyForm) > maxFormBytes {
		return ErrRequestTooLarge
	}
	body, err := c.request(ctx, http.MethodPost, path, strings.NewReader(bodyForm))
	if err != nil {
		return err
	}
	var result struct {
		Code *int `json:"code"`
	}
	if json.Unmarshal(body, &result) != nil || result.Code == nil {
		return ErrInvalidResponse
	}
	if *result.Code != 1 {
		return ErrRejected
	}
	return nil
}

func (c *Client) request(ctx context.Context, method, path string, form io.Reader) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, method, c.origin+path, form)
	if err != nil {
		return nil, errors.New("create NewsBlur request")
	}
	if method == http.MethodPost {
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		req.Header.Set("Origin", c.origin)
		req.Header.Set("Referer", c.origin+"/")
		for _, cookie := range c.http.Jar.Cookies(req.URL) {
			if cookie.Name == "csrftoken" {
				req.Header.Set("X-CSRFToken", cookie.Value)
			}
		}
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "NewsStability/0.1")
	// Do not set GetBody: authentication writes must not be replayed automatically.
	req.GetBody = nil
	resp, err := c.http.Do(req)
	if err != nil {
		// net/http wraps transport failures in url.Error, whose text includes
		// the full URL. Keep errors inspectable without logging that URL.
		var urlErr *url.Error
		if errors.As(err, &urlErr) {
			err = urlErr.Err
		}
		return nil, &requestError{cause: err}
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, &StatusError{StatusCode: resp.StatusCode}
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, maxResponseBytes+1))
	if err != nil {
		return nil, &requestError{cause: err}
	}
	if len(body) > maxResponseBytes {
		return nil, ErrResponseTooLarge
	}
	return body, nil
}

type requestError struct{ cause error }

func (e *requestError) Error() string { return "NewsBlur request failed" }
func (e *requestError) Unwrap() error { return e.cause }
