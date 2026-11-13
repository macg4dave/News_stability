package httpserver_test

import (
	"crypto/x509"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"

	"newsstability/internal/httpserver"
	"newsstability/internal/newsblur"
	"newsstability/internal/session"
)

type sessionResponse struct {
	Authenticated bool   `json:"authenticated"`
	CSRF          string `json:"csrf_token"`
}

func TestHTTPSCookieAndCrossOriginProtection(t *testing.T) {
	store, _ := session.New(8)
	reader := httptest.NewUnstartedServer(nil)
	origin := "https://" + reader.Listener.Addr().String()
	var calls atomic.Int32
	auth := httpserver.NewAuth(origin, store, func() (*newsblur.Client, error) { calls.Add(1); return nil, fmt.Errorf("unexpected upstream access") })
	reader.Config.Handler = httpserver.NewHandler(auth)
	reader.StartTLS()
	defer reader.Close()
	client := reader.Client()
	response, err := client.Get(reader.URL + "/api/session")
	if err != nil {
		t.Fatal(err)
	}
	var state sessionResponse
	err = json.NewDecoder(response.Body).Decode(&state)
	response.Body.Close()
	if err != nil {
		t.Fatal(err)
	}
	cookies := response.Cookies()
	if len(cookies) != 1 || cookies[0].Name != "__Host-reader_session" || !cookies[0].Secure || !cookies[0].HttpOnly || cookies[0].Domain != "" || cookies[0].Path != "/" || cookies[0].SameSite != http.SameSiteStrictMode {
		t.Fatal("HTTPS cookie policy incorrect")
	}
	for _, tc := range []struct{ origin, site string }{{"https://evil.invalid", ""}, {"", ""}, {origin, "cross-site"}} {
		req, _ := http.NewRequest(http.MethodPost, reader.URL+"/api/login", strings.NewReader(`{"username":"fixture"}`))
		req.AddCookie(cookies[0])
		req.Header.Set("Origin", tc.origin)
		req.Header.Set("Sec-Fetch-Site", tc.site)
		req.Header.Set("X-CSRF-Token", state.CSRF)
		response, err := client.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		response.Body.Close()
		if response.StatusCode != 403 {
			t.Fatalf("cross-origin request HTTP %d", response.StatusCode)
		}
	}
	if calls.Load() != 0 {
		t.Fatal("cross-origin request reached upstream")
	}
}

func TestInvalidLoginDoesNotAuthenticate(t *testing.T) {
	upstream := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/login" {
			fmt.Fprint(w, `{"code":-1}`)
		} else {
			fmt.Fprint(w, "synthetic landing")
		}
	}))
	defer upstream.Close()
	reader, client := readerForUpstream(t, upstream, true)
	state, _ := readSession(t, client, reader.URL)
	response := authRequest(t, client, reader.URL, "/api/login", state.CSRF, `{"username":"fixture","password":"synthetic"}`)
	if response.StatusCode != 401 {
		t.Fatalf("invalid login HTTP %d", response.StatusCode)
	}
	after, _ := readSession(t, client, reader.URL)
	if after.Authenticated {
		t.Fatal("invalid credentials authenticated")
	}
}

func readerForUpstream(t *testing.T, upstream *httptest.Server, trust bool) (*httptest.Server, *http.Client) {
	t.Helper()
	store, err := session.New(16)
	if err != nil {
		t.Fatal(err)
	}
	var roots *x509.CertPool
	if trust {
		roots = x509.NewCertPool()
		roots.AddCert(upstream.Certificate())
	}
	reader := httptest.NewUnstartedServer(nil)
	origin := "http://" + reader.Listener.Addr().String()
	auth := httpserver.NewAuth(origin, store, func() (*newsblur.Client, error) { return newsblur.NewWithRootCAs(upstream.URL, roots) })
	reader.Config.Handler = httpserver.NewHandler(auth)
	reader.Start()
	t.Cleanup(reader.Close)
	jar, err := cookiejar.New(nil)
	if err != nil {
		t.Fatal(err)
	}
	client := reader.Client()
	client.Jar = jar
	return reader, client
}

func readSession(t *testing.T, client *http.Client, origin string) (sessionResponse, *http.Cookie) {
	t.Helper()
	response, err := client.Get(origin + "/api/session")
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		t.Fatalf("session HTTP %d", response.StatusCode)
	}
	var result sessionResponse
	if err := json.NewDecoder(response.Body).Decode(&result); err != nil {
		t.Fatal(err)
	}
	if result.CSRF == "" {
		t.Fatal("missing CSRF token")
	}
	for _, cookie := range response.Cookies() {
		if cookie.Name == "reader_session" {
			return result, cookie
		}
	}
	return result, nil
}

func authRequest(t *testing.T, client *http.Client, origin, path, csrf, body string) *http.Response {
	t.Helper()
	req, err := http.NewRequest(http.MethodPost, origin+path, strings.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Origin", origin)
	req.Header.Set("Content-Type", "application/json")
	if csrf != "" {
		req.Header.Set("X-CSRF-Token", csrf)
	}
	response, err := client.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { response.Body.Close() })
	return response
}

func TestReaderLoginWithPrivateCertificate(t *testing.T) {
	var loginCalls atomic.Int32
	var upstreamURL string
	upstream := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/":
			http.SetCookie(w, &http.Cookie{Name: "csrftoken", Value: "synthetic-csrf", Path: "/", Secure: true})
			fmt.Fprint(w, "<html>synthetic landing page</html>")
		case "/api/login":
			loginCalls.Add(1)
			if r.Method != http.MethodPost || r.Header.Get("Origin") != upstreamURL || r.Header.Get("Referer") != upstreamURL+"/" || r.Header.Get("X-CSRFToken") != "synthetic-csrf" {
				t.Error("upstream CSRF/method headers missing")
				w.WriteHeader(http.StatusForbidden)
				return
			}
			csrf, err := r.Cookie("csrftoken")
			if err != nil || csrf.Value != "synthetic-csrf" {
				t.Error("upstream CSRF cookie missing")
				w.WriteHeader(403)
				return
			}
			if err := r.ParseForm(); err != nil {
				t.Error(err)
			}
			if r.Form.Get("username") != "reader+fixture" || r.Form.Get("password") != "synthetic&password" {
				t.Error("incorrect form encoding")
			}
			http.SetCookie(w, &http.Cookie{Name: "newsblur_sessionid", Value: "synthetic-upstream-secret", Path: "/", Secure: true, HttpOnly: true})
			fmt.Fprint(w, `{"code":1}`)
		case "/reader/feeds":
			cookie, err := r.Cookie("newsblur_sessionid")
			if err != nil || cookie.Value != "synthetic-upstream-secret" {
				w.WriteHeader(401)
				return
			}
			fmt.Fprint(w, `{"feeds":{"1":{"feed_title":"Synthetic feed","ps":1,"nt":2,"ng":0}},"folders":[1]}`)
		case "/api/logout":
			http.SetCookie(w, &http.Cookie{Name: "newsblur_sessionid", Path: "/", Secure: true, MaxAge: -1})
			fmt.Fprint(w, `{"code":1}`)
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer upstream.Close()
	upstreamURL = upstream.URL
	reader, client := readerForUpstream(t, upstream, true)
	before, cookie := readSession(t, client, reader.URL)
	if before.Authenticated || cookie == nil || !cookie.HttpOnly || cookie.SameSite != http.SameSiteStrictMode {
		t.Fatal("incorrect anonymous session/cookie")
	}
	response := authRequest(t, client, reader.URL, "/api/login", before.CSRF, `{"username":"reader+fixture","password":"synthetic&password"}`)
	if response.StatusCode != http.StatusOK {
		t.Fatalf("login HTTP %d", response.StatusCode)
	}
	var after sessionResponse
	if err := json.NewDecoder(response.Body).Decode(&after); err != nil {
		t.Fatal(err)
	}
	if !after.Authenticated || after.CSRF == before.CSRF {
		t.Fatal("login did not authenticate and rotate CSRF")
	}
	cookies := response.Cookies()
	if len(cookies) != 1 || cookies[0].Name != "reader_session" || cookies[0].Value == cookie.Value || strings.Contains(cookies[0].Value, "synthetic-upstream-secret") {
		t.Fatal("reader cookie not rotated or upstream cookie exposed")
	}
	feeds, err := client.Get(reader.URL + "/api/feeds")
	if err != nil {
		t.Fatal(err)
	}
	defer feeds.Body.Close()
	if feeds.StatusCode != http.StatusOK {
		t.Fatalf("feed read HTTP %d", feeds.StatusCode)
	}
	response = authRequest(t, client, reader.URL, "/api/logout", after.CSRF, `{}`)
	if response.StatusCode != http.StatusOK {
		t.Fatalf("logout HTTP %d", response.StatusCode)
	}
	newSession, _ := readSession(t, client, reader.URL)
	if newSession.Authenticated {
		t.Fatal("logout left authenticated reader session")
	}
	if loginCalls.Load() != 1 {
		t.Fatal("login was retried")
	}
}

func TestReaderLoginRejectsUntrustedCertificate(t *testing.T) {
	upstream := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { t.Error("untrusted request reached upstream handler") }))
	defer upstream.Close()
	reader, client := readerForUpstream(t, upstream, false)
	session, _ := readSession(t, client, reader.URL)
	response := authRequest(t, client, reader.URL, "/api/login", session.CSRF, `{"username":"fixture","password":"sensitive"}`)
	body, err := io.ReadAll(response.Body)
	if err != nil {
		t.Fatal(err)
	}
	var result struct {
		Code string `json:"code"`
	}
	if json.Unmarshal(body, &result) != nil || response.StatusCode != http.StatusBadGateway || result.Code != "upstream_tls" {
		t.Fatalf("expected certificate error, got HTTP %d", response.StatusCode)
	}
	if strings.Contains(string(body), "sensitive") || strings.Contains(string(body), upstream.URL) {
		t.Fatal("private request detail exposed")
	}
}

func TestReaderLoginRejectsCSRFBeforeUpstream(t *testing.T) {
	upstream := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { t.Error("invalid CSRF reached upstream") }))
	defer upstream.Close()
	reader, client := readerForUpstream(t, upstream, true)
	readSession(t, client, reader.URL)
	response := authRequest(t, client, reader.URL, "/api/login", "wrong", `{"username":"fixture","password":"synthetic"}`)
	if response.StatusCode != http.StatusForbidden {
		t.Fatalf("invalid CSRF HTTP %d", response.StatusCode)
	}
}
