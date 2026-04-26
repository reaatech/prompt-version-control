import { logger } from '../utils/logger.js';

export type EventType =
  | 'version.created'
  | 'tag.moved'
  | 'eval.completed'
  | 'promotion.requested'
  | 'promotion.approved'
  | 'promotion.rejected';

export interface AppEvent {
  id: string;
  type: EventType;
  projectId: string;
  payload: Record<string, unknown>;
  createdAt: Date;
}

export type EventHandler = (event: AppEvent) => void | Promise<void>;

class EventBus {
  private handlers = new Map<EventType, Set<EventHandler>>();

  on(type: EventType, handler: EventHandler): () => void {
    const set = this.handlers.get(type) ?? new Set();
    set.add(handler);
    this.handlers.set(type, set);
    return () => set.delete(handler);
  }

  emit(event: AppEvent): void {
    const set = this.handlers.get(event.type);
    if (!set) return;

    for (const handler of set) {
      Promise.resolve()
        .then(() => handler(event))
        .catch((err) => logger.error({ err, eventId: event.id }, 'event handler failed'));
    }
  }

  emitAsync(event: AppEvent): Promise<void> {
    const set = this.handlers.get(event.type);
    if (!set) return Promise.resolve();

    return Promise.all(
      Array.from(set).map(async (handler) => {
        try {
          await handler(event);
        } catch (err) {
          logger.error({ err, eventId: event.id }, 'event handler failed');
        }
      }),
    ).then(() => undefined);
  }
}

export const eventBus = new EventBus();
