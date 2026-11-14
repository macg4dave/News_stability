// Package session owns bounded, in-memory reader sessions.
package session

import (
	"crypto/rand"
	"errors"
	"sync"
	"time"

	"newsstability/internal/newsblur"
)

const (
	anonymousTTL     = 15 * time.Minute
	authenticatedTTL = 8 * time.Hour
	rememberedTTL    = 30 * 24 * time.Hour
)

// ErrFull means the reader cannot accept another session at present.
var ErrFull = errors.New("reader session capacity reached")

// Entry is an immutable session snapshot. Upstream cookies stay on the server.
type Entry struct {
	ID       string
	CSRF     string
	Username string
	Remember bool
	Expires  time.Time
	Client   *newsblur.Client
}

// Store bounds session memory and expires entries without a background worker.
// Restarting the process signs all readers out.
type Store struct {
	mu       sync.Mutex
	entries  map[string]Entry
	capacity int
}

// New creates a store with a positive maximum number of active sessions.
func New(capacity int) (*Store, error) {
	if capacity < 1 {
		return nil, errors.New("session capacity must be positive")
	}
	return &Store{entries: make(map[string]Entry), capacity: capacity}, nil
}

// Get returns an unexpired session; it never extends the absolute lifetime.
func (s *Store) Get(id string) (Entry, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	e, ok := s.entries[id]
	if ok && !time.Now().Before(e.Expires) {
		delete(s.entries, id)
		return Entry{}, false
	}
	return e, ok
}

// Create issues an anonymous session for a login form and CSRF token.
func (s *Store) Create() (Entry, error) {
	e := Entry{ID: rand.Text(), CSRF: rand.Text(), Expires: time.Now().Add(anonymousTTL)}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.prune(time.Now())
	if len(s.entries) >= s.capacity {
		return Entry{}, ErrFull
	}
	s.entries[e.ID] = e
	return e, nil
}

// Authenticate replaces an anonymous session, rotating both session ID and CSRF
// token. Remembered sessions have a 30-day absolute lifetime. A stale or concurrently replaced login cannot resurrect an old session.
func (s *Store) Authenticate(id, username string, client *newsblur.Client, remember bool) (Entry, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	old, ok := s.entries[id]
	if !ok || !time.Now().Before(old.Expires) || old.Client != nil || client == nil {
		return Entry{}, false
	}
	lifetime := authenticatedTTL
	if remember {
		lifetime = rememberedTTL
	}
	e := Entry{ID: rand.Text(), CSRF: rand.Text(), Username: username, Client: client, Remember: remember, Expires: time.Now().Add(lifetime)}
	delete(s.entries, id)
	s.entries[e.ID] = e
	return e, true
}

// Delete invalidates a local session, regardless of upstream availability.
func (s *Store) Delete(id string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.entries, id)
}

func (s *Store) prune(now time.Time) {
	for id, e := range s.entries {
		if !now.Before(e.Expires) {
			delete(s.entries, id)
		}
	}
}
