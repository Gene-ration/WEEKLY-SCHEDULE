<template>
    <div style="height:100vh; width:100%; background:#000; padding:12px; box-sizing:border-box;">
        <div style="height:100%; width:100%; border-radius:16px; overflow:hidden; position:relative;">

            <!-- Always in DOM so YouTube can mount on it -->
            <div id="yt-player" style="height:100%; width:100%;"></div>

            <!-- Loading overlay on top -->
            <div v-if="loading"
                style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; background:#000;">
                <p style="color:white;">Loading playlist...</p>
            </div>

            <!-- Now Playing Info -->
            <div v-if="currentFile" style="position:absolute; bottom:16px; left:16px; background:rgba(0,0,0,0.6); color:white;
                padding:6px 12px; border-radius:8px; font-size:0.8rem;">
                🎬 {{ currentFile.title }} &nbsp;|&nbsp; {{ currentTimeDisplay }} / {{ durationDisplay }}
                &nbsp;|&nbsp; {{ currentVideoIndex + 1 }} / {{ playList.length }}
            </div>

        </div>
    </div>
</template>

<script>
export default {
    name: "VideoPlaylist",

    // Declares the event this component can emit to the parent
    emits: ['video-ended'],

    props: {
        playList: {
            type: Array,
            required: true
        }
    },

    data() {
        return {
            currentVideoIndex: 0,
            player: null,
            loading: true,
            refreshTimer: null,
            apiReady: false,
            currentTime: 0,            // current playback position in seconds
            duration: 0,               // total video duration in seconds
            timePollingInterval: null, // polls YouTube getCurrentTime every second
        }
    },

    computed: {
        currentFile() {
            return this.playList[this.currentVideoIndex] || null
        },
        // Formats currentTime into MM:SS or HH:MM:SS for display
        currentTimeDisplay() {
            return this.formatTime(this.currentTime)
        },
        // Formats duration into MM:SS or HH:MM:SS for display
        durationDisplay() {
            return this.formatTime(this.duration)
        },
    },

    watch: {
        // Fires immediately on mount and again whenever playList changes
        playList: {
            immediate: true,
            handler(newVal) {
                console.log('[playList watcher] received:', newVal)
                if (newVal && newVal.length > 0) {
                    console.log(`[playList watcher] ${newVal.length} video(s) loaded — starting YouTube API`)
                    this.$nextTick(() => {
                        this.loadYouTubeAPI()
                    })
                } else {
                    console.warn('[playList watcher] Playlist is empty or not yet loaded')
                }
            }
        }
    },

    mounted() {
        // Restore last played index from localStorage if available
        const savedIndex = localStorage.getItem("playIndex")
        if (savedIndex) {
            this.currentVideoIndex = Number(savedIndex)
            console.log(`[Mounted] Restored index from localStorage: ${savedIndex}`)
        } else {
            console.log('[Mounted] No saved index — starting from 0')
        }

        this.startRefreshInterval()
    },

    beforeUnmount() {
        clearInterval(this.refreshTimer)
        clearInterval(this.timePollingInterval)

        if (this.player) {
            this.player.destroy()
            console.log('[beforeUnmount] YouTube player destroyed')
        }
    },

    methods: {

        // ── YouTube API ──────────────────────────────────────────

        /* Loads the YouTube IFrame API script if not already loaded */
        loadYouTubeAPI() {
            if (!this.playList || this.playList.length === 0) {
                console.warn('[loadYouTubeAPI] Playlist is empty.')
                return
            }

            console.log(`[loadYouTubeAPI] ${this.playList.length} video(s) in playlist`, this.playList)

            // If API already loaded, go straight to init
            if (window.YT && window.YT.Player) {
                console.log('[loadYouTubeAPI] YouTube API already loaded — initializing player')
                this.apiReady = true
                this.initPlayer()
                return
            }

            // Inject YouTube IFrame API script into the page
            console.log('[loadYouTubeAPI] Injecting YouTube IFrame API script...')
            const tag = document.createElement("script")
            tag.src = "https://www.youtube.com/iframe_api"
            document.body.appendChild(tag)

            // Callback fired by YouTube when API is fully ready
            window.onYouTubeIframeAPIReady = () => {
                console.log('[onYouTubeIframeAPIReady] YouTube API is ready')
                this.apiReady = true
                this.initPlayer()
            }
        },

        /* Initializes the YouTube player on the #yt-player div */
        initPlayer() {
            if (!this.apiReady) {
                console.warn('[initPlayer] API not ready yet — aborting')
                return
            }
            if (!this.currentFile || !this.currentFile.url) {
                console.warn("[initPlayer] No video found in playlist.")
                return
            }
            if (this.player) {
                console.log('[initPlayer] Player already exists — skipping duplicate init')
                return
            }

            const firstVideoId = this.extractVideoId(this.currentFile.url)
            console.log(`[initPlayer] Starting video — title: "${this.currentFile.title}" | id: ${firstVideoId}`)

            if (!firstVideoId) {
                console.warn("[initPlayer] Invalid YouTube URL:", this.currentFile.url)
                return
            }

            this.player = new YT.Player("yt-player", {
                videoId: firstVideoId,
                playerVars: {
                    autoplay: 1,
                    /* mute: 1, */
                    origin: window.location.origin
                },
                events: {
                    onReady: (event) => {
                        this.loading = false
                        // Get total duration from YouTube player
                        this.duration = event.target.getDuration()
                        console.log(`[onReady] Player ready — title: "${this.currentFile.title}" | duration: ${this.duration}s (${Math.floor(this.duration / 60)}m ${Math.floor(this.duration % 60)}s)`)

                        // Poll currentTime every second — YouTube does not fire timeupdate events
                        clearInterval(this.timePollingInterval)
                        this.timePollingInterval = setInterval(() => {
                            if (this.player && this.player.getCurrentTime) {
                                this.currentTime = Math.floor(this.player.getCurrentTime())
                            }
                        }, 1000)
                    },
                    onStateChange: this.onPlayerStateChange
                }
            })
        },

        // ── Player Events ────────────────────────────────────────

        /* Fires when YouTube player state changes (playing, paused, ended, etc.) */
        onPlayerStateChange(event) {
            const states = { '-1': 'unstarted', 0: 'ended', 1: 'playing', 2: 'paused', 3: 'buffering', 5: 'cued' }
            console.log(`[onStateChange] State changed: ${states[event.data] || event.data}`)

            if (event.data === YT.PlayerState.ENDED) {
                this.playNext()
            }
        },

        // ── Playlist Controls ────────────────────────────────────

        /* Advances to the next video in the playlist, loops back to start at end */
        playNext() {
            if (!this.playList.length) return

            // Emit to parent (HomePage) — triggers showSplash() via @video-ended
            this.$emit('video-ended')
            console.log('[playNext] emitted video-ended to parent')

            // Reset time display and stop polling before switching video
            this.currentTime = 0
            this.duration = 0
            clearInterval(this.timePollingInterval)

            const prevIndex = this.currentVideoIndex
            this.currentVideoIndex = (this.currentVideoIndex + 1) % this.playList.length
            localStorage.setItem("playIndex", this.currentVideoIndex)

            const nextVideoId = this.extractVideoId(this.currentFile.url)
            console.log(`[playNext] ${prevIndex + 1} → ${this.currentVideoIndex + 1} of ${this.playList.length} | title: "${this.currentFile.title}" | id: ${nextVideoId}`)

            if (this.player && nextVideoId) {
                this.player.loadVideoById(nextVideoId)
            } else {
                console.warn('[playNext] Could not load next video — player or videoId missing')
            }
        },

        // ── Helpers ──────────────────────────────────────────────

        /* Extracts the YouTube video ID from various URL formats */
        extractVideoId(url) {
            if (!url) return null

            const regExp = /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([^?&]+)/
            const match = url.match(regExp)

            if (!match) {
                console.warn('[extractVideoId] Could not extract ID from URL:', url)
                return null
            }

            return match[1]
        },

        /* Formats seconds into MM:SS or HH:MM:SS for the time display */
        formatTime(seconds) {
            const s = Math.floor(seconds)
            const m = Math.floor(s / 60)
            const h = Math.floor(m / 60)
            if (h > 0) {
                return `${String(h).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
            }
            return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
        },

        /* Periodically logs playlist status — interval based on number of videos */
        startRefreshInterval() {
            const intervalMs = (60 * 60 * 1000) / (this.playList.length || 1)
            console.log(`[startRefreshInterval] Refresh interval set to every ${Math.round(intervalMs / 1000 / 60)} min`)

            this.refreshTimer = setInterval(() => {
                console.log(`[Refresh] Playlist active — ${this.playList.length} video(s) | now playing: "${this.currentFile?.title}"`)
            }, intervalMs)
        }
    }
}
</script>