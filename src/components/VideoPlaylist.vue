<template>
    <div style="height:100vh; display:flex; flex-direction:column; background:#fff;">

        <!-- ── Logo Header ────────────────────────────────────────────────────── -->
        <div class="logoHeader">
            <img src="/Image/bma-logo.png" alt="Logo" class="logo" />
            <span class="textLogo">Baliwag Maritime Academy</span>
            <span class="textDesc">Knowledge · Discipline · Excellence</span>
        </div>

        <!-- ── Video Player ───────────────────────────────────────────────────── -->
        <div class="videoPlayer">

            <!-- YouTube: div target for IFrame API -->
            <div
                v-if="currentItem && currentItem.type === 'youtube'"
                :key="'yt-' + currentIndex"
                id="yt-player"
                style="height:100%; width:100%;"
            ></div>

            <!-- GDrive: iframe, src already resolved in queue -->
            <iframe
                v-else-if="currentItem && currentItem.type === 'gdrive'"
                :key="'gd-' + currentIndex"
                :src="currentItem.embedUrl"
                style="height:100%; width:100%; border:none; background:#000;"
                allow="autoplay; fullscreen"
                allowfullscreen
            ></iframe>

            <!-- Direct mp4/webm: native video tag -->
            <video
                v-else-if="currentItem && currentItem.type === 'direct'"
                :key="'dv-' + currentIndex"
                ref="nativePlayer"
                style="height:100%; width:100%; object-fit:contain; background:#000;"
                autoplay
                :src="currentItem.url"
                @ended="playNext"
                @timeupdate="onNativeTimeUpdate"
                @loadedmetadata="onNativeMetadata"
            ></video>

            <!-- Loading overlay -->
            <div v-if="loading" class="loading">
                <p style="color:white; font-size:1rem;">Loading...</p>
            </div>

            <!-- Now Playing Info -->
            <div v-if="currentItem" class="nowPlaying">
                🎬 {{ currentItem.title }}
                &nbsp;|&nbsp; {{ currentTimeDisplay }} / {{ durationDisplay }}
                &nbsp;|&nbsp; {{ currentIndex + 1 }} / {{ queue.length }}
                &nbsp;|&nbsp; {{ currentItem.type === 'youtube' ? 'YouTube' : currentItem.type === 'gdrive' ? 'Google Drive' : 'Direct' }}
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
            queue: [],
            currentIndex: 0,

            player: null,
            apiReady: false,

            currentTime: 0,
            duration: 0,

            timePollingInterval: null,
            gdriveTimer: null,
            gdriveStartTime: null,
            refreshTimer: null,
            clockTimer: null,

            loading: true,
            currentTime_clock: new Date(),
        }
    },

    computed: {
        currentItem() {
            return this.queue[this.currentIndex] || null
        },

        currentTimeDisplay() { return this.formatTime(this.currentTime) },
        durationDisplay()    { return this.formatTime(this.duration) },

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
            const h = this.currentTime_clock.getHours()
            if (h < 12) return 'GOOD MORNING'
            if (h < 18) return 'GOOD AFTERNOON'
            return 'GOOD EVENING'
        }
    },

    watch: {
        playList: {
            immediate: true,
            handler(newVal) {
                console.log('[playList watcher] received:', newVal)
                if (newVal && newVal.length > 0) {
                    this.buildQueue(newVal)
                } else {
                    console.warn('[playList watcher] Playlist empty or not loaded yet')
                }
            }
        }
    },

    mounted() {
        const saved = localStorage.getItem("playIndex")
        if (saved !== null) {
            this.currentIndex = Number(saved)
            console.log(`[Mounted] Restored index: ${saved}`)
        }

        this.clockTimer = setInterval(() => {
            this.currentTime_clock = new Date()
        }, 1000)

        this.startRefreshInterval()
    },

    beforeUnmount() {
        this.stopAll()
        clearInterval(this.refreshTimer)
        clearInterval(this.clockTimer)
    },

    methods: {

        // ── Queue Builder ────────────────────────────────────────

        buildQueue(list) {
            this.queue = list.map(item => {
                const type = this.resolveType(item.url)
                const embedUrl = type === 'gdrive'
                    ? this.buildGDriveEmbedUrl(item.url)
                    : null

                console.log(`[buildQueue] "${item.title}" → type: ${type}`)

                return {
                    type,
                    title:    item.title,
                    url:      item.url,
                    embedUrl,
                    duration: Number(item.duration) || 0,
                }
            })

            console.log(`[buildQueue] ${this.queue.length} item(s) ready:`, this.queue)

            // Clamp restored index
            if (this.currentIndex >= this.queue.length) {
                console.warn(`[buildQueue] Index ${this.currentIndex} out of range — reset to 0`)
                this.currentIndex = 0
                localStorage.setItem("playIndex", 0)
            }

            this.$nextTick(() => this.playItem(this.currentIndex))
        },

        // ── Type Resolution ──────────────────────────────────────

        resolveType(url) {
            if (!url) return 'direct'
            if (/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)/.test(url)) return 'youtube'
            if (/drive\.google\.com/.test(url)) return 'gdrive'
            return 'direct'
        },

        buildGDriveEmbedUrl(url) {
            if (!url) return ''
            const fileMatch = url.match(/\/file\/d\/([^/?\s]+)/)
            if (fileMatch) return `https://drive.google.com/file/d/${fileMatch[1]}/preview`
            const idMatch = url.match(/[?&]id=([^&\s]+)/)
            if (idMatch) return `https://drive.google.com/file/d/${idMatch[1]}/preview`
            console.warn('[buildGDriveEmbedUrl] Could not extract ID from:', url)
            return ''
        },

        // ── Play Item ────────────────────────────────────────────

        playItem(index) {
            // Stop all running players first
            this.stopAll()

            this.currentIndex = index
            this.currentTime  = 0
            this.duration     = 0
            this.loading      = true

            const item = this.queue[index]
            if (!item) {
                console.warn('[playItem] No item at index', index)
                return
            }

            console.log(`[playItem] #${index + 1} type: ${item.type} | "${item.title}"`)

            this.$nextTick(() => {
                if (item.type === 'youtube') {
                    this.initYouTube(item)

                } else if (item.type === 'gdrive') {
                    this.loading = false
                    this.startGDriveTimer(item)

                } else if (item.type === 'direct') {
                    this.loading = false
                    this.$nextTick(() => {
                        const v = this.$refs.nativePlayer
                        if (v) {
                            v.play().catch(err =>
                                console.warn('[playItem direct] Autoplay blocked:', err)
                            )
                        }
                    })
                }
            })
        },

        // ── Stop Everything ──────────────────────────────────────

        stopAll() {
            // YouTube
            clearInterval(this.timePollingInterval)
            this.timePollingInterval = null
            if (this.player) {
                try { this.player.stopVideo(); this.player.destroy() } catch (e) {}
                this.player   = null
                this.apiReady = false
            }

            // GDrive
            clearInterval(this.gdriveTimer)
            this.gdriveTimer     = null
            this.gdriveStartTime = null

            // Native video
            const v = this.$refs.nativePlayer
            if (v) { try { v.pause(); v.src = '' } catch (e) {} }
        },

        // ── YouTube ──────────────────────────────────────────────

        initYouTube(item) {
            const videoId = this.extractYouTubeId(item.url)
            if (!videoId) {
                console.warn('[initYouTube] Bad URL:', item.url)
                this.playNext()
                return
            }

            const mount = () => {
                if (this.currentItem?.url !== item.url) {
                    console.warn('[initYouTube] Item changed before mount — aborting')
                    return
                }

                console.log(`[initYouTube] Mounting player for "${item.title}" | id: ${videoId}`)

                this.player = new YT.Player('yt-player', {
                    videoId,
                    playerVars: { autoplay: 1, origin: window.location.origin },
                    events: {
                        onReady: (e) => {
                            this.loading  = false
                            this.duration = Math.floor(e.target.getDuration())
                            console.log(`[YT onReady] "${item.title}" | duration: ${this.duration}s`)
                            this.startYouTubePolling()
                        },
                        onStateChange: (e) => {
                            const labels = { '-1':'unstarted', 0:'ended', 1:'playing', 2:'paused', 3:'buffering', 5:'cued' }
                            console.log(`[YT state] ${labels[e.data] || e.data}`)
                            if (e.data === YT.PlayerState.ENDED) this.playNext()
                        }
                    }
                })
            }

            if (window.YT && window.YT.Player) {
                mount()
            } else {
                // Inject API script once
                if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
                    const tag = document.createElement('script')
                    tag.src = 'https://www.youtube.com/iframe_api'
                    document.body.appendChild(tag)
                }
                window.onYouTubeIframeAPIReady = mount
            }
        },

        startYouTubePolling() {
            clearInterval(this.timePollingInterval)
            this.timePollingInterval = setInterval(() => {
                if (!this.player?.getCurrentTime) return
                this.currentTime = Math.floor(this.player.getCurrentTime())
                if (this.duration === 0) {
                    const dur = this.player.getDuration?.()
                    if (dur > 0) this.duration = Math.floor(dur)
                }
            }, 1000)
        },

        // ── GDrive ───────────────────────────────────────────────

        startGDriveTimer(item) {
            this.duration        = item.duration || 0
            this.gdriveStartTime = Date.now()

            console.log(`[GDrive] "${item.title}" | duration: ${this.duration}s`)

            clearInterval(this.gdriveTimer)
            this.gdriveTimer = setInterval(() => {
                if (!this.gdriveStartTime) return
                const elapsed = Math.floor((Date.now() - this.gdriveStartTime) / 1000)
                this.currentTime = elapsed

                // ✅ Auto advance when duration is set and elapsed time reached it
                if (this.duration > 0 && elapsed >= this.duration) {
                    console.log(`[GDrive] ${this.duration}s elapsed — auto advance`)
                    clearInterval(this.gdriveTimer)
                    this.playNext()
                }
            }, 1000)
        },

        // ── Direct / Native ──────────────────────────────────────

        onNativeTimeUpdate() {
            const v = this.$refs.nativePlayer
            if (v) this.currentTime = Math.floor(v.currentTime)
        },

        onNativeMetadata() {
            const v = this.$refs.nativePlayer
            if (v) {
                this.duration = Math.floor(v.duration)
                this.loading  = false
                console.log(`[Native] "${this.currentItem?.title}" | duration: ${this.duration}s`)
            }
        },

        // ── Playlist Controls ────────────────────────────────────

        playNext() {
            if (!this.queue.length) return

            this.$emit('video-ended')

            const next = (this.currentIndex + 1) % this.queue.length
            console.log(`[playNext] ${this.currentIndex + 1} → ${next + 1} of ${this.queue.length}`)
            localStorage.setItem("playIndex", next)

            this.playItem(next)
        },

        // ── Helpers ──────────────────────────────────────────────

        extractYouTubeId(url) {
            if (!url) return null
            const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([^?&]+)/)
            return m ? m[1] : null
        },

        formatTime(sec) {
            const s = Math.floor(sec)
            const m = Math.floor(s / 60)
            const h = Math.floor(m / 60)
            if (h > 0) return `${String(h).padStart(2,'0')}:${String(m%60).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`
            return `${String(m).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`
        },

        startRefreshInterval() {
            this.refreshTimer = setInterval(() => {
                console.log(`[Refresh] ${this.queue.length} item(s) | now: "${this.currentItem?.title}"`)
            }, 60 * 60 * 1000)
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