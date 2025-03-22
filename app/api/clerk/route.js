import { Webhook } from "svix";
import connectDB from "@/config/db";
import User from "@/models/User";
import { headers } from "next/headers";

export async function POST(req) {
  try {
    // 1. SECRET VERIFICATION
    if (!process.env.CLERK_WEBHOOK_SECRET) {
      throw new Error("CLERK_WEBHOOK_SECRET is missing in environment variables");
    }

    // 2. WEBHOOK INITIALIZATION
    const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET);

    // 3. HEADER HANDLING
    const headerPayload = headers();
    const svixHeaders = {
      "svix-id": headerPayload.get("svix-id"),
      "svix-timestamp": headerPayload.get("svix-timestamp"),
      "svix-signature": headerPayload.get("svix-signature"),
    };

    // 4. PAYLOAD VERIFICATION
    const payload = await req.json();
    const evt = wh.verify(JSON.stringify(payload), svixHeaders);

    // 5. DATABASE OPERATIONS
    await connectDB();
    
    const userData = {
      _id: evt.data.id,
      email: evt.data.email_addresses[0]?.email_address,
      name: `${evt.data.first_name || ""} ${evt.data.last_name || ""}`.trim(),
      image: evt.data.image_url
    };

    switch (evt.type) {
      case "user.created":
        await User.create(userData);
        break;
      case "user.updated":
        await User.findByIdAndUpdate(evt.data.id, userData);
        break;
      case "user.deleted":
        await User.findByIdAndDelete(evt.data.id);
        break;
    }

    // 6. PROPER RESPONSE
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    console.error("Webhook Error:", err);
    return new Response(JSON.stringify({ 
      error: err.message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined
    }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
}