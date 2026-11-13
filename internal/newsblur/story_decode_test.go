package newsblur

import "testing"

func TestPublicationTimestamp(t *testing.T) {
	for _, tc := range []struct {
		name, timestamp, want string
	}{
		{"quoted seconds", `"1704067200"`, "2024-01-01T00:00:00Z"},
		{"numeric seconds", `1704067200`, "2024-01-01T00:00:00Z"},
		{"fractional seconds", `"1704067200.5"`, "2024-01-01T00:00:00Z"},
		{"missing", `null`, ""},
		{"out of range", `"99999999999999999"`, ""},
	} {
		t.Run(tc.name, func(t *testing.T) {
			page, err := decodeStoryPage([]byte(`{"stories":[{"story_hash":"1:dated","story_date":"2024-01-01 00:00:00","story_timestamp":`+tc.timestamp+`}]}`), 1)
			if err != nil {
				t.Fatal(err)
			}
			if got := page.Stories[0].PublishedAt; got != tc.want {
				t.Fatalf("published_at = %q, want %q", got, tc.want)
			}
			if page.Stories[0].Date != "2024-01-01 00:00:00" {
				t.Fatal("legacy date must be preserved without assuming a timezone")
			}
		})
	}
}

func TestDecodePictureMetadata(t *testing.T) {
	result, err := decodeStoryPage([]byte(`{"stories":[{"story_hash":"1:photo","image_urls":["http://publisher.invalid/photo.jpg","https://publisher.invalid/second.jpg"],"secure_image_urls":{"http://publisher.invalid/photo.jpg":"https://images.invalid/signed.jpg"}},{"story_hash":"1:text"}]}`), 1)
	if err != nil {
		t.Fatal(err)
	}
	pictures := result.Stories[0].Pictures
	if len(pictures) != 3 || pictures[0] != "https://images.invalid/signed.jpg" || pictures[1] != "http://publisher.invalid/photo.jpg" || pictures[2] != "https://publisher.invalid/second.jpg" {
		t.Fatalf("wrong picture order: %v", pictures)
	}
	if len(result.Stories[1].Pictures) != 0 {
		t.Fatal("missing metadata must remain text-only")
	}
}
