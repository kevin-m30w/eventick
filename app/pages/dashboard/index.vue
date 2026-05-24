<script setup lang="ts">
import type { FormSubmitEvent } from "@nuxt/ui";
import { z } from "zod";

// Lock page down to verified organizers only
definePageMeta({
  middleware: ["organizer-only"],
});

const supabase = useSupabaseClient() as any;
const user = useSupabaseUser();

// UI Control States
const formSubmitting = ref(false);
const uploadingImage = ref(false);
const toastMessage = ref({ text: "", color: "green" });

// 1. Cleaned Zod Schema Blueprint
const eventSchema = z
  .object({
    title: z.string().min(5, "Title must be at least 5 characters long"),
    description: z
      .string()
      .min(15, "Description must be at least 15 characters long"),
    location: z.string().min(3, "Please specify a venue location"),
    start_time: z.string().min(1, "Start date and time is required"),
    end_time: z.string().min(1, "End date and time is required"),
    price: z.number().min(0, "Price cannot be negative"),
    total_capacity: z
      .number()
      .int()
      .positive("Capacity must be at least 1 person"),
  })
  .refine((data) => Date.parse(data.end_time) > Date.parse(data.start_time), {
    message:
      "The event closing time cannot be scheduled before its starting time",
    path: ["end_time"], // Highlights the end_time field on error
  });

type EventSchema = z.output<typeof eventSchema>;

// Structural reactive starting states
const eventState = reactive({
  title: "",
  description: "",
  location: "",
  start_time: "",
  end_time: "",
  price: 0,
  total_capacity: 50,
});

const uploadedImages = ref<string[]>([]);

// 2. Client-side storage upload handler
async function handleImageUpload(e: Event) {
  const target = e.target as HTMLInputElement;
  if (!target.files || target.files.length === 0) return;

  try {
    uploadingImage.value = true;
    clearToast();

    const file = target.files[0];
    const formData = new FormData();
    formData.append("file", file);

    const response = await $fetch("/api/storage/upload", {
      method: "POST",
      body: formData,
    });

    if (response?.fileUrl) {
      uploadedImages.value.push(response.fileUrl);
      showToast("Image uploaded successfully!", "green");
    }
  } catch (err: any) {
    showToast(err.statusMessage || "Failed to upload image asset.", "red");
  } finally {
    uploadingImage.value = false;
  }
}

// 3. Form submission execution track
async function onCreateEvent(event: FormSubmitEvent<EventSchema>) {
  try {
    formSubmitting.value = true;
    clearToast();

    // 💡 FIXED: Grab a guaranteed session ID straight from Auth before querying the profile
    const { data: authData } = await supabase.auth.getUser();
    const currentUserId = authData.user?.id;

    if (!currentUserId) {
      throw new Error("Your user session has expired. Please log in again.");
    }

    // A. Fetch host organization record link safely
    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", currentUserId)
      .maybeSingle();

    if (profErr || !profile?.organization_id) {
      throw new Error(
        "Could not identify a verified organization profile linked to your account.",
      );
    }

    // B. Insert main event details into Supabase
    const { data: newEvent, error: eventErr } = await supabase
      .from("events")
      .insert({
        organization_id: profile.organization_id,
        title: event.data.title,
        description: event.data.description,
        location: event.data.location,
        start_time: new Date(event.data.start_time).toISOString(),
        end_time: new Date(event.data.end_time).toISOString(),
        price: event.data.price,
        total_capacity: event.data.total_capacity,
      })
      .select()
      .single();

    if (eventErr) throw eventErr;

    // C. Map image references to the related gallery table
    if (uploadedImages.value.length > 0) {
      const imagesPayload = uploadedImages.value.map((url, index) => ({
        event_id: newEvent.id,
        image_url: url,
        is_cover: index === 0,
      }));

      const { error: imgErr } = await supabase
        .from("event_images")
        .insert(imagesPayload);

      if (imgErr) throw imgErr;
    }

    showToast("Success! Your event is now live and public.", "green");
    resetForm();
  } catch (error: any) {
    showToast(error.message || "Failed to update database parameters.", "red");
  } finally {
    formSubmitting.value = false;
  }
}

function showToast(text: string, color: "green" | "red") {
  toastMessage.value = { text, color };
}
function clearToast() {
  toastMessage.value = { text: "", color: "green" };
}
function resetForm() {
  eventState.title = "";
  eventState.description = "";
  eventState.location = "";
  eventState.start_time = "";
  eventState.end_time = "";
  eventState.price = 0;
  eventState.total_capacity = 50;
  uploadedImages.value = [];
}
</script>

<template>
  <div class="max-w-5xl mx-auto p-6 space-y-6">
    <header
      class="flex justify-between items-center border-b border-gray-100 dark:border-gray-800 pb-4"
    >
      <div>
        <h1 class="text-3xl font-bold tracking-tight">Organizer Dashboard</h1>
        <p class="text-gray-500 dark:text-gray-400 mt-1">
          Manage scheduling parameters and list new entries.
        </p>
      </div>
      <UButton
        to="/settings"
        color="gray"
        variant="ghost"
        icon="i-heroicons-user-circle"
        >Account Settings</UButton
      >
    </header>

    <UAlert
      v-if="toastMessage.text"
      icon="i-heroicons-information-circle"
      :color="toastMessage.color"
      variant="soft"
      :title="toastMessage.text"
    />

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="lg:col-span-2">
        <UCard>
          <template #header>
            <h3 class="text-lg font-semibold">Event Parameters</h3>
          </template>

          <UForm
            :schema="eventSchema"
            :state="eventState"
            class="space-y-4"
            @submit="onCreateEvent"
          >
            <UFormGroup label="Event Title" name="title" required>
              <UInput
                v-model="eventState.title"
                placeholder="e.g., Summer Live Symphony Concert"
              />
            </UFormGroup>

            <UFormGroup
              label="Detailed Description"
              name="description"
              required
            >
              <UTextarea
                v-model="eventState.description"
                placeholder="Provide rules, guidelines, schedules, etc..."
                :rows="4"
              />
            </UFormGroup>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <UFormGroup label="Start Date & Time" name="start_time" required>
                <UInput
                  :model-value="eventState.start_time"
                  type="datetime-local"
                  @input="
                    eventState.start_time = (
                      $event.target as HTMLInputElement
                    ).value
                  "
                />
              </UFormGroup>

              <UFormGroup label="End Date & Time" name="end_time" required>
                <UInput
                  :model-value="eventState.end_time"
                  type="datetime-local"
                  @input="
                    eventState.end_time = (
                      $event.target as HTMLInputElement
                    ).value
                  "
                />
              </UFormGroup>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <UFormGroup
                label="Venue / Location Address"
                name="location"
                required
              >
                <UInput
                  v-model="eventState.location"
                  placeholder="e.g., Grand Ballroom Jakarta or Zoom Link"
                  icon="i-heroicons-map-pin"
                />
              </UFormGroup>

              <UFormGroup label="Ticket Price (IDR)" name="price" required>
                <UInput
                  v-model.number="eventState.price"
                  type="number"
                  placeholder="0 for Free Events"
                  icon="i-heroicons-banknotes"
                />
              </UFormGroup>
            </div>

            <UFormGroup
              label="Max Participant Capacity"
              name="total_capacity"
              required
            >
              <UInput
                v-model.number="eventState.total_capacity"
                type="number"
                icon="i-heroicons-users"
              />
            </UFormGroup>

            <UButton
              type="submit"
              block
              color="primary"
              size="lg"
              :loading="formSubmitting"
            >
              Publish Event Live
            </UButton>
          </UForm>
        </UCard>
      </div>

      <div class="space-y-4">
        <UCard>
          <template #header>
            <h3 class="text-md font-semibold">Media Upload Assets</h3>
          </template>

          <div class="space-y-4">
            <label
              class="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-6 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
            >
              <UIcon
                :name="
                  uploadingImage
                    ? 'i-heroicons-arrow-path'
                    : 'i-heroicons-photo'
                "
                :class="[
                  'w-8 h-8 text-gray-400',
                  { 'animate-spin': uploadingImage },
                ]"
              />
              <span
                class="text-sm font-medium text-gray-600 dark:text-gray-400 mt-2"
              >
                {{
                  uploadingImage
                    ? "Uploading binary to R2..."
                    : "Select Event Banner image"
                }}
              </span>
              <input
                type="file"
                accept="image/*"
                class="hidden"
                :disabled="uploadingImage"
                @change="handleImageUpload"
              />
            </label>

            <div v-if="uploadedImages.length > 0" class="space-y-2 mt-4">
              <label
                class="text-xs font-semibold text-gray-400 uppercase tracking-wider block"
                >Uploaded Assets</label
              >
              <div class="grid grid-cols-2 gap-2">
                <div
                  v-for="(url, index) in uploadedImages"
                  :key="index"
                  class="relative aspect-video rounded-md overflow-hidden bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-sm"
                >
                  <img :src="url" class="w-full h-full object-cover" />
                  <div
                    v-if="index === 0"
                    class="absolute top-1 left-1 bg-primary-500 text-white text-[10px] px-1.5 py-0.5 rounded font-bold uppercase shadow"
                  >
                    Cover
                  </div>
                </div>
              </div>
            </div>
          </div>
        </UCard>
      </div>
    </div>
  </div>
</template>
