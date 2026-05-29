<script setup lang="ts">
import { Html5QrcodeScanner } from "html5-qrcode";

definePageMeta({
  middleware: ["organizer-only"],
  layout: "dashboard",
});

const supabase = useSupabaseClient() as any;

// Scanner Interface States
const scanResult = ref("");
const scannedTicketInfo = ref<any>(null);
const systemStatus = ref<{
  text: string;
  color: "green" | "red" | "amber" | "gray";
}>({
  text: "Awaiting incoming scanner ticket code data feed stream...",
  color: "gray",
});

let scannerInstance: any = null;

// Core QR Scanner Processing Trace
async function processScannedCode(decodedText: string) {
  // Guard clause: Prevent duplicate scans while a request is active
  if (scanResult.value === decodedText) return;

  scanResult.value = decodedText;
  scannedTicketInfo.value = null;

  try {
    systemStatus.value = {
      text: "Verifying signature credentials with database...",
      color: "amber",
    };

    // 1. Look up the ticket pass entry row in Supabase matching the read text string
    const { data: ticket, error: fetchErr } = await supabase
      .from("tickets")
      .select(
        `
        id,
        ticket_code,
        status,
        events ( title, location )
      `,
      )
      .eq("ticket_code", decodedText)
      .maybeSingle();

    if (fetchErr) throw fetchErr;

    if (!ticket) {
      systemStatus.value = {
        text: "❌ INVALID PASS: This ticket hash code does not exist in our system records!",
        color: "red",
      };
      return;
    }

    scannedTicketInfo.value = ticket;

    // 2. Ticket Status Verification Routing Constraints
    if (ticket.status === "scanned") {
      systemStatus.value = {
        text: `⚠️ FRAUD DETECTED: This ticket was already scanned at ${ticket.scanned_at ? new Date(ticket.scanned_at).toLocaleTimeString() : "an earlier time"}! Access Denied.`,
        color: "red",
      };
      return;
    }

    if (ticket.status === "refunded") {
      systemStatus.value = {
        text: "❌ VOID PASS: This registration entry has been fully refunded.",
        color: "red",
      };
      return;
    }

    // 3. Complete Check-In: Switch status to scanned and log the exact check-in time stamp
    const { error: updateErr } = await supabase
      .from("tickets")
      .update({
        status: "scanned",
        scanned_at: new Date().toISOString(),
      })
      .eq("id", ticket.id);

    if (updateErr) throw updateErr;

    systemStatus.value = {
      text: `✅ ACCESS GRANTED: Successfully checked in for "${ticket.events?.title}"!`,
      color: "green",
    };
  } catch (error: any) {
    systemStatus.value = {
      text: `System processing crash: ${error.message}`,
      color: "red",
    };
  }
}

onMounted(() => {
  // Initialize the camera hardware reader container layout parameters
  scannerInstance = new Html5QrcodeScanner(
    "qr-reader-container",
    { fps: 10, qrbox: { width: 250, height: 250 } },
    /* verbose= */ false,
  );

  scannerInstance.render(
    (decodedText: string) => processScannedCode(decodedText),
    (error: any) => {
      /* Quietly catch scanning framing noise */
    },
  );
});

onUnmounted(() => {
  if (scannerInstance) {
    scannerInstance
      .clear()
      .catch((err: any) => console.error("Error clearing scanner layout", err));
  }
});
</script>

<template>
  <div class="max-w-2xl mx-auto p-6 space-y-6">
    <header class="text-center space-y-2">
      <h1 class="text-3xl font-extrabold tracking-tight">Gate Entry Scanner</h1>
      <p class="text-gray-500 dark:text-gray-400 text-sm">
        Scan attendee QR pass codes to clear admission status metrics live at
        the venue.
      </p>
    </header>

    <UCard
      class="overflow-hidden border border-gray-100 dark:border-gray-800 shadow-sm"
    >
      <div
        id="qr-reader-container"
        class="w-full overflow-hidden rounded-lg"
      ></div>
    </UCard>

    <UAlert
      icon="i-heroicons-shield-check"
      :color="systemStatus.color as any"
      variant="soft"
      :title="systemStatus.text"
      class="font-medium"
    />

    <UCard
      v-if="scannedTicketInfo"
      class="border border-gray-100 dark:border-gray-800 shadow-sm bg-gray-50/50 dark:bg-gray-900/50"
    >
      <template #header>
        <h3 class="text-xs font-bold text-gray-400 uppercase tracking-wider">
          Scanned Asset Meta Profiles
        </h3>
      </template>
      <div class="space-y-3 text-sm">
        <div class="grid grid-cols-2 gap-2">
          <div>
            <span class="text-xs text-gray-400 font-semibold block">EVENT</span>
            <span class="font-bold text-gray-900 dark:text-white">{{
              scannedTicketInfo.events?.title
            }}</span>
          </div>
          <div>
            <span class="text-xs text-gray-400 font-semibold block"
              >PASS SERIAL CODE</span
            >
            <span class="font-mono font-bold text-primary-500">{{
              scannedTicketInfo.ticket_code
            }}</span>
          </div>
        </div>
        <UButton
          color="neutral"
          variant="solid"
          block
          class="mt-2"
          @click="scanResult = ''"
        >
          Reset Camera Lock for Next Attendee
        </UButton>
      </div>
    </UCard>
  </div>
</template>

<style>
/* Clean up the default library button styling to match Nuxt UI parameters beautifully */
#qr-reader-container button {
  background-color: rgb(var(--color-primary-500)) !important;
  color: white !important;
  font-weight: 600 !important;
  padding: 0.5rem 1rem !important;
  border-radius: 0.375rem !important;
  border: none !important;
  cursor: pointer !important;
  margin-top: 10px;
}
#qr-reader-container {
  border: none !important;
}
</style>
