package httpserver_test

import (
	"encoding/json"
	"fmt"
	"net/http"
	"reflect"
	"sync/atomic"
	"testing"
)

func TestRiverResolvesSubscriptionsAndNestedFolders(t *testing.T) {
	var calls atomic.Int32
	var gotFeeds []string
	reader, client, _ := loggedInReader(t, func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/reader/feeds":
			fmt.Fprint(w, `{"feeds":{"1":{"feed_title":"One"},"2":{"feed_title":"Two"},"3":{"feed_title":"Three"}},"folders":[{"Reading":[1,{"Science":[2,1,99]}]},3,{"Empty":[]}]}`)
		case "/reader/river_stories":
			calls.Add(1)
			if err := r.ParseForm(); err != nil {
				t.Error(err)
			}
			gotFeeds = r.Form["feeds"]
			if r.Method != "POST" || r.Header.Get("X-CSRFToken") != "fixture-csrf" || r.Form.Get("order") != "newest" || r.Form.Get("read_filter") != "all" || r.Form.Has("query") {
				t.Error("wrong river contract")
			}
			fmt.Fprint(w, `{"stories":[{"story_hash":"2:abc","story_feed_id":2,"story_title":"A story"}]}`)
		default:
			t.Errorf("unexpected request %s", r.URL.Path)
			w.WriteHeader(404)
		}
	})
	for _, tc := range []struct {
		path string
		ids  []string
	}{
		{"/api/river", []string{"1", "3", "2"}},
		{"/api/river?folder=0&folder_title=Reading", []string{"1", "2"}},
		{"/api/river?folder=0/1&folder_title=Science", []string{"2", "1"}},
	} {
		response, err := client.Get(reader.URL + tc.path)
		if err != nil {
			t.Fatal(err)
		}
		var result struct {
			Stories []struct {
				FeedTitle string `json:"feed_title"`
			}
			CanContinue bool `json:"can_continue"`
		}
		err = json.NewDecoder(response.Body).Decode(&result)
		response.Body.Close()
		if err != nil || response.StatusCode != 200 || !reflect.DeepEqual(gotFeeds, tc.ids) || len(result.Stories) != 1 || result.Stories[0].FeedTitle != "Two" || !result.CanContinue {
			t.Fatalf("invalid collection response: status %d, feeds %v, result %+v, err %v", response.StatusCode, gotFeeds, result, err)
		}
	}
	before := calls.Load()
	for _, path := range []string{"/api/river?folder=1", "/api/river?folder=0/99", "/api/river?folder=0&folder_title=Renamed", "/api/river?page=401", "/api/river?read_filter=bad", "/api/river?query=removed"} {
		response, err := client.Get(reader.URL + path)
		if err != nil {
			t.Fatal(err)
		}
		response.Body.Close()
		if response.StatusCode != 400 {
			t.Errorf("invalid collection HTTP %d", response.StatusCode)
		}
	}
	response, err := client.Get(reader.URL + "/api/river?folder=2&folder_title=Empty")
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	var empty struct {
		Stories     []any
		CanContinue bool `json:"can_continue"`
	}
	if json.NewDecoder(response.Body).Decode(&empty) != nil || response.StatusCode != 200 || len(empty.Stories) != 0 || empty.CanContinue {
		t.Fatal("empty folder must not read all subscriptions")
	}
	if calls.Load() != before {
		t.Fatal("invalid or empty collection reached the river")
	}
}

func TestFocusSkipsNeutralPagesWithoutEndingStream(t *testing.T) {
	reader, client, _ := loggedInReader(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/reader/feed/1" || r.URL.Query().Get("read_filter") != "unread" {
			t.Error("Focus must read upstream unread stories")
		}
		switch r.URL.Query().Get("page") {
		case "1":
			fmt.Fprint(w, `{"stories":[{"story_hash":"1:neutral","score":0},{"story_hash":"1:hidden","score":-1}]}`)
		case "2":
			fmt.Fprint(w, `{"stories":[{"story_hash":"1:focus","score":1,"story_tags":["Science"]}]}`)
		case "3":
			fmt.Fprint(w, `{"stories":[]}`)
		default:
			fmt.Fprint(w, `{"stories":[{"story_hash":"1:legacy"}]}`)
		}
	})
	for _, tc := range []struct {
		page, count int
		more        bool
		status      int
	}{{1, 0, true, 200}, {2, 1, true, 200}, {3, 0, false, 200}, {4, 0, false, 502}} {
		response, err := client.Get(fmt.Sprintf("%s/api/feeds/1/stories?read_filter=focus&page=%d", reader.URL, tc.page))
		if err != nil {
			t.Fatal(err)
		}
		var result struct {
			Stories []struct {
				Hash string
				Tags []string
			}
			CanContinue bool `json:"can_continue"`
			Code        string
		}
		err = json.NewDecoder(response.Body).Decode(&result)
		response.Body.Close()
		if err != nil || response.StatusCode != tc.status || len(result.Stories) != tc.count || result.CanContinue != tc.more {
			t.Fatalf("Focus page %d: status %d, result %+v, err %v", tc.page, response.StatusCode, result, err)
		}
		if tc.page == 2 && (result.Stories[0].Hash != "1:focus" || !reflect.DeepEqual(result.Stories[0].Tags, []string{"Science"})) {
			t.Fatal("Focus story or topics lost")
		}
		if tc.page == 4 && result.Code != "focus_unavailable" {
			t.Fatal("missing intelligence silently accepted")
		}
	}
}

func TestRiverExplainsAccountAndPageLimits(t *testing.T) {
	reader, client, _ := loggedInReader(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/reader/feeds" {
			fmt.Fprint(w, `{"feeds":{"1":{"feed_title":"One"}},"folders":[1]}`)
			return
		}
		if r.URL.Path != "/reader/river_stories" {
			t.Errorf("unexpected request %s", r.URL.Path)
		}
		r.ParseForm()
		if r.Form.Get("page") == "400" {
			fmt.Fprint(w, `{"stories":[],"hidden_stories_removed":2}`)
			return
		}
		fmt.Fprint(w, `{"stories":[],"message":"The full River of News is a premium feature."}`)
	})
	for _, tc := range []struct {
		path                  string
		limited, limitReached bool
	}{{"/api/river", true, false}, {"/api/river?page=400", false, true}} {
		response, err := client.Get(reader.URL + tc.path)
		if err != nil {
			t.Fatal(err)
		}
		var result struct {
			Limited      bool
			LimitReached bool `json:"limit_reached"`
			CanContinue  bool `json:"can_continue"`
		}
		err = json.NewDecoder(response.Body).Decode(&result)
		response.Body.Close()
		if err != nil || response.StatusCode != 200 || result.Limited != tc.limited || result.LimitReached != tc.limitReached || result.CanContinue {
			t.Fatalf("invalid limit state: %+v, status %d, err %v", result, response.StatusCode, err)
		}
	}
}
