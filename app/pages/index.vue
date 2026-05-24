<script setup lang="ts">
const supabase = useSupabaseClient() as any;

// App Operational States
const loadingEvents = ref(true);
const rawEvents = ref<any[]>([]);

// Search & Filter Reactive States
const searchQuery = ref("");
const priceFilter = ref<"all" | "free" | "paid">("all");

// 1. Fetch live events from Supabase with relational image mapping
async function fetchPublicEvents() {
  try {
    loadingEvents.value = true;

    // Queries the events table while joining the related cover image from event_images
    const { data, error } = await supabase
      .from("events")
      .select(
        `
        id,
        title,
        description,
        location,
        start_time,
        price,
        total_capacity,
        event_images(image_url)
      `,
      )
      .eq("event_images.is_cover", true); // Pulls only the cover banner asset

    if (error) throw error;
    rawEvents.value = data || [];
  } catch (error: any) {
    console.error("Error fetching events:", error.message);
  } finally {
    loadingEvents.value = false;
  }
}

// 2. Computed tracking property: Filters data instantly in memory without re-querying the database
const filteredEvents = computed(() => {
  return rawEvents.value.filter((event) => {
    // A. Title/Location matching check
    const matchesSearch =
      event.title.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      event.location.toLowerCase().includes(searchQuery.value.toLowerCase());

    // B. Price tier matching check
    const matchesPrice =
      priceFilter.value === "all" ||
      (priceFilter.value === "free" && event.price === 0) ||
      (priceFilter.value === "paid" && event.price > 0);

    return matchesSearch && matchesPrice;
  });
});

// Helper utility to format raw currency display cleanly
function formatCurrency(amount: number) {
  if (amount === 0) return "FREE";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

// Helper utility to clean up database ISO timestamps into reader-friendly dates
function formatDate(isoString: string) {
  return new Date(isoString).toLocaleDateString("id-ID", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

onMounted(() => {
  fetchPublicEvents();
});
</script>

<template>
  <div class="max-w-7xl mx-auto p-6 space-y-8">
    <header class="text-center max-w-2xl mx-auto space-y-3 py-6">
      <h1
        class="text-4xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-primary-500 to-amber-500 bg-clip-text text-transparent"
      >
        Discover Incredible Events
      </h1>
      <p class="text-gray-500 dark:text-gray-400 text-md sm:text-lg">
        Secure your entry tickets for local tournaments, live concerts, and
        premier developer conferences instantly.
      </p>
    </header>

    <div
      class="flex flex-col sm:flex-row gap-4 bg-gray-50 dark:bg-gray-900 p-4 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm"
    >
      <div class="flex-1">
        <UInput
          v-model="searchQuery"
          icon="i-heroicons-magnifying-glass"
          placeholder="Search by event title or venue address..."
          size="lg"
          block
        />
      </div>

      <div class="flex items-center gap-2">
        <span
          class="text-xs font-semibold text-gray-400 uppercase tracking-wider hidden md:inline"
          >Price:</span
        >
        <UButtonGroup size="lg">
          <UButton
            :color="priceFilter === 'all' ? 'primary' : 'gray'"
            variant="solid"
            @click="priceFilter = 'all'"
            >All</UButton
          >
          <UButton
            :color="priceFilter === 'free' ? 'primary' : 'gray'"
            variant="solid"
            @click="priceFilter = 'free'"
            >Free</UButton
          >
          <UButton
            :color="priceFilter === 'paid' ? 'primary' : 'gray'"
            variant="solid"
            @click="priceFilter = 'paid'"
            >Paid</UButton
          >
        </UButtonGroup>
      </div>
    </div>

    <div
      v-if="loadingEvents"
      class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
    >
      <div v-for="n in 6" :key="n" class="space-y-4">
        <USkeleton class="h-48 w-full rounded-xl" />
        <USkeleton class="h-6 w-3/4" />
        <USkeleton class="h-4 w-1/2" />
      </div>
    </div>

    <div
      v-else-if="filteredEvents.length === 0"
      class="text-center py-16 border border-dashed border-gray-200 dark:border-gray-800 rounded-2xl"
    >
      <UIcon
        name="i-heroicons-calendar-days"
        class="w-12 h-12 text-gray-400 mx-auto"
      />
      <h3 class="text-md font-semibold mt-4 text-gray-900 dark:text-white">
        No matching events found
      </h3>
      <p class="text-sm text-gray-500 mt-1">
        Try adjusting your keyword searches or price parameter filter keys.
      </p>
    </div>

    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      <UCard
        v-for="event in filteredEvents"
        :key="event.id"
        class="group flex flex-col h-full overflow-hidden hover:shadow-md transition-shadow duration-200"
        :ui="{ body: { padding: 'p-0' }, footer: { padding: 'p-4' } }"
      >
        <div
          class="relative aspect-video w-full bg-gray-100 dark:bg-gray-950 overflow-hidden border-b border-gray-100 dark:border-gray-800"
        >
          <img
            :src="
              event.event_images?.[0]?.image_url ||
              'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?q=80&w=600'
            "
            class="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
          />
          <div class="absolute top-3 right-3">
            <UBadge
              color="black"
              size="md"
              variant="solid"
              class="backdrop-blur-md bg-black/70 font-bold"
            >
              {{ formatCurrency(event.price) }}
            </UBadge>
          </div>
        </div>

        <div class="p-5 flex-1 space-y-3">
          <div
            class="flex items-center text-xs font-semibold text-primary-500 dark:text-primary-400 space-x-1"
          >
            <UIcon name="i-heroicons-calendar" class="w-4 h-4" />
            <span>{{ formatDate(event.start_time) }}</span>
          </div>

          <h3
            class="text-xl font-bold tracking-tight text-gray-900 dark:text-white line-clamp-1"
          >
            {{ event.title }}
          </h3>

          <p class="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
            {{ event.description }}
          </p>

          <div
            class="flex items-center text-xs text-gray-400 dark:text-gray-500 space-x-1 pt-1"
          >
            <UIcon name="i-heroicons-map-pin" class="w-4 h-4 text-gray-400" />
            <span class="line-clamp-1">{{ event.location }}</span>
          </div>
        </div>

        <template #footer>
          <UButton
            :to="`/events/${event.id}`"
            block
            color="gray"
            variant="solid"
            class="group-hover:bg-primary-500 group-hover:text-white transition-colors"
          >
            Get Tickets
          </UButton>
        </template>
      </UCard>
    </div>
  </div>
</template>
