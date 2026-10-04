import unittest
from unittest.mock import patch, Mock
from fastapi.testclient import TestClient
import app

class CatalogTests(unittest.TestCase):
    def test_duration_formats(self):
        for value, expected in [("213", 213), ("4:38",278), ("1:02:03",3723), (0,0), (None,None), ("bad",None)]:
            self.assertEqual(app.duration_to_sec(value), expected)

    def test_video_search_filters_and_duration(self):
        yt=Mock()
        yt.search.return_value=[{"resultType":"video","title":"Clip","videoId":"12345678901","duration_seconds":213},{"resultType":"album","title":"Album"}]
        with patch.object(app,"get_client",return_value=yt):
            result=TestClient(app.app).get("/ytm/search?q=test&filter=videos").json()["data"]
        self.assertEqual(len(result),1)
        self.assertEqual(result[0]["durationSec"],213)

    def test_artist_albums_passes_required_params(self):
        yt=Mock()
        yt.get_artist.return_value={"albums":{"browseId":"artist-id","params":"albums-token"}}
        yt.get_artist_albums.return_value=[]
        with patch.object(app,"get_client",return_value=yt): app.artist_albums("artist-id")
        yt.get_artist_albums.assert_called_once_with("artist-id","albums-token")

    def test_playlist_strips_browse_prefix(self):
        yt=Mock(); yt.get_playlist.return_value={"tracks":[]}
        with patch.object(app,"get_client",return_value=yt): app.playlist("VLPLtest")
        yt.get_playlist.assert_called_once_with("PLtest",limit=100)

if __name__ == "__main__": unittest.main()
