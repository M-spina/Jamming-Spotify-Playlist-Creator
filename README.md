# Jammming - Spotify Playlist Creator

A modern web application that allows users to search for songs on Spotify and create custom playlists that are saved directly to their Spotify account. Built with React and the Spotify Web API.

## 🚀 Features

- **Spotify Authentication** - Secure OAuth 2.0 with PKCE flow for client-side apps
- **Search Functionality** - Search for tracks from Spotify's vast music library
- **Custom Playlists** - Create and name your own playlists
- **Track Selection** - Add and remove tracks from your playlist
- **Visual Feedback** - See which tracks are already selected in your playlist
- **Save to Spotify** - Save your curated playlists directly to your Spotify account
- **Responsive Design** - Works seamlessly on desktop, tablet, and mobile devices
- **Modern UI** - Spotify-inspired dark theme with smooth animations and transitions

## 🛠️ Technologies Used

### Frontend
- **React** - UI component library
- **Vite** - Fast build tool and development server
- **JavaScript (ES6+)** - Modern JavaScript features

### APIs & Authentication
- **Spotify Web API** - Search tracks, create playlists, manage user data
- **OAuth 2.0 with PKCE** - Secure authentication flow for single-page applications

### Styling
- **CSS3** - Custom styling with CSS variables
- **CSS Grid & Flexbox** - Responsive layouts
- **CSS Transitions & Animations** - Smooth user interactions

### Architecture
- **Custom React Hooks** - `useAuth` for authentication, `useSpotify` for Spotify operations
- **Component-based Architecture** - Modular, reusable components
- **Unidirectional Data Flow** - Props-driven state management

## 📋 Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Spotify account
- Spotify Developer Application (for Client ID)

## 🔧 Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd Spotify-API-Project
```

2. Install dependencies:
```bash
npm install
```

3. Create a Spotify App:
   - Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
   - Create a new app
   - Add `http://127.0.0.1:5173/callback` to Redirect URIs
   - Copy your Client ID

4. Update the Client ID:
   - Open `src/utils/spotifyAuth.js`
   - Replace `CLIENT_ID` with your Spotify Client ID

5. Run the development server:
```bash
npm run dev
```

6. Open `http://127.0.0.1:5173` in your browser

## 🎯 Usage

1. **Login** - Click "Login with Spotify" to authenticate
2. **Search** - Enter a song name, artist, or album in the search bar
3. **Select Tracks** - Click "Select" on tracks you want to add to your playlist
4. **Build Playlist** - Selected tracks appear in the playlist section
5. **Name Playlist** - Edit the playlist name at the top of the playlist section
6. **Save** - Click "Save to Spotify" to create the playlist in your account
7. **Logout** - Click "Logout" when finished

## 📁 Project Structure

```
src/
├── hooks/
│   ├── useAuth.js          # Authentication state management
│   └── useSpotify.js       # Spotify API operations
├── utils/
│   ├── spotifyAuth.js      # OAuth PKCE authentication logic
│   └── spotifyApi.js       # Spotify API wrapper functions
├── components/
│   ├── SearchBar/          # Search input component
│   ├── SearchResults/      # Search results container
│   ├── Tracklist/          # Track list grid
│   ├── Track/              # Individual track card
│   └── Playlist/           # Playlist builder
├── App.jsx                 # Main application component
├── App.css                 # App-level styles
└── index.css               # Global styles and theme
```

## 🔐 Security

- Uses OAuth 2.0 Authorization Code Flow with PKCE
- No client secrets exposed in client-side code
- Secure token storage in localStorage
- Automatic token refresh on expiration
- HTTPS redirect URI validation

## 🌟 Future Work

### Planned Features
- [ ] Edit existing Spotify playlists
- [ ] Delete tracks from existing playlists
- [ ] Search filters (genre, year, popularity)
- [ ] Track preview/playback
- [ ] Drag-and-drop track reordering
- [ ] Dark/Light theme toggle
- [ ] Playlist templates/moods
- [ ] Batch track operations

### Enhancements
- [ ] Add loading skeletons
- [ ] Implement error boundaries
- [ ] Add unit and integration tests
- [ ] Improve accessibility (ARIA labels, keyboard navigation)
- [ ] Add pagination for search results
- [ ] Implement virtualization for large playlists


## 📝 License

This project is for educational purposes and uses the Spotify Web API.

## 🙏 Acknowledgments

- [Spotify Web API Documentation](https://developer.spotify.com/documentation/web-api)
- [Spotify Design Guidelines](https://developer.spotify.com/documentation/design)
- React and Vite communities
