<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute } from "vue-router";

const route = useRoute();
const supabase = useSupabaseClient() as any;
const user = useSupabaseUser();

// App Page States
const loading = ref(true);
const booking = ref(false);
const eventData = ref<any>(null);
const ticketQuantity = ref(1);
const toastMessage = ref({ text: "", color: "green" });

// Calculate dynamic total cost based on quantity state changes
const totalCost = computed(() => {
  if (!eventData.value) return 0;
  return eventData.value.price * ticketQuantity.value;
});

// Fetch detailed single event data with image references
async function fetchEventDetails() {
  try {
    loading.value = true;

    // 💡 FIXED: Filter inside the select string statement to prevent PostgREST parsing anomalies
    const { data, error } = await supabase
      .from("events")
      .select(
        `
        id,
        title,
        description,
        location,
        start_time,
        price,
        total_capacity,
        event_images(image_url)
      `,
      )
      .eq("id", route.params.id)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error("This event parameters could not be found.");

    eventData.value = data;
  } catch (err: any) {
    showToast(err.message || "Failed to load event context.", "red");
  } finally {
    loading.value = false;
  }
}

// Order placement logic trace matching your dual-table relationship layout
async function handleTicketPurchase() {
  // 💡 YOUR FIX: Grab the absolute, clean user string straight from Auth
  const { data: authData } = await supabase.auth.getUser();
  const activeUser = authData.user;

  if (!activeUser) {
    showToast("Please log in or create an account to secure tickets.", "red");
    return;
  }

  try {
    booking.value = true;
    clearToast();

    // 1. Create a secure "pending" Master Order entry row in Supabase
    const { data: newOrder, error: orderErr } = await supabase
      .from("orders")
      .insert({
        user_id: activeUser.id, // 💡 Using the clean, guaranteed string ID here!
        event_id: eventData.value.id,
        total_amount: totalCost.value,
        status: "pending",
        payment_intent_id: null,
      })
      .select()
      .single();

    if (orderErr) throw orderErr;

    // 2. Fetch the secure Gateway Token from your custom Nuxt server endpoint
    const paymentResponse = await $fetch("/api/payment/checkout", {
      method: "POST",
      body: {
        orderId: newOrder.id,
        totalAmount: totalCost.value,
        eventTitle: eventData.value.title,
        quantity: ticketQuantity.value, // 💡 FIXED: Passing quantity parameters explicitly down the pipe
      },
    });

    if (!paymentResponse?.token) {
      throw new Error("Could not initialize payment gateway session token.");
    }

    // 3. Activate the client-side Midtrans Snap Modal overlay instantly
    window.snap.pay(paymentResponse.token, {
      onSuccess: function (result) {
        showToast(
          "Payment captured successfully! Redirecting to orders center...",
          "green",
        );
        navigateTo("/orders");
      },
      onPending: function (result) {
        showToast(
          "Order initialized. Please finalize your Virtual Account or QRIS transfer.",
          "amber",
        );
        navigateTo("/orders");
      },
      onError: function (result) {
        showToast(
          "Gateway connection failure. Please attempt processing your payment transaction again.",
          "red",
        );
      },
      onClose: function () {
        showToast(
          "Payment modal dismissed. You can complete your transaction anytime from your dashboard.",
          "amber",
        );
      },
    });
  } catch (err: any) {
    showToast(err.message || "Checkout transaction tracking aborted.", "red");
  } finally {
    booking.value = false;
  }
}

// Formatting helpers
function formatCurrency(amount: number) {
  if (amount === 0) return "FREE";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(isoString: string) {
  return new Date(isoString).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function showToast(text: string, color: "green" | "red") {
  toastMessage.value = { text, color };
}
function clearToast() {
  toastMessage.value = { text: "", color: "green" };
}

onMounted(() => {
  fetchEventDetails();
});
</script>

<template>
  <div class="max-w-6xl mx-auto p-6 space-y-6">
    <UAlert
      v-if="toastMessage.text"
      icon="i-heroicons-information-circle"
      :color="toastMessage.color"
      variant="soft"
      :title="toastMessage.text"
      class="mb-4"
    />

    <div v-if="loading" class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div class="lg:col-span-2 space-y-4">
        <USkeleton class="h-64 w-full rounded-2xl" />
        <USkeleton class="h-10 w-2/3" />
        <USkeleton class="h-20 w-full" />
      </div>
      <USkeleton class="h-48 w-full rounded-2xl" />
    </div>

    <div v-else-if="eventData" class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div class="lg:col-span-2 space-y-6">
        <div
          class="relative aspect-video w-full rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm"
        >
          <img
            :src="
              eventData.event_images?.[0]?.image_url ||
              'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?q=80&w=1200'
            "
            class="w-full h-full object-cover"
          />
        </div>

        <div class="space-y-3">
          <h1 class="text-3xl sm:text-4xl font-extrabold tracking-tight">
            {{ eventData.title }}
          </h1>

          <div
            class="flex flex-wrap gap-4 text-sm font-medium text-gray-500 dark:text-gray-400"
          >
            <div class="flex items-center space-x-1">
              <UIcon
                name="i-heroicons-calendar"
                class="text-primary-500 w-5 h-5"
              />
              <span>{{ formatDate(eventData.start_time) }}</span>
            </div>
            <div class="flex items-center space-x-1">
              <UIcon
                name="i-heroicons-map-pin"
                class="text-primary-500 w-5 h-5"
              />
              <span>{{ eventData.location }}</span>
            </div>
          </div>
        </div>

        <UDivider />

        <div class="space-y-2">
          <h3 class="text-lg font-bold tracking-tight">About This Event</h3>
          <p
            class="text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap"
          >
            {{ eventData.description }}
          </p>
        </div>
      </div>

      <div class="space-y-4">
        <UCard
          class="sticky top-6 shadow-sm border border-gray-100 dark:border-gray-800"
        >
          <template #header>
            <h3
              class="text-md font-bold text-gray-400 uppercase tracking-wider"
            >
              Ticket Registration
            </h3>
          </template>

          <div class="space-y-5">
            <div class="flex justify-between items-baseline">
              <span class="text-sm text-gray-500 font-medium"
                >Ticket Price:</span
              >
              <span class="text-2xl font-black text-primary-500">
                {{ formatCurrency(eventData.price) }}
              </span>
            </div>

            <div
              class="flex justify-between items-center bg-gray-50 dark:bg-gray-900 p-3 rounded-xl border border-gray-100 dark:border-gray-800"
            >
              <span
                class="text-sm font-semibold text-gray-600 dark:text-gray-400"
                >Quantity</span
              >
              <div class="flex items-center space-x-3">
                <UButton
                  :disabled="ticketQuantity <= 1"
                  icon="i-heroicons-minus"
                  size="xs"
                  color="gray"
                  variant="soft"
                  @click="ticketQuantity--"
                />
                <span class="font-bold text-md w-4 text-center">
                  {{ ticketQuantity }}
                </span>
                <UButton
                  :disabled="ticketQuantity >= 10"
                  icon="i-heroicons-plus"
                  size="xs"
                  color="gray"
                  variant="soft"
                  @click="ticketQuantity++"
                />
              </div>
            </div>

            <UDivider border-style="dashed" />

            <div class="flex justify-between items-baseline text-lg font-bold">
              <span>Total Payment:</span>
              <span
                class="text-2xl font-extrabold text-gray-900 dark:text-white"
              >
                {{ formatCurrency(totalCost) }}
              </span>
            </div>

            <UButton
              block
              size="lg"
              color="primary"
              :loading="booking"
              icon="i-heroicons-ticket"
              @click="handleTicketPurchase"
            >
              {{ user ? "Secure Booking Entry" : "Log In to Buy Tickets" }}
            </UButton>
          </div>
        </UCard>
      </div>
    </div>
  </div>
</template>
