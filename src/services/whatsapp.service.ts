import type { FastifyBaseLogger } from 'fastify';
import { JSON_CONTENT_TYPE, WHATSAPP_API_BASE } from '../config/constants';
import type { AppEnv } from '../config/env';
import { maskPhone } from '../utils/logger';

export class WhatsAppService {
  constructor(
    private readonly env: AppEnv,
    private readonly logger: FastifyBaseLogger
  ) {}

  /**
   * Centralized Meta API caller that logs failures but never throws.
   * This keeps webhook processing resilient even when WhatsApp is degraded.
   */
  private async post(path: string, body: unknown): Promise<void> {
    try {
      const response = await fetch(`${WHATSAPP_API_BASE}/${this.env.WHATSAPP_PHONE_ID}/${path}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.env.WHATSAPP_TOKEN}`,
          'Content-Type': JSON_CONTENT_TYPE
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        this.logger.error({ status: response.status, path }, 'WhatsApp API request failed');
      }
    } catch (error) {
      this.logger.error({ error: error instanceof Error ? error.message : 'Unknown error', path }, 'WhatsApp API network error');
    }
  }

  /** Sends a customer-facing text message. */
  public async sendMessage(phone: string, text: string): Promise<void> {
    await this.post('messages', {
      messaging_product: 'whatsapp',
      to: phone,
      type: 'text',
      text: { body: text }
    });
    this.logger.info({ phone: maskPhone(phone) }, 'Customer message sent');
  }

  /** Sends escalation details to the configured manager number. */
  public async sendEscalationAlert(params: {
    customerPhone: string;
    customerName: string;
    message: string;
    reason: string;
  }): Promise<void> {
    const timestamp = new Date().toISOString();
    const alert = `🚨 *Escalation Alert*\n\n👤 Customer: ${params.customerName} (${params.customerPhone})\n💬 Message: ${params.message}\n⚠️ Reason: ${params.reason}\n🕐 Time: ${timestamp}\n\nPlease follow up directly.`;

    await this.sendMessage(this.env.MANAGER_PHONE, alert);
  }

  /** Marks a message as read in Meta; designed for fire-and-forget usage. */
  public async markAsRead(messageId: string): Promise<void> {
    await this.post('messages', {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId
    });
  }
}
