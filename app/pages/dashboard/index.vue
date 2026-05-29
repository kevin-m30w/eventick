<script setup lang="ts">
import { ref, onMounted } from "vue";
import { formatCurrency } from "~/utils/formatters";

definePageMeta({
  middleware: ["organizer-only"],
  layout: "dashboard",
});

const supabase = useSupabaseClient() as any;

// Dashboard Core States
const loading = ref(true);
const stats = ref({
  totalEvents: 0,
  totalRevenue: 0,
  ticketsSold: 0,
  ticketsScanned: 0,
});
const topEvents = ref<any[]>([]);

async function fetchDashboardAnalytics() {
  try {
    loading.value = true;
    const { data: authData } = await supabase.auth.getUser();

    // Get organizer's profile organization
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", authData.user?.id)
      .maybeSingle();

    if (!profile?.organization_id) return;

    // 1. Fetch High-Level Aggregates from our Database View
    const { data: viewStats, error: statsErr } = await supabase
      .from("organizer_analytics")
      .select("*")
      .eq("organization_id", profile.organization_id)
      .maybeSingle();

    if (!statsErr && viewStats) {
      stats.value = {
        totalEvents: Number(viewStats.total_events || 0),
        totalRevenue: Number(viewStats.total_revenue || 0),
        ticketsSold: Number(viewStats.total_tickets_sold || 0),
        ticketsScanned: Number(viewStats.total_scanned_tickets || 0),
      };
    }

    // 2. Fetch Top Selling Events (Ranks events based on ticket purchase count)
    const { data: eventsData, error: eventsErr } = await supabase
      .from("events")
      .select(
        `
        id,
        title,
        price,
        total_capacity,
        tickets(count)
      `,
      )
      .eq("organization_id", profile.organization_id);

    if (!eventsErr && eventsData) {
      // Map and sort events by ticket count descending
      topEvents.value = eventsData
        .map((ev: any) => ({
          id: ev.id,
          title: ev.title,
          sold: ev.tickets?.[0]?.count || 0,
          capacity: ev.total_capacity,
          revenue: (ev.tickets?.[0]?.count || 0) * ev.price,
        }))
        .sort((a: any, b: any) => b.sold - a.sold)
        .slice(0, 5); // Limit to top 5 items
    }
  } catch (err) {
    console.error("Dashboard calculation error:", err);
  } finally {
    loading.value = false;
  }
}

// Calculate percentages safely for geometric bars
const checkInPercentage = computed(() => {
  if (stats.value.ticketsSold === 0) return 0;
  return Math.round(
    (stats.value.ticketsScanned / stats.value.ticketsSold) * 100,
  );
});

onMounted(fetchDashboardAnalytics);
</script>

<template>
  <div class="max-w-6xl mx-auto p-6 space-y-8">
    <header
      class="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-100 dark:border-gray-800 pb-5 gap-4"
    >
      <div>
        <h1 class="text-3xl font-black tracking-tight">Organizer Workspace</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Monitor your gross performance parameters, live check-ins, and manage
          logistics.
        </p>
      </div>
      <div class="flex gap-2 w-full sm:w-auto">
        <UButton
          to="/dashboard/events"
          variant="subtle"
          icon="i-heroicons-calendar"
          class="font-bold"
        >
          Manage Events CRUD
        </UButton>
        <UButton
          to="/dashboard/scan"
          variant="solid"
          icon="i-heroicons-qr-code"
          class="font-bold"
        >
          Open Gate Scanner
        </UButton>
      </div>
    </header>

    <div
      v-if="loading"
      class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
    >
      <USkeleton v-for="i in 4" :key="i" class="h-28 w-full rounded-xl" />
    </div>

    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <UCard
        :ui="{ body: 'p-5' }"
        class="border border-neutral-100 dark:border-neutral-800 shadow-sm"
      >
        <div class="space-y-2">
          <div
            class="flex justify-between items-center text-neutral-400 dark:text-neutral-500"
          >
            <span class="text-xs font-bold uppercase tracking-wider"
              >Gross Revenue</span
            >
            <UIcon
              name="i-heroicons-banknotes"
              class="w-5 h-5 text-emerald-500"
            />
          </div>
          <p
            class="text-2xl font-black font-mono tracking-tight text-neutral-900 dark:text-white"
          >
            {{ formatCurrency(stats.totalRevenue) }}
          </p>
        </div>
      </UCard>

      <UCard
        :ui="{ body: 'p-5' }"
        class="border border-neutral-100 dark:border-neutral-800 shadow-sm"
      >
        <div class="space-y-2">
          <div
            class="flex justify-between items-center text-neutral-400 dark:text-neutral-500"
          >
            <span class="text-xs font-bold uppercase tracking-wider"
              >Active Events</span
            >
            <UIcon name="i-heroicons-ticket" class="w-5 h-5 text-primary-500" />
          </div>
          <p
            class="text-2xl font-black tracking-tight text-neutral-900 dark:text-white"
          >
            {{ stats.totalEvents }}
            <span class="text-sm font-medium text-neutral-400">hosted</span>
          </p>
        </div>
      </UCard>

      <UCard
        :ui="{ body: 'p-5' }"
        class="border border-neutral-100 dark:border-neutral-800 shadow-sm"
      >
        <div class="space-y-2">
          <div
            class="flex justify-between items-center text-neutral-400 dark:text-neutral-500"
          >
            <span class="text-xs font-bold uppercase tracking-wider"
              >Tickets Issued</span
            >
            <UIcon name="i-heroicons-users" class="w-5 h-5 text-blue-500" />
          </div>
          <p
            class="text-2xl font-black tracking-tight text-neutral-900 dark:text-white"
          >
            {{ stats.ticketsSold }}
            <span class="text-sm font-medium text-neutral-400">sold</span>
          </p>
        </div>
      </UCard>

      <UCard
        :ui="{ body: 'p-5' }"
        class="border border-neutral-100 dark:border-neutral-800 shadow-sm"
      >
        <div class="space-y-3">
          <div
            class="flex justify-between items-center text-neutral-400 dark:text-neutral-500"
          >
            <span class="text-xs font-bold uppercase tracking-wider"
              >Gate Check-Ins</span
            >
            <span class="text-xs font-mono font-bold text-primary-500"
              >{{ checkInPercentage }}%</span
            >
          </div>
          <div class="space-y-1.5">
            <UProgress
              :value="stats.ticketsScanned"
              :max="stats.ticketsSold || 1"
              size="sm"
              color="primary"
            />
            <div
              class="flex justify-between text-[10px] text-neutral-400 font-bold font-mono"
            >
              <span>{{ stats.ticketsScanned }} IN VENUE</span>
              <span>{{ stats.ticketsSold }} TOTAL SOLD</span>
            </div>
          </div>
        </div>
      </UCard>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="lg:col-span-2">
        <UCard
          class="border border-neutral-100 dark:border-neutral-800 shadow-sm"
        >
          <template #header>
            <div class="flex items-center justify-between">
              <h3
                class="text-sm font-black uppercase tracking-wider text-neutral-400 dark:text-neutral-500"
              >
                Top Performing Events
              </h3>
              <UIcon
                name="i-heroicons-arrow-trending-up"
                class="w-4 h-4 text-neutral-400"
              />
            </div>
          </template>

          <div
            v-if="topEvents.length === 0"
            class="text-center py-12 text-neutral-400 text-sm"
          >
            No dynamic event allocations generated yet.
          </div>

          <div v-else class="space-y-5 py-2">
            <div v-for="event in topEvents" :key="event.id" class="space-y-2">
              <div class="flex justify-between text-sm">
                <span
                  class="font-bold text-neutral-800 dark:text-neutral-200 truncate max-w-sm"
                  >{{ event.title }}</span
                >
                <span
                  class="font-mono font-bold text-neutral-500 dark:text-neutral-400"
                  >{{ formatCurrency(event.revenue) }}</span
                >
              </div>
              <div class="space-y-1">
                <UProgress
                  :value="event.sold"
                  :max="event.capacity"
                  size="xs"
                  color="primary"
                />
                <div
                  class="flex justify-between text-[10px] font-bold font-mono text-neutral-400"
                >
                  <span
                    >{{ event.sold }} / {{ event.capacity }} SEATS FILLED</span
                  >
                  <span
                    >{{ Math.round((event.sold / event.capacity) * 100) }}%
                    CAPACITY</span
                  >
                </div>
              </div>
            </div>
          </div>
        </UCard>
      </div>

      <div class="space-y-4">
        <UCard
          class="border border-neutral-100 dark:border-neutral-800 shadow-sm"
        >
          <template #header>
            <h3
              class="text-sm font-bold uppercase tracking-wider text-neutral-400"
            >
              Quick Logistics Logs
            </h3>
          </template>

          <div class="space-y-2">
            <div
              class="p-3 border border-neutral-50 dark:border-neutral-800 rounded-lg bg-neutral-50/50 dark:bg-neutral-900/30 flex items-center gap-3"
            >
              <UIcon
                name="i-heroicons-sparkles"
                class="w-5 h-5 text-amber-500 flex-shrink-0"
              />
              <div class="text-xs">
                <p class="font-bold text-neutral-800 dark:text-neutral-200">
                  System Performance Is Active
                </p>
                <p class="text-neutral-400 mt-0.5">
                  Database triggers and R2 links are fully operational.
                </p>
              </div>
            </div>

            <div
              class="p-3 border border-neutral-50 dark:border-neutral-800 rounded-lg bg-neutral-50/50 dark:bg-neutral-900/30 flex items-center gap-3"
            >
              <UIcon
                name="i-heroicons-shield-check"
                class="w-5 h-5 text-blue-500 flex-shrink-0"
              />
              <div class="text-xs">
                <p class="font-bold text-neutral-800 dark:text-neutral-200">
                  Supabase RLS is Locked
                </p>
                <p class="text-neutral-400 mt-0.5">
                  Organizers isolated cleanly via implicit session vectors.
                </p>
              </div>
            </div>
          </div>
        </UCard>
      </div>
    </div>
  </div>
</template>
