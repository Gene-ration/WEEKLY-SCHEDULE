<template>
    <div class="d-flex flex-column" style="height:100vh; overflow:hidden; position:relative;">

        <!-- Background Image -->
        <div style="
            position:absolute;
            inset:0;
            background-image: url('/Image/bma-logo.png');
            background-size: 400px;
            background-position: center center;
            background-repeat: no-repeat;
        "></div>

        <!-- Background Overlay -->
        <div style="position:absolute; inset:0; background-color:rgba(255,255,255,0.8); z-index:1;"></div>

        <!-- All Content -->
        <div class="d-flex flex-column h-100" style="position:relative; z-index:2;">

            <!-- Date & Clock Section -->
            <div class="p-3 flex-shrink-0"
                style="background-color:rgba(255,255,255,0.9); border-radius:0 0 16px 16px; box-shadow:0 4px 12px rgba(0,0,0,0.2);">
                <p class="h5 fw-bold mb-0 float-end text-green">{{ timeStatus }}</p>
                <p class="h5 fw-bold mb-0 text-green">{{ formattedDate }}</p>
                <h2 class="display-4 fw-bold mb-0 text-left text-green">{{ formattedTime }}</h2>
            </div>

            <hr class="mx-3 my-0" style="border-color:#ccc;" />
            <p class="container fw-bold mb-3 p-5px" style="font-size:xx-large; color:darkgreen;">Announcements</p>

            <!-- Announcements List -->
            <!-- ref="scrollWrapper" is the visible container we measure against -->
            <div ref="scrollWrapper" class="p-3 flex-grow-1" style="overflow:hidden; position:relative;">

                <!-- scroll-track only applied when content overflows -->
                <div ref="scrollContent" :class="shouldScroll ? 'scroll-track' : ''">

                    <!-- Panel 1 — ref="panel" wraps EVERYTHING including heading so measurement is accurate -->
                    <div ref="panel" class="scroll-panel">

                        <div v-if="weeklyAnnouncement.length">
                            <div v-for="(day, index) in weeklyAnnouncement" :key="index" class="mb-3">
                                <p v-if="day.day" class="fw-bold mb-1"
                                    style="font-size:0.85rem; letter-spacing:1px; color:#1a1a1a;">
                                    {{ day.day }}
                                </p>
                                <template v-if="day.events && day.events.length">
                                    <div v-for="(event, eIndex) in day.events" :key="eIndex"
                                        class="schedule-item p-2 mb-1 rounded">
                                        <p class="fw-semibold mb-0" style="color:#2a2a2a;">{{ event.title }}</p>
                                        <p class="small mb-0" style="color:#333;">{{ event.content }}</p>
                                    </div>
                                </template>
                                <div v-else>
                                    <p class="small ms-1" style="color:#444;">No events</p>
                                </div>
                            </div>
                        </div>

                        <!-- Shown only when announcementList prop is empty -->
                        <div v-else>
                            <p class="small" style="color:#444;">No announcements available.</p>
                        </div>

                        <div v-if="upcomingEvents.length">
                            <p class="fw-bold mb-3 mt-2" style="font-size:xx-large; color:#1a1a1a;">Upcoming Events</p>
                            <div v-for="(event, index) in upcomingEvents" :key="index"
                                class="schedule-item p-2 mb-2 rounded">
                                <p class="fw-semibold mb-0" style="color:#2a2a2a;">{{ event.title }}</p>
                                <p class="small mb-0" style="color:#333;">{{ event.content }}</p>
                            </div>
                        </div>
                    </div>

                    <!-- Panel 2 — duplicate for seamless loop, only when scrolling -->
                    <div v-if="shouldScroll" class="scroll-panel" aria-hidden="true">

                        <div v-if="weeklyAnnouncement.length">
                            <div v-for="(day, index) in weeklyAnnouncement" :key="'b' + index" class="mb-3">
                                <p v-if="day.day" class="fw-bold mb-1"
                                    style="font-size:0.85rem; letter-spacing:1px; color:#1a1a1a;">
                                    {{ day.day }}
                                </p>
                                <template v-if="day.events && day.events.length">
                                    <div v-for="(event, eIndex) in day.events" :key="'b' + eIndex"
                                        class="schedule-item p-2 mb-1 rounded">
                                        <p class="fw-semibold mb-0" style="color:#2a2a2a;">{{ event.title }}</p>
                                        <p class="small mb-0" style="color:#333;">{{ event.content }}</p>
                                    </div>
                                </template>
                                <div v-else>
                                    <p class="small ms-1" style="color:#444;">No events</p>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    name: 'Announcement',

    props: {
        announcementList: {
            type: Array,
            default: () => []
        }
    },

    data() {
        return {
            currentTime: new Date(),
            timer: null,
            upcomingEvents: [],
            shouldScroll: false,
        }
    },

    computed: {
        weeklyAnnouncement() {
            console.log('[Announcement] announcementList received:', this.announcementList)

            if (!this.announcementList.length) {
                console.log('[Announcement] Empty — showing empty state')
                return []
            }

            return this.announcementList.map(item => {
                console.log('[Announcement] raw schedule value:', item.schedule)
                const date = new Date(item.schedule)
                const isValidDate = item.schedule && !isNaN(date.getTime())

                return {
                    day: isValidDate
                        ? date.toLocaleDateString('en-US', {
                            weekday: 'long',
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric'
                        })
                        : null,
                    events: [{
                        title: item.title,
                        content: item.content
                    }]
                }
            })
        },
        formattedDate() {
            const options = { month: 'long', day: 'numeric', year: 'numeric' }
            return this.currentTime.toLocaleDateString('en-US', options)
        },
        formattedTime() {
            const options = { hour: '2-digit', minute: '2-digit', hour12: true }
            return this.currentTime.toLocaleTimeString('en-US', options)
        },
        timeStatus() {
            const hour = this.currentTime.getHours()
            if (hour < 12) return 'GOOD MORNING'
            if (hour < 18) return 'GOOD AFTERNOON'
            return 'GOOD EVENING'
        },
        hasAnnouncements() {
            return this.weeklyAnnouncement.length > 0 || this.upcomingEvents.length > 0
        }
    },

    watch: {
        // Re-check overflow whenever announcements update
        weeklyAnnouncement() {
            this.$nextTick(() => this.checkOverflow())
        }
    },

    mounted() {
        this.timer = setInterval(() => {
            this.currentTime = new Date()
        }, 1000)

        this.$nextTick(() => this.checkOverflow())
    },

    beforeUnmount() {
        clearInterval(this.timer)
    },

    methods: {
        // Compares panel height to wrapper height
        // If panel is taller — content overflows — enable scroll animation
        checkOverflow() {
            const wrapper = this.$refs.scrollWrapper
            const panel = this.$refs.panel

            if (!wrapper || !panel) {
                console.warn('[Overflow Check] refs not ready')
                return
            }

            const wrapperHeight = wrapper.clientHeight
            const panelHeight = panel.scrollHeight

            this.shouldScroll = panelHeight > wrapperHeight
            console.log(`[Overflow Check] panel: ${panelHeight}px | wrapper: ${wrapperHeight}px | shouldScroll: ${this.shouldScroll}`)
        }
    }
}
</script>

<style scoped>
.schedule-item {
    background-color: rgba(255, 255, 255, 0.75);
    border-left: 3px solid #4caf50;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
}

.scroll-track {
    display: flex;
    flex-direction: column;
    animation: loopScroll 30s linear infinite;
}

.scroll-panel {
    width: 100%;
    flex-shrink: 0;
}

@keyframes loopScroll {
    0% {
        transform: translateY(0);
    }
    100% {
        transform: translateY(-50%);
    }
}
</style>