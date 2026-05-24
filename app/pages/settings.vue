<script setup lang="ts">
import type { FormSubmitEvent } from "@nuxt/ui";
import { z } from "zod";

const supabase = useSupabaseClient();
const user = useSupabaseUser();
const router = useRouter();

// UI States
const loadingProfile = ref(true);
const submittingOrg = ref(false);
const toastMessage = ref({ text: "", color: "green" });

// App Database States
const userRole = ref<"attendee" | "organizer" | "admin">("attendee");
const currentOrgName = ref<string | null>(null);

// 1. Define Zod validation schema for becoming an organizer
const orgSchema = z.object({
  name: z.string().min(3, "Organization name must be at least 3 characters"),
  description: z
    .string()
    .min(10, "Please provide a short description (min 10 characters)"),
});
type OrgSchema = z.output<typeof orgSchema>;

const orgState = reactive({
  name: "",
  description: "",
});

// 2. Fetch profile data on page load
async function fetchUserProfile() {
  try {
    loadingProfile.value = true;

    // 1. Get the absolute source-of-truth user session object directly from Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) return;

    const currentUserId = authData.user.id;
    const db = supabase as any;

    // 2. Query our profiles table safely
    const { data, error } = await db
      .from("profiles")
      .select("role, organizations(name)")
      .eq("id", currentUserId)
      .single(); // Safer than .single() because it handles empty rows gracefully without throwing

    if (error) throw error;

    if (data) {
      userRole.value = data.role;

      // 3. Clean extraction of the nested relational join data object
      if (data.organizations) {
        // When untyped, Supabase joins can return either an object or a single-item array
        currentOrgName.value = Array.isArray(data.organizations)
          ? data.organizations[0]?.name
          : data.organizations.name;
      }
    }
  } catch (error) {
    showToast("Failed to load profile data.", "red");
  } finally {
    loadingProfile.value = false;
  }
}

async function onRegisterOrganization(event: FormSubmitEvent<OrgSchema>) {
  try {
    submittingOrg.value = true;
    showToast("", "green");

    const db = supabase as any;

    const { error } = await db.rpc("become_organizer", {
      org_name: event.data.name,
      org_desc: event.data.description,
    });

    if (error) throw error;

    userRole.value = "organizer";
    currentOrgName.value = event.data.name;
    showToast("Success! You are now an official Event Organizer.", "green");
  } catch (error) {
    if (error instanceof Error) {
      showToast(error.message, "red");
    }
  } finally {
    submittingOrg.value = false;
  }
}

async function handleLogout() {
  await supabase.auth.signOut();
  router.push("/login");
}

function showToast(text: string, color: "green" | "red") {
  toastMessage.value = { text, color };
}

onMounted(() => {
  fetchUserProfile();
});
</script>

<template>
  <div class="max-w-3xl mx-auto p-6 space-y-6">
    <header>
      <h1 class="text-3xl font-bold tracking-tight">Account Settings</h1>
      <p class="text-gray-500 dark:text-gray-400 mt-1">
        Manage your profile updates and organizing parameters.
      </p>
    </header>

    <UAlert
      v-if="toastMessage.text"
      icon="i-heroicons-information-circle"
      :color="toastMessage.color"
      variant="soft"
      :title="toastMessage.text"
    />

    <div v-if="loadingProfile" class="space-y-4">
      <USkeleton class="h-32 w-full" />
      <USkeleton class="h-48 w-full" />
    </div>

    <div v-else class="space-y-4">
      <UCard>
        <template #header>
          <h3 class="text-lg font-semibold">User Identification</h3>
        </template>

        <div class="space-y-4">
          <div>
            <label class="text-xs font-medium text-gray-400 block mb-1"
              >Email Address</label
            >
            <div
              class="text-sm font-medium text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-900 px-3 py-2 rounded-md"
            >
              {{ user?.email }}
            </div>
          </div>

          <div>
            <label class="text-xs font-medium text-gray-400 block mb-1"
              >Current Account Role</label
            >
            <UBadge
              :color="userRole === 'organizer' ? 'primary' : 'gray'"
              size="md"
              variant="solid"
            >
              {{ userRole.toUpperCase() }}
            </UBadge>
          </div>
        </div>
      </UCard>

      <UCard
        v-if="userRole === 'organizer'"
        class="border border-primary-500/20 bg-primary-500/5"
      >
        <div class="flex items-start space-x-4">
          <div class="p-3 bg-primary-500/10 text-primary-500 rounded-lg">
            <UIcon name="i-heroicons-building-office" class="w-6 h-6" />
          </div>

          <div>
            <h3
              class="text-lg font-semibold text-primary-900 dark:text-primary-400"
            >
              Verified Organizer Profile
            </h3>
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Your account is successfully linked to **{{ currentOrgName }}**.
              You can now create and manage ticket distributions directly from
              the host dashboard.
            </p>
          </div>
        </div>
      </UCard>

      <UCard v-else>
        <template #header>
          <div class="flex items-center space-x-2">
            <UIcon name="i-heroicons-sparkles" class="w-5 h-5 text-amber-500" />
            <h3 class="text-lg font-semibold">Become an Event Organizer</h3>
          </div>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Want to list your own music concerts, developer tech meetups, or
            gaming tournaments? Register your brand below to open creator
            permissions.
          </p>
        </template>

        <UForm
          :schema="orgSchema"
          :state="orgState"
          class="space-y-4"
          @submit="onRegisterOrganization"
        >
          <UFormGroup label="Organization / Brand Name" name="name" required>
            <UInput
              v-model="orgState.name"
              placeholder="e.g., Pixel Forge Tournaments"
              icon="i-heroicons-building-office-2"
            />
          </UFormGroup>

          <UFormGroup
            label="Description / Bios"
            name="description"
            required
            hint="What kind of events do you host?"
          >
            <UTextarea
              v-model="orgState.description"
              placeholder="Provide event context details..."
            />
          </UFormGroup>

          <UButton type="submit" color="amber" :loading="submittingOrg">
            Register Brand & Upgrade Account
          </UButton>
        </UForm>
      </UCard>

      <UCard class="border border-red-500/20">
        <template #header>
          <h3 class="text-lg font-semibold text-red-500">Session Actions</h3>
        </template>

        <div class="flex justify-between items-center">
          <p class="text-sm text-gray-500 dark:text-gray-400">
            Disconnect your security session from this browser device.
          </p>
          <UButton
            color="red"
            variant="soft"
            icon="i-heroicons-arrow-left-on-rectangle"
            @click="handleLogout"
          >
            Log Out Account
          </UButton>
        </div>
      </UCard>
    </div>
  </div>
</template>
