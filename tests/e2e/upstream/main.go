// A synthetic NewsBlur HTTPS server used only by the container acceptance suite.
package main

import (
	"bytes"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"log"
	"math/big"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"
)

func signed(source, size string) string {
	mac := hmac.New(sha256.New, []byte("synthetic-image-signing-key"))
	mac.Write([]byte(source))
	return "/imageproxy/" + size + "sc,s" + base64.URLEncoding.EncodeToString(mac.Sum(nil)) + "/" + source
}

func syntheticPNG(width, height int) ([]byte, error) {
	bitmap := image.NewRGBA(image.Rect(0, 0, width, height))
	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			bitmap.Set(x, y, color.RGBA{30, uint8(100 + x), 180, 255})
		}
	}
	var encoded bytes.Buffer
	if err := png.Encode(&encoded, bitmap); err != nil {
		return nil, err
	}
	return encoded.Bytes(), nil
}

func main() {
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		log.Fatal(err)
	}
	cert := &x509.Certificate{SerialNumber: big.NewInt(1), Subject: pkix.Name{CommonName: "Synthetic NewsBlur"}, DNSNames: []string{"newsblur-fixture"}, NotBefore: time.Now().Add(-time.Hour), NotAfter: time.Now().Add(24 * time.Hour), IsCA: true, BasicConstraintsValid: true, KeyUsage: x509.KeyUsageCertSign | x509.KeyUsageDigitalSignature, ExtKeyUsage: []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth}}
	der, err := x509.CreateCertificate(rand.Reader, cert, cert, &key.PublicKey, key)
	if err != nil {
		log.Fatal(err)
	}
	private, err := x509.MarshalECPrivateKey(key)
	if err != nil {
		log.Fatal(err)
	}
	if err := os.WriteFile("/fixture-ca/ca.pem", pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der}), 0644); err != nil {
		log.Fatal(err)
	}
	if err := os.WriteFile("/fixture-ca/key.pem", pem.EncodeToMemory(&pem.Block{Type: "EC PRIVATE KEY", Bytes: private}), 0600); err != nil {
		log.Fatal(err)
	}
	picture, err := syntheticPNG(640, 400)
	if err != nil {
		log.Fatal(err)
	}
	portraitPicture, err := syntheticPNG(400, 800)
	if err != nil {
		log.Fatal(err)
	}
	var mu sync.Mutex
	mode := "healthy"
	reads := map[string]bool{}
	training := map[string]int{}
	imageRequests := 0
	control := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		defer mu.Unlock()
		if r.Method == "POST" {
			var input struct {
				Mode string `json:"mode"`
			}
			if json.NewDecoder(http.MaxBytesReader(w, r.Body, 1024)).Decode(&input) != nil {
				http.Error(w, "invalid", 400)
				return
			}
			mode = input.Mode
			if mode == "reset" {
				mode = "healthy"
				reads = map[string]bool{}
				training = map[string]int{}
				imageRequests = 0
			}
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"mode": mode, "reads": reads, "images": imageRequests, "training": training})
	})
	go func() { log.Fatal(http.ListenAndServe(":8081", control)) }()
	// ServeMux cleans embedded publisher URLs; the real proxy path must survive.
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		defer mu.Unlock()
		w.Header().Set("Content-Type", "application/json")
		reply := func(value any) { json.NewEncoder(w).Encode(value) }
		if r.URL.Path == "/" {
			http.SetCookie(w, &http.Cookie{Name: "csrftoken", Value: "fixture-csrf", Path: "/", Secure: true})
			reply(map[string]int{"code": 1})
			return
		}
		if r.URL.Path == "/api/login" {
			r.ParseForm()
			if r.Form.Get("username") != "fixture" || r.Form.Get("password") != "fixture-password" || r.Header.Get("X-CSRFToken") != "fixture-csrf" {
				http.Error(w, "rejected", 403)
				return
			}
			http.SetCookie(w, &http.Cookie{Name: "newsblur_sessionid", Value: "fixture-session", Path: "/", Secure: true, HttpOnly: true})
			reply(map[string]int{"code": 1})
			return
		}
		cookie, err := r.Cookie("newsblur_sessionid")
		if err != nil || cookie.Value != "fixture-session" || mode == "expired" {
			http.Error(w, "expired", 401)
			return
		}
		switch {
		case r.URL.Path == "/api/logout":
			http.SetCookie(w, &http.Cookie{Name: "newsblur_sessionid", Value: "", Path: "/", MaxAge: -1})
			reply(map[string]int{"code": 1})
		case r.URL.Path == "/reader/feeds":
			reply(map[string]any{"feeds": map[string]any{"1": map[string]any{"feed_title": "Fixture feed", "ps": 0, "nt": 12, "ng": 0}}, "folders": []any{map[string]any{"Reading": []int{1}}}})
		case r.URL.Path == "/classifier/save":
			if r.Method != "POST" || r.Header.Get("X-CSRFToken") != "fixture-csrf" {
				http.Error(w, "rejected", 403)
				return
			}
			r.ParseForm()
			if r.Form.Get("feed_id") != "1" || mode == "feedback-fail" {
				reply(map[string]int{"code": -1})
				return
			}
			for _, target := range []string{"title", "author", "tag"} {
				for _, action := range []string{"like", "dislike", "remove_like", "remove_dislike"} {
					if value := r.Form.Get(action + "_" + target); value != "" {
						score := 0
						if action == "like" {
							score = 1
						}
						if action == "dislike" {
							score = -1
						}
						training[target+":"+value] = score
					}
				}
			}
			reply(map[string]int{"code": 0})
		case r.URL.Path == "/reader/feed/1" || r.URL.Path == "/reader/river_stories":
			r.ParseForm()
			page, _ := strconv.Atoi(r.Form.Get("page"))
			if page < 1 {
				page = 1
			}
			stories := []any{}
			start, end := (page-1)*4, page*4
			requested := r.Form.Get("h")
			if requested != "" {
				if _, err := fmt.Sscanf(requested, "1:story%d", &start); err != nil {
					reply(map[string]any{"stories": stories})
					return
				}
				end = start + 1
			}
			for i := start; i < end && i < 12; i++ {
				hash := fmt.Sprintf("1:story%d", i)
				source := fmt.Sprintf("http://publisher.invalid/picture%d.png?size=large&v=1", i)
				// A different photograph needs a different signed source identity. Browsers
				// can share decoded resources already displayed elsewhere in the document.
				if mode == "portrait-lead" {
					source = fmt.Sprintf("http://publisher.invalid/portrait%d.png?size=large&v=1", i)
				}
				if i == 3 {
					source = "https://publisher.invalid/space%20here.png?size=large&v=1"
				}
				secure := signed(source, "")
				if i == 1 {
					secure = "https://newsblur-fixture:8443" + secure
				}
				images := []string{source}
				content := "<p>Feed excerpt.</p><img src=\"" + source + "\" alt=\"Synthetic landscape\">"
				if i == 2 {
					images = []string{}
					content = "<p>Feed excerpt.</p><img data-src=\"" + source + "\" alt=\"Synthetic lazy landscape\">"
				}
				read := 0
				if reads[hash] {
					read = 1
				}
				score := 0
				if i%3 == 0 {
					score = 1
				}
				title := fmt.Sprintf("Fixture story %d", i)
				if value, ok := training["title:"+title]; ok {
					score = value
				}
				if r.Form.Get("read_filter") == "unread" && read == 1 {
					continue
				}
				stories = append(stories, map[string]any{"score": score, "story_authors": "Fixture writer", "story_tags": []string{"Science"}, "story_hash": hash, "story_title": fmt.Sprintf("Fixture story %d", i), "story_permalink": "https://publisher.invalid/article", "story_feed_id": 1, "story_content": content, "image_urls": images, "secure_image_urls": map[string]string{source: secure}, "secure_image_thumbnails": map[string]string{source: signed(source, "192,")}, "read_status": read, "story_timestamp": "1794528000"})
			}
			reply(map[string]any{"stories": stories})
		case r.URL.Path == "/rss_feeds/original_text":
			if mode == "text-fail" {
				reply(map[string]any{"failed": true})
				return
			}
			source := "http://publisher.invalid/picture0.png?size=large&v=1"
			reply(map[string]any{"story_hash": r.URL.Query().Get("story_hash"), "failed": false, "original_text": "<p>Complete article from NewsBlur.</p><figure><img src=\"" + source + "\" alt=\"Synthetic landscape\"><figcaption>Synthetic landscape. Credit: Fixture photographer.</figcaption></figure>" + strings.Repeat("<p>More synthetic article text for scrolling.</p>", 60), "secure_image_urls": map[string]string{source: signed(source, "")}})
		case r.URL.Path == "/reader/mark_story_hashes_as_read":
			r.ParseForm()
			if mode == "read-fail" {
				http.Error(w, "unavailable", 503)
				return
			}
			reads[r.Form.Get("story_hash")] = true
			reply(map[string]int{"code": 1})
		case strings.HasPrefix(r.URL.Path, "/imageproxy/"):
			imageRequests++
			if mode == "image-invalid" {
				w.Header().Set("Content-Type", "image/png")
				w.Write([]byte("<html>Upstream error disguised as a picture</html>"))
				return
			}
			if mode == "images-fail" {
				http.Error(w, "unavailable", 404)
				return
			}
			value := r.URL.RequestURI()
			parts := strings.SplitN(strings.TrimPrefix(value, "/imageproxy/"), "/", 2)
			if len(parts) != 2 || (value != signed(parts[1], "") && value != signed(parts[1], "192,")) {
				http.Error(w, "signature", 403)
				return
			}
			w.Header().Set("Content-Type", "image/png")
			if mode == "portrait-lead" {
				w.Write(portraitPicture)
			} else {
				w.Write(picture)
			}
		default:
			http.NotFound(w, r)
		}
	})
	server := &http.Server{Addr: ":8443", Handler: handler, ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 10 * time.Second, WriteTimeout: 10 * time.Second}
	log.Fatal(server.ListenAndServeTLS("/fixture-ca/ca.pem", "/fixture-ca/key.pem"))
}
