/**
 * webhookVerifier.ts
 * -------------------------------------
 * Webhook signature verification utilities
 * -------------------------------------
 */
import crypto from "crypto";

export interface WebhookSignatureOptions {
  payload: string | Buffer;
  signature: string;
  secret: string;
  algorithm?: "sha256" | "sha1";
}

/**
 * Verify Facebook webhook signature
 */
export function verifyFacebookWebhook(
  options: WebhookSignatureOptions,
): boolean {
  const { payload, signature, secret, algorithm = "sha256" } = options;

  if (!signature) {
    console.warn("[Webhook] No signature provided");
    return false;
  }

  try {
    const expectedSignature = `sha256=${crypto
      .createHmac(algorithm, secret)
      .update(payload)
      .digest("hex")}`;

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature),
    );
  } catch (error) {
    console.error("[Webhook] Signature verification failed:", error);
    return false;
  }
}

/**
 * Verify generic webhook signature (without sha256= prefix)
 */
export function verifyWebhookSignature(
  options: WebhookSignatureOptions,
): boolean {
  const { payload, signature, secret, algorithm = "sha256" } = options;

  if (!signature) {
    console.warn("[Webhook] No signature provided");
    return false;
  }

  try {
    const expectedSignature = crypto
      .createHmac(algorithm, secret)
      .update(payload)
      .digest("hex");

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature),
    );
  } catch (error) {
    console.error("[Webhook] Signature verification failed:", error);
    return false;
  }
}

/**
 * Generate signature for testing purposes
 */
export function generateSignature(
  payload: string | Buffer,
  secret: string,
  algorithm: "sha256" | "sha1" = "sha256",
): string {
  return `sha256=${crypto
    .createHmac(algorithm, secret)
    .update(payload)
    .digest("hex")}`;
}
