<script setup lang="ts">
import type { DropdownMenuItem, NavigationMenuItem } from "@nuxt/ui";

const route = useRoute();
const supabase = useSupabaseClient();
const { user, profile } = useProfile();

const navItems = computed<NavigationMenuItem[]>(() => [
  {
    label: "Events",
    to: "/",
    active: route.path === "/",
  },
  {
    label: "Orders",
    to: "/orders",
    active: route.path.startsWith("/orders"),
  },
  {
    label: "Tickets",
    to: "/tickets",
    active: route.path.startsWith("/tickets"),
  },
  {
    label: "About",
    to: "/about",
    active: route.path.startsWith("/about"),
  },
]);
const dropDownItems = computed<DropdownMenuItem[][]>(() => [
  [
    {
      label: profile.value?.email || user.value?.email || "Guest User",
      avatar: {
        src: profile.value?.avatar_url || "https://github.com/nuxt.png",
        loading: "lazy",
      },
      type: "label",
    },
  ],
  [
    {
      label: "Profile",
      icon: "i-lucide-user",
      to: "/profile",
    },
    {
      label: "Settings",
      icon: "i-lucide-cog",
      to: "/settings",
    },
  ],
  [
    {
      label: "Organizing",
      icon: "i-lucide-notebook-pen",
      to: "/organizing",
    },
    {
      label: "Support",
      icon: "i-lucide-circle-help",
      to: "/support",
    },
  ],
  [
    {
      label: "Logout",
      icon: "i-lucide-log-out",
      color: "error",
      onSelect: handleLogout,
    },
  ],
]);

const isOrganizer = computed(() => {
  return profile.value?.role === "organizer";
});

async function handleLogout() {
  await supabase.auth.signOut();
  navigateTo("/login");
}
</script>

<template>
  <UHeader>
    <template #title>
      <h1 class="font-bold tracking-wider text-xl">EVENTICK</h1>
    </template>

    <UNavigationMenu :items="navItems" />

    <template #right>
      <UColorModeButton />

      <div v-if="user" class="flex items-center gap-2">
        <UDropdownMenu :items="dropDownItems">
          <UButton
            :avatar="{
              src: profile?.avatar_url || 'https://github.com/nuxt.png',
              loading: 'lazy',
            }"
            color="neutral"
            variant="outline"
          >
            {{ profile?.email || user?.email }}
          </UButton>
        </UDropdownMenu>

        <UButton
          v-if="isOrganizer"
          to="/dashboard"
          color="primary"
          variant="solid"
        >
          Dashboard
        </UButton>
      </div>

      <UButton v-else to="/login" variant="solid">Login</UButton>
    </template>
  </UHeader>
</template>
