<script setup lang="ts">
const supabase = useSupabaseClient()
const user = useSupabaseUser()
const router = useRouter()

async function handleLogout() {
    await supabase.auth.signOut()
    router.push("/login")
}

</script>

<template>
    <div class="p-8 space-y-4">
        <UCard>
            <h1 class="text-3xl font-bold">Eventtick Dashboard</h1>
            <p class="text-gray-600 dark:text-gray-400 mt-2">
                Welcome back, <span class="font-semibold text-primary-500">{{ user?.email }}</span>!
            </p>

            <div class="mt-6">
                <UButton color="warning" variant="soft" @click="handleLogout">
                    Log Out
                </UButton>
            </div>
        </UCard>
    </div>
</template>