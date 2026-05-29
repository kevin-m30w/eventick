<script setup lang="ts">
import type { FormSubmitEvent } from "@nuxt/ui";
import { ref, watch } from "vue";
import { z } from "zod";

const props = defineProps<{
  open: boolean;
  isEditing: boolean;
  initialState: any;
  initialImages: string[];
  processing: boolean;
}>();

const emit = defineEmits<{
  (e: "update:open", value: boolean): void;
  (e: "save", payload: { data: any; images: string[] }): void;
}>();

const uploadingImage = ref(false);
const uploadedImages = ref<string[]>([]);

// Sync internal image state when modal pops open
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      uploadedImages.value = [...props.initialImages];
    }
  },
);

const eventSchema = z
  .object({
    title: z.string().min(5, "Title must be at least 5 characters long"),
    description: z
      .string()
      .min(15, "Description must be at least 15 characters long"),
    location: z.string().min(3, "Please specify a venue location"),
    start_time: z.string().min(1, "Start date and time is required"),
    end_time: z.string().min(1, "End date and time is required"),
    price: z.coerce.number().min(0, "Price cannot be negative"),
    total_capacity: z.coerce
      .number()
      .int()
      .positive("Capacity must be at least 1 person"),
  })
  .refine((data) => Date.parse(data.end_time) > Date.parse(data.start_time), {
    message:
      "The event closing time cannot be scheduled before its starting time",
    path: ["end_time"],
  });

async function handleImageUpload(e: Event) {
  const target = e.target as HTMLInputElement;
  if (!target.files || target.files.length === 0) return;

  try {
    uploadingImage.value = true;
    const file = target.files[0];
    const formData = new FormData();
    formData.append("file", file!);

    const response = await $fetch<{ fileUrl: string }>("/api/storage/upload", {
      method: "POST",
      body: formData,
    });

    if (response?.fileUrl) {
      uploadedImages.value.push(response.fileUrl);
    }
  } catch (err) {
    console.error("Upload error", err);
  } finally {
    uploadingImage.value = false;
  }
}

function onSubmit(event: FormSubmitEvent<z.output<typeof eventSchema>>) {
  emit("save", { data: event.data, images: uploadedImages.value });
}
</script>

<template>
  <USlideover :open="open" @update:open="emit('update:open', $event)">
    <template #content>
      <div
        class="w-[540px] h-full bg-white dark:bg-gray-900 shadow-xl flex flex-col overflow-y-auto"
      >
        <div
          class="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between"
        >
          <h3
            class="text-lg font-black tracking-tight text-gray-900 dark:text-white"
          >
            {{ isEditing ? "✏️ Edit Event Details" : "➕ Host a New Event" }}
          </h3>
          <UButton
            variant="ghost"
            icon="i-heroicons-x-mark"
            class="text-gray-400 hover:text-gray-500"
            @click="emit('update:open', false)"
          />
        </div>

        <div class="p-6 flex-1">
          <UForm
            :schema="eventSchema"
            :state="initialState"
            class="space-y-4"
            @submit="onSubmit"
          >
            <div
              class="space-y-3 border-b border-gray-100 dark:border-gray-800 pb-5"
            >
              <label
                class="text-sm font-bold text-gray-900 dark:text-white block"
                >Event Cover Banners</label
              >
              <label
                class="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl p-5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
              >
                <UIcon
                  :name="
                    uploadingImage
                      ? 'i-heroicons-arrow-path'
                      : 'i-heroicons-photo'
                  "
                  :class="[
                    'w-7 h-7 text-gray-400',
                    { 'animate-spin': uploadingImage },
                  ]"
                />
                <span
                  class="text-xs font-semibold text-gray-600 dark:text-gray-400 mt-2"
                >
                  {{
                    uploadingImage
                      ? "Uploading to Cloudflare R2..."
                      : "Drop or click to upload banner image"
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

              <div
                v-if="uploadedImages.length > 0"
                class="grid grid-cols-3 gap-2 mt-3"
              >
                <div
                  v-for="(url, index) in uploadedImages"
                  :key="index"
                  class="relative aspect-video rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800"
                >
                  <img :src="url" class="w-full h-full object-cover" />
                  <div
                    v-if="index === 0"
                    class="absolute top-1 left-1 bg-primary-500 text-white text-[9px] px-1 py-0.5 rounded font-black uppercase tracking-wider shadow"
                  >
                    Cover
                  </div>
                </div>
              </div>
            </div>

            <UFormField label="Event Title" name="title" required
              ><UInput v-model="initialState.title" class="w-full"
            /></UFormField>
            <UFormField label="Detailed Description" name="description" required
              ><UTextarea
                v-model="initialState.description"
                :rows="4"
                class="w-full"
            /></UFormField>
            <div class="grid grid-cols-2 gap-4">
              <UFormField label="Start Date & Time" name="start_time" required
                ><UInput
                  v-model="initialState.start_time"
                  type="datetime-local"
              /></UFormField>
              <UFormField label="End Date & Time" name="end_time" required
                ><UInput v-model="initialState.end_time" type="datetime-local"
              /></UFormField>
            </div>
            <UFormField
              label="Venue / Location Address"
              name="location"
              required
              ><UInput
                v-model="initialState.location"
                icon="i-heroicons-map-pin"
            /></UFormField>
            <div class="grid grid-cols-2 gap-4">
              <UFormField label="Ticket Price (IDR)" name="price" required
                ><UInput
                  v-model="initialState.price"
                  type="number"
                  icon="i-heroicons-banknotes"
              /></UFormField>
              <UFormField
                label="Max Participant Capacity"
                name="total_capacity"
                required
                ><UInput
                  v-model="initialState.total_capacity"
                  type="number"
                  icon="i-heroicons-users"
              /></UFormField>
            </div>
            <UButton
              type="submit"
              block
              variant="solid"
              size="lg"
              class="font-bold mt-6"
              :loading="processing"
            >
              {{
                isEditing ? "Save Configuration Changes" : "Publish Event Live"
              }}
            </UButton>
          </UForm>
        </div>
      </div>
    </template>
  </USlideover>
</template>
