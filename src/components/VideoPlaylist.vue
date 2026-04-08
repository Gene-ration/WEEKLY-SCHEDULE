<template>
    <div style="height:100vh; display:flex; flex-direction:column; background:#fff;">

        <!-- ── Logo Header ────────────────────────────────────────────────────── -->
        <div class="logoHeader">
            <img src="/Image/bma-logo.png" alt="Logo" class="logo" />
            <span class="textLogo">Baliwag Maritime Academy</span>
            <span class="textDesc">Knowledge · Discipline · Excellence</span>
        </div>

        <!-- ── Video Player (fills remaining space) ───────────────────────────── -->
        <div class="videoPlayer">

            <!-- YouTube Player -->
            <div v-show="isYouTube" id="yt-player" style="height:100%; width:100%;"></div>

            <!--  Google Drive Player -->
            <iframe
                v-show="isGDrive"
                ref="gdrivePlayer"
                :src="gdriveActiveSrc"
                style="height:100%; width:100%; border:none; background:#000;"
                allow="autoplay; fullscreen"
                allowfullscreen
            ></iframe>

            <!-- Native Player (mp4 / webm / direct URLs) -->
            <video
                v-show="isDirectVideo"
                ref="nativePlayer"
                style="height:100%; width:100%; object-fit:contain; background:#000;"
                autoplay
                @ended="playNext"
                @timeupdate="onNativeTimeUpdate"
                @loadedmetadata="onNativeMetadata"
            ></video>

            <!-- Loading overlay -->
            <div v-if="loading" class="loading">
                <p style="color:white; font-size:1rem;">Loading playlist...</p>
            </div>

            <!-- Now Playing Info -->
            <div v-if="currentFile" class="nowPlaying">
                🎬 {{ currentFile.title }} &nbsp;|&nbsp; {{ currentTimeDisplay }} / {{ durationDisplay }}
                &nbsp;|&nbsp; {{ currentVideoIndex + 1 }} / {{ playList.length }}
                &nbsp;|&nbsp; {{ videoTypeLabel }}
            </div>

        </div>

        <!-- ── Date & Time Bar ───────────────────────────── -->
        <div class="dtBar">
            <div>
                <p class="dateStatus">{{ formattedDate }}</p>
                <p class="time">{{ formattedTime }}</p>
            </div>
            <p class="dateStatus">{{ timeStatus }}</p>
        </div>

    </div>
</template>

<script>
export default {
    name: "VideoPlaylist",

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
            currentTime: 0,
            duration: 0,
            timePollingInterval: null,
            lastVideoType: null,
            gdriveTimer: null,
            gdriveStartTime: null,
            gdriveActiveSrc: '',
            currentTime_clock: new Date(),
            clockTimer: null,
        }
    },

    computed: {
        currentFile() {
            return this.playList[this.currentVideoIndex] || null
        },

        isYouTube() {
            return this.detectVideoType(this.currentFile?.url) === 'youtube'
        },
        isGDrive() {
            return this.detectVideoType(this.currentFile?.url) === 'gdrive'
        },
        isDirectVideo() {
            return this.detectVideoType(this.currentFile?.url) === 'direct'
        },

        videoTypeLabel() {
            if (this.isYouTube) return 'YouTube'
            if (this.isGDrive) return 'Google Drive'
            return 'Direct'
        },

        currentTimeDisplay() {
            return this.formatTime(this.currentTime)
        },
        durationDisplay() {
            return this.formatTime(this.duration)
        },

        formattedDate() {
            return this.currentTime_clock.toLocaleDateString('en-US', {
                month: 'long', day: 'numeric', year: 'numeric'
            }).toUpperCase()
        },
        formattedTime() {
            return this.currentTime_clock.toLocaleTimeString('en-US', {
                hour: '2-digit', minute: '2-digit', hour12: true
            })
        },
        timeStatus() {
            const hour = this.currentTime_clock.getHours()
            if (hour < 12) return 'GOOD MORNING'
            if (hour < 18) return 'GOOD AFTERNOON'
            return 'GOOD EVENING'
        }
    },

    watch: {
        playList: {
            immediate: true,
            handler(newVal) {
                console.log('[playList watcher] received:', newVal)
                if (newVal && newVal.length > 0) {
                    console.log(`[playList watcher] ${newVal.length} video(s) loaded — starting player`)
                    this.$nextTick(() => this.loadCurrentVideo())
                } else {
                    console.warn('[playList watcher] Playlist is empty or not yet loaded')
                }
            }
        }
    },

    mounted() {
        const savedIndex = localStorage.getItem("playIndex")
        if (savedIndex !== null) {
            this.currentVideoIndex = Number(savedIndex)
            console.log(`[Mounted] Restored index from localStorage: ${savedIndex}`)
        } else {
            console.log('[Mounted] No saved index — starting from 0')
        }

        this.clockTimer = setInterval(() => {
            this.currentTime_clock = new Date()
        }, 1000)

        this.startRefreshInterval()
    },

    beforeUnmount() {
        clearInterval(this.refreshTimer)
        clearInterval(this.timePollingInterval)
        clearInterval(this.clockTimer)
        clearInterval(this.gdriveTimer)

        if (this.player) {
            this.player.destroy()
            console.log('[beforeUnmount] YouTube player destroyed')
        }
    },

    methods: {

        // ── Video Type Detection ─────────────────────────────────

        detectVideoType(url) {
            if (!url) return null
            if (/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)/.test(url)) return 'youtube'
            if (/drive\.google\.com/.test(url)) return 'gdrive'
            return 'direct'
        },

        extractGDriveId(url) {
            if (!url) return null
            const fileMatch = url.match(/\/file\/d\/([^/?\s]+)/)
            if (fileMatch) return fileMatch[1]
            const idMatch = url.match(/[?&]id=([^&\s]+)/)
            if (idMatch) return idMatch[1]
            console.warn('[extractGDriveId] Could not extract ID from URL:', url)
            return null
        },

        // ── Main Entry Point ─────────────────────────────────────

        loadCurrentVideo() {
            if (!this.playList || this.playList.length === 0) {
                console.warn('[loadCurrentVideo] Playlist is empty.')
                return
            }

            if (this.currentVideoIndex >= this.playList.length) {
                console.warn(`[loadCurrentVideo] Index ${this.currentVideoIndex} out of range — resetting to 0`)
                this.currentVideoIndex = 0
                localStorage.setItem("playIndex", 0)
            }

            const type = this.detectVideoType(this.currentFile?.url)
            console.log(`[loadCurrentVideo] type: ${type} | lastType: ${this.lastVideoType} | title: "${this.currentFile?.title}"`)

            this.stopAllPlayers(type)

            if (type === 'youtube') {
                this.loadYouTubeAPI()
            } else if (type === 'gdrive') {
                this.loadGDriveVideo()
            } else if (type === 'direct') {
                this.loadDirectVideo()
            } else {
                console.warn('[loadCurrentVideo] Unknown video type:', this.currentFile?.url)
            }

            this.lastVideoType = type
        },

        stopAllPlayers(incomingType) {
            this.stopNativePlayer()
            this.stopGDrivePlayer()

            if (this.lastVideoType === 'youtube' && incomingType !== 'youtube') {
                this.destroyYouTubePlayer()
            } else if (this.lastVideoType === 'youtube') {
                this.stopYouTubePlayer()
            }
        },

        // ── YouTube Player ───────────────────────────────────────

        loadYouTubeAPI() {
            if (window.YT && window.YT.Player) {
                this.apiReady = true
                this.initPlayer()
                return
            }

            const tag = document.createElement("script")
            tag.src = "https://www.youtube.com/iframe_api"
            document.body.appendChild(tag)

            window.onYouTubeIframeAPIReady = () => {
                console.log('[onYouTubeIframeAPIReady] YouTube API is ready')
                this.apiReady = true
                this.initPlayer()
            }
        },

        initPlayer() {
            if (!this.apiReady) return

            if (this.currentVideoIndex >= this.playList.length) {
                this.currentVideoIndex = 0
                localStorage.setItem("playIndex", 0)
            }

            if (!this.currentFile || !this.currentFile.url) {
                console.warn("[initPlayer] No video found in playlist.")
                return
            }

            const videoId = this.extractVideoId(this.currentFile.url)
            if (!videoId) {
                console.warn("[initPlayer] Invalid YouTube URL:", this.currentFile.url)
                return
            }

            if (this.player) {
                console.log('[initPlayer] Player already exists — loading new video')
                this.player.loadVideoById(videoId)
                this.loading = false
                this.waitForDurationAfterLoad()
                return
            }

            this.player = new YT.Player("yt-player", {
                videoId,
                playerVars: { autoplay: 1, origin: window.location.origin },
                events: {
                    onReady: (event) => {
                        this.loading = false
                        this.duration = event.target.getDuration()
                        console.log(`[onReady] title: "${this.currentFile?.title}" | duration: ${this.duration}s`)
                        this.startTimePolling()
                    },
                    onStateChange: this.onPlayerStateChange
                }
            })
        },

        waitForDurationAfterLoad() {
            clearInterval(this.timePollingInterval)
            let attempts = 0

            this.timePollingInterval = setInterval(() => {
                if (!this.player || !this.player.getDuration) return
                const dur = this.player.getDuration()
                attempts++

                if (dur > 0) {
                    this.duration = Math.floor(dur)
                    this.currentTime = Math.floor(this.player.getCurrentTime())
                    clearInterval(this.timePollingInterval)
                    this.startTimePolling()
                } else if (attempts >= 30) {
                    clearInterval(this.timePollingInterval)
                    this.startTimePolling()
                }
            }, 100)
        },

        startTimePolling() {
            clearInterval(this.timePollingInterval)
            this.timePollingInterval = setInterval(() => {
                if (this.player && this.player.getCurrentTime) {
                    this.currentTime = Math.floor(this.player.getCurrentTime())
                    if (this.duration === 0 && this.player.getDuration) {
                        const dur = this.player.getDuration()
                        if (dur > 0) this.duration = Math.floor(dur)
                    }
                }
            }, 1000)
        },

        onPlayerStateChange(event) {
            const states = { '-1': 'unstarted', 0: 'ended', 1: 'playing', 2: 'paused', 3: 'buffering', 5: 'cued' }
            console.log(`[onStateChange] ${states[event.data] || event.data}`)
            if (event.data === YT.PlayerState.ENDED) this.playNext()
        },

        stopYouTubePlayer() {
            clearInterval(this.timePollingInterval)
            if (this.player) {
                try { this.player.stopVideo(); this.player.mute() } catch (e) { }
            }
            this.currentTime = 0
            this.duration = 0
        },

        destroyYouTubePlayer() {
            clearInterval(this.timePollingInterval)
            if (this.player) {
                try { this.player.stopVideo(); this.player.destroy() } catch (e) { }
                this.player = null
                this.apiReady = false
            }
            this.currentTime = 0
            this.duration = 0
        },

        // ── Google Drive Player ──────────────────────────────────

        loadGDriveVideo() {
            const fileId = this.extractGDriveId(this.currentFile.url)

            if (!fileId) {
                console.warn('[loadGDriveVideo] Could not extract GDrive file ID')
                return
            }

            this.gdriveActiveSrc = `https://drive.google.com/file/d/${fileId}/preview`

            this.loading = false
            this.currentTime = 0
            this.duration = this.currentFile?.duration || 0

            console.log(`[loadGDriveVideo] title: "${this.currentFile?.title}" | src: ${this.gdriveActiveSrc} | duration: ${this.duration}s`)

            this.gdriveStartTime = Date.now()

            clearInterval(this.gdriveTimer)
            this.gdriveTimer = setInterval(() => {
                const elapsed = Math.floor((Date.now() - this.gdriveStartTime) / 1000)
                this.currentTime = elapsed

                // Auto-advance only when editor has set a duration
                if (this.duration > 0 && elapsed >= this.duration) {
                    console.log(`[GDrive] ${this.duration}s reached — advancing to next video`)
                    clearInterval(this.gdriveTimer)
                    this.playNext()
                }
            }, 1000)
        },

        stopGDrivePlayer() {
            clearInterval(this.gdriveTimer)
            this.gdriveTimer = null
            this.gdriveStartTime = null

            this.gdriveActiveSrc = ''

            this.currentTime = 0
            this.duration = 0
        },

        // ── Direct / Native Video Player ─────────────────────────

        loadDirectVideo() {
            this.$nextTick(() => {
                const video = this.$refs.nativePlayer
                if (!video) return
                console.log(`[loadDirectVideo] Loading: ${this.currentFile.url}`)
                video.src = this.currentFile.url
                video.load()
                video.play().catch(err => console.warn('[loadDirectVideo] Autoplay blocked:', err))
                this.loading = false
            })
        },

        stopNativePlayer() {
            const video = this.$refs.nativePlayer
            if (video) { video.pause(); video.src = '' }
            this.currentTime = 0
            this.duration = 0
        },

        onNativeTimeUpdate() {
            const video = this.$refs.nativePlayer
            if (video) this.currentTime = Math.floor(video.currentTime)
        },

        onNativeMetadata() {
            const video = this.$refs.nativePlayer
            if (video) {
                this.duration = Math.floor(video.duration)
                console.log(`[Native onMetadata] title: "${this.currentFile?.title}" | duration: ${this.duration}s`)
            }
        },

        // ── Playlist Controls ────────────────────────────────────

        playNext() {
            if (!this.playList.length) return

            this.$emit('video-ended')
            this.currentTime = 0
            this.duration = 0
            clearInterval(this.timePollingInterval)
            clearInterval(this.gdriveTimer)

            const prevIndex = this.currentVideoIndex
            this.currentVideoIndex = (this.currentVideoIndex + 1) % this.playList.length
            localStorage.setItem("playIndex", this.currentVideoIndex)

            console.log(`[playNext] ${prevIndex + 1} → ${this.currentVideoIndex + 1} of ${this.playList.length}`)
            this.loadCurrentVideo()
        },

        // ── Helpers ──────────────────────────────────────────────

        extractVideoId(url) {
            if (!url) return null
            const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([^?&]+)/)
            return match ? match[1] : null
        },

        formatTime(seconds) {
            const s = Math.floor(seconds)
            const m = Math.floor(s / 60)
            const h = Math.floor(m / 60)
            if (h > 0) return `${String(h).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
            return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
        },

        startRefreshInterval() {
            const intervalMs = (60 * 60 * 1000) / (this.playList.length || 1)
            this.refreshTimer = setInterval(() => {
                console.log(`[Refresh] ${this.playList.length} video(s) | now playing: "${this.currentFile?.title}"`)
            }, intervalMs)
        }
    }
}
</script>

<style scoped>
@font-face {
    font-family: 'AllrounderMonumentTest-Medium';
    src: url(./src/assets/AllrounderMonumentTest-Medium.otf) format('opentype');
    font-weight: normal;
    font-style: normal;
}

.logoHeader {
    flex-direction: column;
    background: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 10px 9px;
    border-bottom: 1px solid #e0e0e0;
}

.videoPlayer {
    flex-grow: 1;
    background: #000;
    position: relative;
    overflow: hidden;
}

.nowPlaying {
    position: absolute;
    bottom: 10px;
    left: 12px;
    background: rgba(0, 0, 0, 0.6);
    color: white;
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 0.75rem;
}

.loading {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #000;
}

.logo {
    width: 50px;
}

.textLogo {
    font-family: 'AllrounderMonumentTest-Medium', sans-serif;
    color: #00611E;
}

.textDesc {
    font-family: 'AllrounderMonumentTest-Medium', sans-serif;
    color: #00611E;
    font-size: 7px;
    letter-spacing: 0.1em;
    word-spacing: 2em;
    text-transform: uppercase;
}

.dtBar {
    font-family: 'DM Sans', sans-serif;
    font-weight: 700;
    background: #00611E;
    color: #fff;
    padding: 20px 20px;
    display: flex;
    align-items: normal;
    letter-spacing: 0.30em;
    justify-content: space-between;
}

.dateStatus {
    margin: 0;
    font-size: 0.9rem;
    letter-spacing: 1px;
}

.time {
    margin: 0;
    font-size: 2rem;
    line-height: 1.1;
}
</style>