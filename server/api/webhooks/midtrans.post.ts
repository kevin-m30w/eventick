// server/api/webhooks/midtrans.post.ts
import crypto from "crypto";
import { serverSupabaseServiceRole } from "#supabase/server"; // 💡 Native admin client utility

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  // 💡 FIXED: Instantly instantiates a super-admin client bypassing all RLS rules completely
  const supabase = serverSupabaseServiceRole(event);

  console.log("--- 📥 MIDTRANS WEBHOOK PING RECEIVED ---");
  console.log("Received Order ID:", body.order_id);
  console.log("Transaction Status:", body.transaction_status);

  // 1. SECURITY CHECK: Verify the signature key
  const serverKey = process.env.MIDTRANS_SERVER_KEY || "";
  const stringToHash =
    body.order_id + body.status_code + body.gross_amount + serverKey;
  const signature = crypto
    .createHash("sha512")
    .update(stringToHash)
    .digest("hex");

  if (signature !== body.signature_key) {
    console.error("❌ Security signature verification failed.");
    throw createError({ statusCode: 403, statusMessage: "Invalid signature." });
  }
  console.log("✅ Security signature verified completely.");

  const orderId = body.order_id;
  const transactionStatus = body.transaction_status;

  // 2. Catch the settlement states
  if (transactionStatus === "settlement" || transactionStatus === "capture") {
    console.log(
      "💳 Status identifies as SETTLED. Proceeding to database write...",
    );

    // A. Update the master Order row parameter to "completed"
    const { data: updatedOrder, error: orderErr } = await supabase
      .from("orders")
      .update({
        status: "completed",
        payment_intent_id: body.transaction_id,
      })
      .eq("id", orderId) // Ensuring this string clean-casts to UUID match parameters
      .select()
      .maybeSingle(); // Prevents crashing if row count is 0

    if (orderErr) {
      console.error("❌ Supabase Order Update Error:", orderErr.message);
      return { status: "error", message: orderErr.message };
    }

    if (!updatedOrder) {
      console.error(
        `⚠️ Looked up Order ID ${orderId} but 0 rows were found or updated in Supabase!`,
      );
      return { status: "error", message: "No matching order found to update." };
    }

    console.log("✅ Master Order row switched to COMPLETED successfully!");

    // B. Fetch the related event info to find the pricing data
    const { data: targetEvent } = await supabase
      .from("events")
      .select("title, price")
      .eq("id", updatedOrder.event_id)
      .single();

    // C. Calculate ticket quantities cleanly
    const unitPrice = targetEvent?.price || 0;
    let calculatedQuantity = 1;

    if (unitPrice > 0) {
      calculatedQuantity = Math.max(
        1,
        Math.floor(updatedOrder.total_amount / unitPrice),
      );
    }

    console.log(
      `🎟️ Creating ${calculatedQuantity} individual tickets for event: ${targetEvent?.title}`,
    );

    // D. Generate individual ticket rows
    const ticketsPayload = Array.from({ length: calculatedQuantity }).map(
      () => {
        const uniqueHash = Math.random()
          .toString(36)
          .substring(2, 12)
          .toUpperCase();
        const eventCode =
          targetEvent?.title?.substring(0, 3).toUpperCase() || "EVT";

        return {
          order_id: updatedOrder.id,
          user_id: updatedOrder.user_id,
          event_id: updatedOrder.event_id,
          ticket_code: `EVT-${eventCode}-${uniqueHash}`,
          status: "valid",
        };
      },
    );

    const { error: ticketErr } = await supabase
      .from("tickets")
      .insert(ticketsPayload);

    if (ticketErr) {
      console.error("❌ Ticket generation database error:", ticketErr.message);
    } else {
      console.log("✅ Tickets successfully inserted into database!");
    }
  } else {
    console.log(
      `ℹ️ Non-settlement status received (${transactionStatus}). Ignoring ticket generation block.`,
    );
  }

  return { status: "success", message: "Webhook event processed completely." };
});
