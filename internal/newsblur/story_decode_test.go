package newsblur

import "testing"

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
