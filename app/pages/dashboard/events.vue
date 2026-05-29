<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import {
  formatCurrency,
  formatDate,
  formatIsoForInput,
} from "~/utils/formatters";

definePageMeta({
  middleware: ["organizer-only"],
  layout: "dashboard",
});

const supabase = useSupabaseClient() as any;

// Table Column Blueprints
const columns = [
  { accessorKey: "title", header: "Event Details" },
  { accessorKey: "start_time", header: "Date & Time" },
  { accessorKey: "tickets", header: "Ticket Sales" },
  { accessorKey: "price", header: "Admission Price" },
  { accessorKey: "id", id: "actions", header: "Operations" },
];

const loading = ref(true);
const processingAction = ref(false);
const eventsList = ref<any[]>([]);
const isSlideoverOpen = ref(false);
const isEditing = ref(false);
const editingEventId = ref<string | null>(null);
const toastMessage = ref({ text: "", color: "green" });

const eventState = reactive({
  title: "",
  description: "",
  location: "",
  start_time: "",
  end_time: "",
  price: 0,
  total_capacity: 100,
});
const currentImagesTrack = ref<string[]>([]);

async function fetchOrganizerEvents() {
  try {
    loading.value = true;
    const { data: authData } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", authData.user?.id)
      .maybeSingle();
    if (!profile?.organization_id) return;

    const { data } = await supabase
      .from("events")
      .select(
        "id, title, description, location, start_time, end_time, price, total_capacity, tickets(count), event_images(image_url, is_cover)",
      )
      .eq("organization_id", profile.organization_id)
      .order("start_time", { ascending: true });
    eventsList.value = data || [];
  } catch (err: any) {
    showToast(err.message, "red");
  } finally {
    loading.value = false;
  }
}

function handleOpenCreateModal() {
  isEditing.value = false;
  editingEventId.value = null;
  currentImagesTrack.value = [];
  Object.assign(eventState, {
    title: "",
    description: "",
    location: "",
    start_time: "",
    end_time: "",
    price: 0,
    total_capacity: 100,
  });
  isSlideoverOpen.value = true;
}

function handleOpenEditModal(row: any) {
  isEditing.value = true;
  editingEventId.value = row.id;
  Object.assign(eventState, {
    title: row.title,
    description: row.description,
    location: row.location,
    start_time: formatIsoForInput(row.start_time),
    end_time: formatIsoForInput(row.end_time),
    price: row.price,
    total_capacity: row.total_capacity,
  });
  currentImagesTrack.value =
    row.event_images?.map((img: any) => img.image_url) || [];
  isSlideoverOpen.value = true;
}

async function onSaveEvent({ data, images }: { data: any; images: string[] }) {
  try {
    processingAction.value = true;
    const { data: authData } = await supabase.auth.getUser();
    let eventId = editingEventId.value;

    if (isEditing.value && eventId) {
      await supabase
        .from("events")
        .update({
          ...data,
          start_time: new Date(data.start_time).toISOString(),
          end_time: new Date(data.end_time).toISOString(),
        })
        .eq("id", eventId);
      await supabase.from("event_images").delete().eq("event_id", eventId);
    } else {
      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", authData.user?.id)
        .maybeSingle();
      const { data: newEv } = await supabase
        .from("events")
        .insert({
          ...data,
          organization_id: profile.organization_id,
          start_time: new Date(data.start_time).toISOString(),
          end_time: new Date(data.end_time).toISOString(),
        })
        .select()
        .single();
      eventId = newEv.id;
    }

    if (images.length > 0 && eventId) {
      const payload = images.map((url, idx) => ({
        event_id: eventId,
        image_url: url,
        is_cover: idx === 0,
      }));
      await supabase.from("event_images").insert(payload);
    }

    isSlideoverOpen.value = false;
    showToast("Successfully synchronized event parameters!", "green");
    await fetchOrganizerEvents();
  } catch (err: any) {
    showToast(err.message, "red");
  } finally {
    processingAction.value = false;
  }
}

async function handleDeleteEvent(id: string) {
  if (!confirm("Are you sure?")) return;
  await supabase.from("events").delete().eq("id", id);
  showToast("Asset deleted.", "green");
  await fetchOrganizerEvents();
}

function showToast(text: string, color: string) {
  toastMessage.value = { text, color };
}
onMounted(fetchOrganizerEvents);
</script>

<template>
  <div class="max-w-6xl mx-auto p-6 space-y-6">
    <header
      class="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-100 dark:border-gray-800 pb-5 gap-4"
    >
      <div>
        <h1 class="text-3xl font-black tracking-tight">Manage Events</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Perform live CRUD updates and track sales metrics.
        </p>
      </div>
      <div class="flex gap-2 w-full sm:w-auto">
        <UButton to="/dashboard" variant="outline" icon="i-heroicons-arrow-left"
          >Back to Analytics</UButton
        >
        <UButton
          variant="solid"
          icon="i-heroicons-plus"
          class="font-bold"
          @click="handleOpenCreateModal"
          >Host New Event</UButton
        >
      </div>
    </header>

    <UAlert
      v-if="toastMessage.text"
      icon="i-heroicons-information-circle"
      :color="toastMessage.color as any"
      variant="soft"
      :title="toastMessage.text"
    />

    <UCard
      :ui="{ body: 'p-0' }"
      class="overflow-hidden border border-gray-100 dark:border-gray-800 shadow-sm"
    >
      <UTable :loading="loading" :columns="columns" :data="eventsList">
        <template #title-cell="{ row }">
          <div class="space-y-1 py-1 max-w-xs pl-4">
            <p class="font-bold text-gray-900 dark:text-white truncate">
              {{ row.original?.title }}
            </p>
            <p class="text-xs text-gray-400 flex items-center gap-1 truncate">
              <UIcon name="i-heroicons-map-pin" class="w-3 h-3" />{{
                row.original?.location
              }}
            </p>
          </div>
        </template>
        <template #start_time-cell="{ row }">
          <div class="text-xs space-y-0.5 text-gray-600 dark:text-gray-300">
            <p class="font-medium">
              <span class="text-gray-400">Start:</span>
              {{ formatDate(row.original?.start_time) }}
            </p>
            <p class="font-medium">
              <span class="text-gray-400">End:</span>
              {{ formatDate(row.original?.end_time) }}
            </p>
          </div>
        </template>
        <template #tickets-cell="{ row }">
          <div class="space-y-1.5 w-32">
            <div class="flex justify-between text-xs font-bold">
              <span class="text-primary-500"
                >{{ row.original?.tickets?.[0]?.count || 0 }} Sold</span
              >
              <span class="text-gray-400"
                >/ {{ row.original?.total_capacity }}</span
              >
            </div>
            <UProgress
              :value="row.original?.tickets?.[0]?.count || 0"
              :max="row.original?.total_capacity || 100"
              size="xs"
              color="primary"
            />
          </div>
        </template>
        <template #price-cell="{ row }">
          <span
            class="font-mono font-bold text-sm text-gray-900 dark:text-white"
            >{{ formatCurrency(row.original?.price || 0) }}</span
          >
        </template>
        <template #actions-cell="{ row }">
          <div class="flex items-center gap-2">
            <UButton
              variant="ghost"
              icon="i-heroicons-pencil-square"
              size="xs"
              @click="handleOpenEditModal(row.original)"
              >Edit</UButton
            >
            <UButton
              variant="ghost"
              icon="i-heroicons-trash"
              size="xs"
              class="text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
              @click="handleDeleteEvent(row.original?.id)"
              >Delete</UButton
            >
          </div>
        </template>
      </UTable>
    </UCard>

    <EventFormSlideover
      v-model:open="isSlideoverOpen"
      :is-editing="isEditing"
      :initial-state="eventState"
      :initial-images="currentImagesTrack"
      :processing="processingAction"
      @save="onSaveEvent"
    />
  </div>
</template>
