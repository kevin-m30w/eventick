// server/api/payment/checkout.post.ts
import midtransClient from "midtrans-client";
import { serverSupabaseClient } from "#supabase/server";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { orderId, totalAmount, eventTitle } = body;

  if (!orderId || !totalAmount) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing order execution parameters.",
    });
  }

  // 1. Initialize the Midtrans Snap Client securely using server environment parameters
  const snap = new midtransClient.Snap({
    isProduction: false, // Set to false because we are working inside the sandbox environment
    serverKey: process.env.MIDTRANS_SERVER_KEY,
    clientKey: process.env.MIDTRANS_CLIENT_KEY,
  });

  // 2. Structure the transaction parameters exactly how Midtrans expects it
  const parameter = {
    transaction_details: {
      order_id: orderId, // Pass your Supabase orders table UUID string
      gross_amount: totalAmount, // The total price in IDR (integer numeric value)
    },
    item_details: [
      {
        id: orderId,
        price: totalAmount,
        quantity: 1,
        name: `Admission Pass: ${eventTitle.substring(0, 30)}`,
      },
    ],
    // Optional: You can also pass customer details here if you want their email pre-filled!
  };

  try {
    // 3. Request the token from Midtrans
    const transaction = await snap.createTransaction(parameter);

    return {
      success: true,
      token: transaction.token,
      redirectUrl: transaction.redirect_url,
    };
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage:
        error.message || "Failed to initiate gateway token transaction.",
    });
  }
});
