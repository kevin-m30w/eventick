<script setup lang="ts">
const user = useSupabaseUser()
const router = useRouter()

watch(user, (newUser) => {
    if (newUser) {
        router.push('/dashboard')
    }
}, {immediate: true})
</script>

<template>
    <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div class="text-center space-y-3">
            <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-primary-500" />
            <p class="text-gray-600 dark:text-gray-400 text-sm">Confirming your security session...</p>
        </div>
    </div>
</template>