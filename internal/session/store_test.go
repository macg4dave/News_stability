package session

import (
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"newsstability/internal/newsblur"
)

func TestExpiryCapacityAndRotation(t *testing.T) {
	store, _ := New(1)
	old, err := store.Create()
	if err != nil {
		t.Fatal(err)
	}
	if _, err := store.Create(); err != ErrFull {
		t.Fatalf("capacity error = %v", err)
	}
	client, _ := newsblur.New("https://synthetic.invalid")
	auth, ok := store.Authenticate(old.ID, "fixture", client, false)
	if !ok || auth.ID == old.ID || auth.CSRF == old.CSRF || auth.Username != "fixture" {
		t.Fatal("login did not rotate identity")
	}
	if _, ok := store.Get(old.ID); ok {
		t.Fatal("anonymous ID survived authentication")
	}
	if auth.Expires.Sub(time.Now()) < 7*time.Hour {
		t.Fatal("incorrect authenticated lifetime")
	}
	store.mu.Lock()
	auth.Expires = time.Now().Add(-time.Second)
	store.entries[auth.ID] = auth
	store.mu.Unlock()
	if _, ok := store.Get(auth.ID); ok {
		t.Fatal("expired session still accessible")
	}
	if _, ok := store.Authenticate(auth.ID, "fixture", client, false); ok {
		t.Fatal("expired session resurrected")
	}
	if _, err := store.Create(); err != nil {
		t.Fatal("expiry did not release capacity")
	}
}

func TestOnlyOneConcurrentLoginCanReplaceSession(t *testing.T) {
	store, _ := New(1)
	old, _ := store.Create()
	client, _ := newsblur.New("https://synthetic.invalid")
	var winners atomic.Int32
	var group sync.WaitGroup
	for range 20 {
		group.Go(func() {
			if _, ok := store.Authenticate(old.ID, "fixture", client, false); ok {
				winners.Add(1)
			}
		})
	}
	group.Wait()
	if winners.Load() != 1 {
		t.Fatalf("login winners = %d", winners.Load())
	}
}

func TestDeletedAndExpiredAnonymousSessionsCannotLogin(t *testing.T) {
	for _, scenario := range []string{"deleted", "expired"} {
		t.Run(scenario, func(t *testing.T) {
			store, _ := New(1)
			e, _ := store.Create()
			client, _ := newsblur.New("https://synthetic.invalid")
			if scenario == "deleted" {
				store.Delete(e.ID)
			} else {
				store.mu.Lock()
				e.Expires = time.Now().Add(-time.Second)
				store.entries[e.ID] = e
				store.mu.Unlock()
			}
			if _, ok := store.Authenticate(e.ID, "fixture", client, false); ok {
				t.Fatal("stale session authenticated")
			}
			if _, err := store.Create(); err != nil {
				t.Fatal("stale entry did not release capacity")
			}
		})
	}
}
