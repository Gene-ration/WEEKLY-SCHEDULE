<template>
    <div class="row ma-0" style="height:100vh; overflow:hidden; width:100%;">

        <!-- Video Player (60%) -->
        <div class="col-md-7 pa-0" style="height:100vh;">
            <VideoPlaylist />
        </div>

        <!-- Announcement (40%) -->
        <div class="col-md-5 pa-0" style="height:100vh;">
            <Announcement />
        </div>

    </div>
</template>

<script>
import VideoPlaylist from '@/components/VideoPlaylist.vue'
import Announcement from '@/components/Announcement.vue';

export default {
    name: 'App',
    components: {
        VideoPlaylist,
        Announcement,
    },
}
</script>

<style>
html, body {
    margin: 0;
    padding: 0;
    overflow: hidden !important;
    height: 100%;
}
</style>