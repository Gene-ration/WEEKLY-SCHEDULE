<template>
    <div class="d-flex flex-column" style="height:100vh; overflow:hidden; position:relative;">

        <!-- Background Image-->
        <div style="
            position:absolute;
            inset:0;
            background-image: url('/Image/bma-logo.png');
            background-size: 400px;
            background-position: center center;
            background-repeat: no-repeat;
        "></div>

        <div style="position:absolute; inset:0; background-color: rgba(255,255,255,0.8); z-index:1;"></div>

        <!-- All Content -->
        <div class="d-flex flex-column h-100" style="position:relative; z-index:2;">

            <!-- Clock Section -->
            <div class="p-3 flex-shrink-0"
                style="background-color: rgba(255,255,255,0.9); border-radius: 0 0 16px 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.2);">
                <p class="h4 fw-bold mb-0 float-end text-green">{{ timeStatus }}</p>
                <p class="h5 fw-bold mb-0 text-green">{{ formattedDate }}</p>
                <h2 class="display-4 fw-bold mb-0 text-green">{{ formattedTime }}</h2>
            </div>

            <hr class="mx-3 my-0" style="border-color: #ccc;" />

            <!-- Scroll Wrapper -->
            <div ref="scrollWrapper" class="p-3 flex-grow-1 schedule-scroll" style="overflow:hidden; position:relative;">
                <div ref="scrollContent">

                    <p class="fw-bold mb-3" style="font-size:xx-large; color:#1a1a1a;">Announcements</p>

                    <div v-if="weeklyAnnouncement.length">
                        <div v-for="(day, index) in weeklyAnnouncement" :key="index" class="mb-3">
                            <p class="fw-bold mb-1" style="font-size:0.85rem; letter-spacing:1px; color:#1a1a1a;">
                                {{ day.day }}
                            </p>
                            <template v-if="day.events && day.events.length">
                                <div v-for="(event, eIndex) in day.events" :key="eIndex" class="schedule-item p-2 mb-1 rounded">
                                    <div v-for="(value, key) in event" :key="key" class="small">
                                        <span class="fw-semibold text-capitalize" style="color:#2a2a2a;">{{ formatKey(key) }}: </span>
                                        <span style="color:#333;">{{ value }}</span>
                                    </div>
                                </div>
                            </template>
                            <div v-else>
                                <p class="small ms-1" style="color:#444;">No events</p>
                            </div>
                        </div>
                    </div>

                    <p class="fw-bold mb-3 mt-2" style="font-size:xx-large; color:#1a1a1a;">Upcoming Events</p>
                    <div v-if="upcomingEvents.length">
                        <div v-for="(event, index) in upcomingEvents" :key="index" class="schedule-item p-2 mb-2 rounded">
                            <div v-for="(value, key) in event" :key="key" class="small">
                                <span class="fw-semibold text-capitalize" style="color:#2a2a2a;">{{ formatKey(key) }}: </span>
                                <span style="color:#333;">{{ value }}</span>
                            </div>
                        </div>
                    </div>

                    <div v-if="!weeklyAnnouncement.length && !upcomingEvents.length">
                        <p class="small" style="color:#444;">No announcement available.</p>
                    </div>

                </div>
            </div>

        </div>
    </div>
</template>

<script>
export default {
    name: 'Announcement',
    data() {
        return {
            currentTime: new Date(),
            timer: null,
            scrollTimer: null,
            weeklyAnnouncement: [],
            upcomingEvents: [],
        }
    },
    computed: {
        formattedDate() {
            const options = { month: 'long', day: 'numeric', year: 'numeric' };
            return this.currentTime.toLocaleDateString('en-US', options);
        },
        formattedTime() {
            const options = { hour: '2-digit', minute: '2-digit', hour12: true };
            return this.currentTime.toLocaleTimeString('en-US', options);
        },
        timeStatus() {
            const hour = this.currentTime.getHours();
            if (hour < 12) return 'GOOD MORNING';
            if (hour < 18) return 'GOOD AFTERNOON';
            return 'GOOD EVENING';
        },
    },
    async mounted() {
        this.timer = setInterval(() => {
            this.currentTime = new Date();
        }, 1000);

        await this.fetchAnnouncement();
        setInterval(() => this.fetchAnnouncement(), 300000);
    },
    beforeUnmount() {
        clearInterval(this.timer);
        this.stopScroll()
    },
    methods: {
        async fetchAnnouncement() {
            try {
                const response = await fetch('/data/announcement.json')
                const data = await response.json()
                this.weeklyAnnouncement = data.weekly || []
                this.upcomingEvents = data.upcoming || []

                await this.$nextTick()
                this.startScroll()
            } catch (e) {
                console.error("Failed to fetch announcement:", e)
            }
        },

        startScroll() {
            this.stopScroll()

            const wrapper = this.$refs.scrollWrapper
            const content = this.$refs.scrollContent
            if (!wrapper || !content) return

            const wrapperHeight = wrapper.clientHeight
            const contentHeight = content.scrollHeight

            // No need to scroll if content fits in view
            if (contentHeight <= wrapperHeight) {
                console.log('[Scroll] Content fits, no scroll needed')
                return
            }

            const scrollDistance = contentHeight - wrapperHeight + 24

            // 40px per second scroll speed — adjust this value
            const SCROLL_SPEED = 40
            const scrollDuration = (scrollDistance / SCROLL_SPEED) * 1000
            const pauseDuration = 1500  

            console.log(`[Scroll] Content: ${contentHeight}px | Scroll distance: ${scrollDistance}px | Duration: ${scrollDuration / 1000}s`)

            let currentPos = 0
            let direction = 1  // 1 = down, -1 = up
            let isPaused = false

            const TICK = 8

            this.scrollTimer = setInterval(() => {
                if (isPaused) return

                currentPos += direction * (SCROLL_SPEED * TICK / 1000)

                // Reached bottom — pause then reverse
                if (currentPos >= scrollDistance) {
                    currentPos = scrollDistance
                    content.style.transform = `translateY(-${currentPos}px)`
                    isPaused = true
                    setTimeout(() => {
                        direction = -1
                        isPaused = false
                    }, pauseDuration)
                    return
                }

                // Reached top — pause then reverse
                if (currentPos <= 0) {
                    currentPos = 0
                    content.style.transform = `translateY(0px)`
                    isPaused = true
                    setTimeout(() => {
                        direction = 1
                        isPaused = false
                    }, pauseDuration)
                    return
                }

                content.style.transform = `translateY(-${currentPos}px)`
            }, TICK)
        },

        stopScroll() {
            if (this.scrollTimer) {
                clearInterval(this.scrollTimer)
                this.scrollTimer = null
            }
            if (this.$refs.scrollContent) {
                this.$refs.scrollContent.style.transform = 'translateY(0px)'
            }
        },

        formatKey(key) {
            return key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim()
        }
    },
}
</script>

<style scoped>
.schedule-scroll {
    scrollbar-width: none;
}
.schedule-scroll::-webkit-scrollbar {
    display: none;
}
.schedule-item {
    background-color: rgba(255, 255, 255, 0.75);
    border-left: 3px solid #4caf50;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
}
</style>