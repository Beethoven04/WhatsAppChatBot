import { describe, expect, it } from 'vitest';
import { parseIncomingMessage } from '../src/utils/messageParser';

describe('parseIncomingMessage', () => {
  it('parses a valid text message', () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                contacts: [{ profile: { name: 'Alice' } }],
                messages: [{ from: '212600000001', id: 'wamid-1', type: 'text', text: { body: 'Hi there' } }]
              }
            }
          ]
        }
      ]
    };

    const parsed = parseIncomingMessage(payload);
    expect(parsed).toEqual({
      phone: '212600000001',
      customerName: 'Alice',
      messageId: 'wamid-1',
      messageText: 'Hi there'
    });
  });

  it('returns null for non-text messages', () => {
    const payload = {
      entry: [{ changes: [{ value: { messages: [{ type: 'reaction', from: '1', id: 'x' }] } }] }]
    };

    expect(parseIncomingMessage(payload)).toBeNull();
  });
});
