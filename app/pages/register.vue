<script setup lang="ts">
import type { FormSubmitEvent } from "@nuxt/ui"
import { z } from "zod"

const supabase = useSupabaseClient()
const router = useRouter()

const loading = ref(false)
const serverError = ref('')
const successMessage =  ref('')

const schema = z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
    message: "Password don't match",
    path: ['confirmPassword']
})

type Schema = z.output<typeof schema>

const state = reactive({
    email: '',
    password: '',
    confirmPassword: '',
})

async function onSubmit(event: FormSubmitEvent<Schema>) {
    try {
        loading.value = true
        serverError.value = ''
        successMessage.value = ''

        const { data, error } = await supabase.auth.signUp({
            email: event.data.email,
            password: event.data.password,
            options: {
                emailRedirectTo: `${window.location.origin}/confirm`
            }
        })

        if (error) throw error

        if (data.user && data.session === null) {
            successMessage.value = "Registration successful! Please check your email to confirm your account."
        } else {
            router.push('/dashboard')
        }
    } catch (error) {
        if (error instanceof Error) {
            serverError.value = error.message
        } else {
            serverError.value = 'An unexpected error occurred.'
        }
    } finally {
        loading.value = false
    }
}
</script>

<template>
    <UCard class="w-full max-w-md">
        <template #header>
            <div class="text-center">
                <h1 class="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                    Create your Eventtick Account
                </h1>
                <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Get ready to host and discover amazing events
                </p>
            </div>
        </template>

        <UForm :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
            <UAlert 
                v-if="serverError"
                icon="i-heroicons-exclamation-triangle"
                color="red"
                variant="soft"
                :title="serverError"
            />

            <UAlert 
                v-if="successMessage"
                icon="i-heroicons-check-circle"
                color="green"
                variant="soft"
                :title="successMessage"
            />

            <UFormGroup label="Email Address" name="email" eager-validation>
                <UInput
                    v-model="state.email"
                    type="email"
                    placeholder="you@example.com"
                    icon="i-heroicons-envelope"
                />
            </UFormGroup>

            <UFormGroup label="Password" name="password" eager-validation>
                <UInput
                    v-model="state.password"
                    type="password"
                    placeholder="••••••••"
                    icon="i-heroicons-lock-closed"
                />
            </UFormGroup>

            <UFormGroup label="Confirm Password" name="confirmPassword" eager-validation>
                <UInput
                    v-model="state.confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    icon="i-heroicons-shield-check"
                />
            </UFormGroup>

            <UButton type="submit" block :loading="loading" color="primary">
                register
            </UButton>
        </UForm>

        <template #footer>
            <p class="text-center text-sm text-gray-500 dark:text-gray-400">
                Already have an account? 
                <NuxtLink to="/login" class="text-primary-500 font-medium hover:underline">
                    Sign In
                </NuxtLink>
            </p>
        </template>
    </UCard>
</template>