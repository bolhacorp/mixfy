const express = require('express');
const session = require('express-session');
const SpotifyWebApi = require('spotify-web-api-node');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();
const port = 3000;

// Middlewares
app.use(express.json());
app.use(express.static('public'));
app.use(session({
  secret: process.env.SESSION_SECRET || 'default_session_secret',
  resave: false,
  saveUninitialized: true
}));

// Spotify API Setup
const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  redirectUri: 'http://3.235.50.179:3000/callback'
});

// Middleware para verificar o token
const checkToken = (req, res, next) => {
  if (!req.session.accessToken) {
    return res.status(401).json({ error: 'No token, please login' });
  }
  spotifyApi.setAccessToken(req.session.accessToken);
  next();
};

// Rotas
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', (req, res) => {
  const scopes = ['playlist-read-private', 'playlist-modify-private', 'playlist-modify-public'];
  res.redirect(spotifyApi.createAuthorizeURL(scopes));
});

app.get('/callback', async (req, res) => {
  const { code } = req.query;
  try {
    const data = await spotifyApi.authorizationCodeGrant(code);
    req.session.accessToken = data.body.access_token;
    req.session.refreshToken = data.body.refresh_token;
    res.redirect('/');
  } catch (err) {
    console.error('Erro no callback:', err);
    res.status(500).send('Error getting Tokens');
  }
});

app.get('/api/playlists', checkToken, async (req, res) => {
  try {
    const data = await spotifyApi.getUserPlaylists();
    res.json(data.body.items);
  } catch (err) {
    console.error('Erro ao obter playlists:', err);
    res.status(err.statusCode === 401 ? 401 : 500).json({ error: 'Erro ao obter playlists', details: err.message });
  }
});

app.get('/api/playlist/:playlistId/tracks', checkToken, async (req, res) => {
  try {
    const playlistId = req.params.playlistId;
    const tracks = await getPlaylistTracks(playlistId);
    const trackIds = tracks.map(track => track.id);
    const audioFeatures = await getTrackFeatures(trackIds);

    const tracksWithFeatures = tracks.map(track => {
      const features = audioFeatures.find(f => f && f.id === track.id) || {};
      return {
        id: track.id,
        name: track.name,
        artists: track.artists.map(artist => artist.name).join(', '),
        album: track.album.name,
        image: track.album.images[0]?.url,
        popularity: track.popularity,
        uri: track.uri,
        duration_ms: track.duration_ms,
        ...features
      };
    });

    res.json(tracksWithFeatures);
  } catch (err) {
    console.error('Erro ao obter faixas da playlist:', err);
    res.status(500).json({ error: 'Erro ao obter faixas da playlist', details: err.message });
  }
});

app.get('/api/artists/:id', checkToken, async (req, res) => {
  try {
    const artistData = await spotifyApi.getArtist(req.params.id);
    res.json({ genres: artistData.body.genres.length ? artistData.body.genres : ['Gênero desconhecido'] });
  } catch (err) {
    console.error('Erro ao obter gênero do artista:', err);
    res.status(500).json({ error: 'Erro ao obter gênero do artista' });
  }
});

app.post('/api/reorganize', checkToken, async (req, res) => {
  try {
    const { tracks, blocks, newPlaylistName } = req.body;

    if (!tracks?.length || !blocks?.length || !newPlaylistName) {
      return res.status(400).json({ error: 'Invalid input data' });
    }

    const user = await spotifyApi.getMe();
    let playlistDescription = generatePlaylistDescription(blocks);
    if (playlistDescription.length > 300) {
      playlistDescription = `${playlistDescription.substring(0, 297)}...`;
    }

    const newPlaylist = await spotifyApi.createPlaylist(user.body.id, {
      name: newPlaylistName,
      description: playlistDescription,
      public: false
    });

    for (let i = 0; i < tracks.length; i += 100) {
      const batch = tracks.slice(i, i + 100);
      await spotifyApi.addTracksToPlaylist(newPlaylist.body.id, batch);
    }

    res.json({ success: true, playlistId: newPlaylist.body.id });
  } catch (err) {
    console.error('Erro ao reorganizar playlist:', err);
    res.status(500).json({ error: err.message });
  }
});

// Funções auxiliares
async function getPlaylistTracks(playlistId) {
  let tracks = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    try {
      const data = await spotifyApi.getPlaylistTracks(playlistId, {
        offset,
        limit,
        fields: 'items(track(id,name,artists,album,popularity,uri,duration_ms)),next'
      });
      tracks = tracks.concat(data.body.items.map(item => item.track));
      if (!data.body.next) break;
      offset += limit;
    } catch (err) {
      console.error('Erro ao obter faixas da playlist:', err);
      throw err;
    }
  }

  return tracks;
}

async function getTrackFeatures(trackIds) {
  const chunks = [];
  for (let i = 0; i < trackIds.length; i += 100) {
    chunks.push(trackIds.slice(i, i + 100));
  }

  let allFeatures = [];
  for (const chunk of chunks) {
    const features = await spotifyApi.getAudioFeaturesForTracks(chunk);
    allFeatures = allFeatures.concat(features.body.audio_features);
  }

  return allFeatures;
}

function generatePlaylistDescription(blocks) {
  return blocks.map((block, index) => {
    const dimensions = block.dimensions.map(dim => `${dim.dimension}(${dim.order})`).join(', ');
    return `B${index + 1}(${block.duration}h): ${dimensions}`;
  }).join('. ');
}

// Inicializar servidor
app.listen(port, () => {
  console.log(`App listening at http://3.235.50.179:${port}`);
});