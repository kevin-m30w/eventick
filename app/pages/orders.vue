<script setup lang="ts">
import { ref, onMounted } from "vue";
import QrcodeVue from "qrcode.vue"; // 💡 FIXED: Explicitly importing the QR engine component

const supabase = useSupabaseClient() as any;

// Page UI States
const loadingOrders = ref(true);
const loadingTickets = ref(false);
const ordersList = ref<any[]>([]);

// Modal Control States
const isOpen = ref(false);
const selectedOrder = ref<any>(null);
const associatedTickets = ref<any[]>([]);

// 1. Fetch all orders belonging to the logged-in user
async function fetchUserOrders() {
  try {
    loadingOrders.value = true;

    // 💡 FIXED: Go straight to the source-of-truth token session identifier string
    const { data: authData } = await supabase.auth.getUser();
    const currentUserId = authData.user?.id;

    if (!currentUserId) return;

    const { data, error } = await supabase
      .from("orders")
      .select(
        `
        id,
        total_amount,
        status,
        created_at,
        events (
          id,
          title,
          location,
          start_time
        )
      `,
      )
      .eq("user_id", currentUserId) // Ensuring we match the correct user scope explicitly
      .order("created_at", { ascending: false });

    if (error) throw error;
    ordersList.value = data || [];
  } catch (error: any) {
    console.error("Error fetching transactions:", error.message);
  } finally {
    loadingOrders.value = false;
  }
}

// 2. Open modal and fetch individual ticket data if order is completed
async function handleOpenOrderDetails(order: any) {
  selectedOrder.value = order;
  isOpen.value = true;
  associatedTickets.value = [];

  if (order.status === "completed") {
    try {
      loadingTickets.value = true;
      const { data, error } = await supabase
        .from("tickets")
        .select("id, ticket_code, status")
        .eq("order_id", order.id);

      if (error) throw error;
      associatedTickets.value = data || [];
    } catch (error: any) {
      console.error("Error fetching tickets:", error.message);
    } finally {
      loadingTickets.value = false;
    }
  }
}

// Visual Helpers
function getStatusBadge(status: string) {
  switch (status) {
    case "completed":
      return { color: "green", label: "Completed" };
    case "pending":
      return { color: "amber", label: "Pending Payment" };
    case "failed":
      return { color: "red", label: "Failed" };
    default:
      return { color: "gray", label: status };
  }
}

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
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function handleResumePayment(order: any) {
  try {
    const paymentResponse = await $fetch("/api/payment/checkout", {
      method: "POST",
      body: {
        orderId: order.id,
        totalAmount: order.total_amount,
        eventTitle: order.events?.title || "Event Admission Ticket",
      },
    });

    if (!paymentResponse?.token) {
      throw new Error("Failed to re-initialize active gateway connection.");
    }

    isOpen.value = false;

    window.snap.pay(paymentResponse.token, {
      onSuccess: function () {
        fetchUserOrders();
      },
      onPending: function () {
        fetchUserOrders();
      },
      onError: function () {
        alert("Payment processing error. Try again.");
      },
      onClose: function () {
        fetchUserOrders();
      },
    });
  } catch (err: any) {
    alert(err.message || "Could not launch checkout interface.");
  }
}

onMounted(() => {
  fetchUserOrders();
});
</script>

<template>
  <div class="max-w-5xl mx-auto p-6 space-y-6">
    <header class="border-b border-gray-100 dark:border-gray-800 pb-4">
      <h1 class="text-3xl font-bold tracking-tight">My Ticket Orders</h1>
      <p class="text-gray-500 dark:text-gray-400 mt-1">
        Track transaction processing parameters and access entry codes.
      </p>
    </header>

    <div v-if="loadingOrders" class="space-y-4">
      <USkeleton v-for="n in 3" :key="n" class="h-20 w-full rounded-xl" />
    </div>

    <div
      v-else-if="ordersList.length === 0"
      class="text-center py-16 border border-dashed border-gray-200 dark:border-gray-800 rounded-2xl"
    >
      <UIcon
        name="i-heroicons-shopping-bag"
        class="w-12 h-12 text-gray-400 mx-auto"
      />
      <h3 class="text-md font-semibold mt-4 text-gray-900 dark:text-white">
        No orders recorded
      </h3>
      <p class="text-sm text-gray-500 mt-1">
        You haven't reserved tickets for any events yet.
      </p>
      <UButton to="/" color="primary" class="mt-4">Browse Live Events</UButton>
    </div>

    <div v-else class="space-y-3">
      <div
        v-for="order in ordersList"
        :key="order.id"
        class="flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl shadow-sm hover:border-primary-500/50 dark:hover:border-primary-500/50 transition-colors cursor-pointer gap-4"
        @click="handleOpenOrderDetails(order)"
      >
        <div class="space-y-1">
          <h3 class="text-lg font-bold text-gray-900 dark:text-white">
            {{ order.events?.title }}
          </h3>
          <div
            class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400 font-medium"
          >
            <span class="flex items-center gap-1">
              <UIcon name="i-heroicons-map-pin" />
              {{ order.events?.location }}
            </span>
            <span class="flex items-center gap-1">
              <UIcon name="i-heroicons-calendar" />
              {{ formatDate(order.events?.start_time) }}
            </span>
          </div>
        </div>

        <div
          class="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-0 pt-3 sm:pt-0 border-gray-50 dark:border-gray-800"
        >
          <div class="text-left sm:text-right">
            <p class="text-sm text-gray-400 font-medium">Total Paid</p>
            <p class="text-lg font-black text-gray-900 dark:text-white">
              {{ formatCurrency(order.total_amount) }}
            </p>
          </div>
          <UBadge
            :color="getStatusBadge(order.status).color"
            variant="soft"
            size="md"
            class="font-bold uppercase"
          >
            {{ getStatusBadge(order.status).label }}
          </UBadge>
        </div>
      </div>
    </div>

    <UModal v-model="isOpen">
      <UCard
        v-if="selectedOrder"
        :ui="{ divide: 'divide-y divide-gray-100 dark:divide-gray-800' }"
      >
        <template #header>
          <div class="flex justify-between items-center">
            <h3
              class="text-base font-bold leading-6 text-gray-900 dark:text-white"
            >
              Transaction Breakdown
            </h3>
            <UButton
              color="gray"
              variant="ghost"
              icon="i-heroicons-x-mark"
              class="-my-1"
              @click="isOpen = false"
            />
          </div>
        </template>

        <div class="space-y-4 py-2">
          <div>
            <label
              class="text-xs font-bold text-gray-400 uppercase tracking-wider block"
              >Target Event</label
            >
            <p class="text-md font-bold text-gray-900 dark:text-white mt-0.5">
              {{ selectedOrder.events?.title }}
            </p>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label
                class="text-xs font-bold text-gray-400 uppercase tracking-wider block"
                >Order Reference ID</label
              >
              <p class="text-xs font-mono mt-1 text-gray-500 truncate">
                {{ selectedOrder.id }}
              </p>
            </div>
            <div>
              <label
                class="text-xs font-bold text-gray-400 uppercase tracking-wider block"
                >Transaction Date</label
              >
              <p class="text-sm font-medium mt-0.5">
                {{ formatDate(selectedOrder.created_at) }}
              </p>
            </div>
          </div>

          <UDivider />

          <div
            v-if="selectedOrder.status === 'pending'"
            class="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl p-4 text-center space-y-3"
          >
            <UIcon
              name="i-heroicons-credit-card"
              class="w-8 h-8 text-amber-500 mx-auto"
            />
            <div class="space-y-1">
              <h4 class="text-sm font-bold text-amber-800 dark:text-amber-400">
                Payment Awaiting Verification
              </h4>
              <p class="text-xs text-amber-600 dark:text-amber-500">
                Your order is locked. Complete your Virtual Account or QRIS
                transfer to issue active gateway passes.
              </p>
            </div>

            <UButton
              color="amber"
              block
              class="font-bold"
              @click="handleResumePayment(selectedOrder)"
            >
              Pay Now (Simulate Gateway)
            </UButton>
          </div>

          <div
            v-else-if="selectedOrder.status === 'completed'"
            class="space-y-3"
          >
            <label
              class="text-xs font-bold text-gray-400 uppercase tracking-wider block"
            >
              Your Admission Passes ({{ associatedTickets.length }})
            </label>

            <div v-if="loadingTickets" class="space-y-2">
              <USkeleton class="h-12 w-full" />
            </div>

            <div v-else class="space-y-2 max-h-60 overflow-y-auto pr-1">
              <div
                v-for="ticket in associatedTickets"
                :key="ticket.id"
                class="flex flex-col sm:flex-row items-center justify-between p-4 bg-gray-50 dark:bg-gray-950 rounded-xl border border-gray-100 dark:border-gray-800 gap-4"
              >
                <div class="space-y-1 text-center sm:text-left">
                  <p class="text-xs font-bold text-gray-400">ADMISSION PASS</p>
                  <p class="text-sm font-mono font-bold text-primary-500">
                    {{ ticket.ticket_code }}
                  </p>
                  <UBadge
                    :color="ticket.status === 'valid' ? 'green' : 'gray'"
                    size="xs"
                    variant="soft"
                    class="uppercase font-bold"
                  >
                    {{ ticket.status }}
                  </UBadge>
                </div>

                <div
                  class="bg-white p-2 rounded-lg border border-gray-100 dark:border-gray-800 shadow-sm flex items-center justify-center"
                >
                  <qrcode-vue
                    :value="ticket.ticket_code"
                    :size="80"
                    level="H"
                    render-as="svg"
                    background="#ffffff"
                    foreground="#000000"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </UCard>
    </UModal>
  </div>
</template>
