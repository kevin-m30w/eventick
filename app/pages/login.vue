<script setup lang="ts">
const supabase = useSupabaseClient()
const router = useRouter()

const email = ref('')
const password = ref('')
const loading = ref(false)
const errorMessage = ref('')

async function handleLogin() {
  try {
    loading.value = true
    errorMessage.value = ''
    
    const { error } = await supabase.auth.signInWithPassword({
      email: email.value,
      password: password.value,
    })

    if (error) throw error

    router.push('/dashboard')
  } catch (error) {
    if (error instanceof Error) {
        errorMessage.value = error.message
    } else {
        errorMessage.value = 'An error occurred during login.'
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
    <div class="min-h-screen flex justify-center items-center bg-gray-50 dark:bg-gray-950 px-4">
        <UCard class="w-full max-w-md">
            <template #header>
                <div class="text-center">
                    <h1 class="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                        Welcome to Eventtick
                    </h1>
                    <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Sign in to manage your tickets
                    </p>
                </div>
            </template>

            <form @submit.prevent="handleLogin" class="space-y-4">
                <UAlert 
                    v-if="errorMessage"
                    icon="i-heroicons-exclamation-triangle"
                    color="red"
                    variant="soft"
                    :title="errorMessage"
                />

                <UFormGroup label="Email Address" name="email" required>
                    <UInput 
                        v-model="email" 
                        type="email" 
                        placeholder="you@example.com" 
                        icon="i-heroicons-envelope"
                        autocomplete="email"
                    />
                </UFormGroup>

                <UFormGroup label="Password" name="password" required>
                    <UInput 
                        v-model="password" 
                        type="password" 
                        placeholder="••••••••" 
                        icon="i-heroicons-lock-closed"
                        autocomplete="current-password"
                    />
                </UFormGroup>
                
                <UButton type="submit" block :loading="loading" color="primary">
                    Sign In
                </UButton>
            </form>

            <template #footer>
                <p class="text-center text-sm text-gray-500 dark:text-gray-400">
                    Don't have an account? 
                    <NuxtLink to="/register" class="text-primary-500 font-medium hover:underline">
                        Register
                    </NuxtLink>
                </p>
            </template>
        </UCard>
    </div>
</template>