import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  SystemEventManager,
  SystemEventType,
  createSystemEvent,
  SystemEventHook,
  PlanStartEvent,
} from "./system-events";
import { PlannerInput } from "../schema/ui";

describe("System Events", () => {
  describe("createSystemEvent", () => {
    it("should create a system event with the given type, data, and a timestamp", () => {
      const eventType = SystemEventType.PLAN_START;
      const eventData: Omit<PlanStartEvent, "type" | "timestamp"> = {
        plannerInput: {
          schema: {},
          goal: "test",
          history: [],
          userContext: null,
        },
      };
      const beforeTimestamp = Date.now();
      const event = createSystemEvent(eventType, eventData);
      const afterTimestamp = Date.now();

      expect(event.type).toBe(eventType);
      expect(event.plannerInput).toEqual(eventData.plannerInput);
      expect(event.timestamp).toBeGreaterThanOrEqual(beforeTimestamp);
      expect(event.timestamp).toBeLessThanOrEqual(afterTimestamp);
    });

    it("should create different types of events correctly", () => {
      const errorData = { error: new Error("Test error") };
      const errorEvent = createSystemEvent(
        SystemEventType.PLAN_ERROR,
        errorData
      );
      expect(errorEvent.type).toBe(SystemEventType.PLAN_ERROR);
      expect(errorEvent.error).toBeInstanceOf(Error);
      expect(errorEvent.error.message).toBe("Test error");
    });
  });

  describe("SystemEventManager", () => {
    let eventManager: SystemEventManager;

    beforeEach(() => {
      eventManager = new SystemEventManager();
    });

    it("should register a listener and emit an event to it", async () => {
      const listener = vi.fn() as SystemEventHook<PlanStartEvent>;
      const eventData: Omit<PlanStartEvent, "type" | "timestamp"> = {
        plannerInput: {
          schema: {},
          goal: "test goal",
          history: [],
          userContext: null,
        },
      };
      const event = createSystemEvent(SystemEventType.PLAN_START, eventData);

      eventManager.on(SystemEventType.PLAN_START, listener);
      await eventManager.emit(event);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(event);
    });

    it("should not call a listener for a different event type", async () => {
      const planStartListener = vi.fn();
      const planErrorListener = vi.fn();

      const planStartEventData: Omit<PlanStartEvent, "type" | "timestamp"> = {
        plannerInput: {
          schema: {},
          goal: "test",
          history: [],
          userContext: null,
        },
      };
      const planStartEvent = createSystemEvent(
        SystemEventType.PLAN_START,
        planStartEventData
      );

      eventManager.on(SystemEventType.PLAN_START, planStartListener);
      eventManager.on(SystemEventType.PLAN_ERROR, planErrorListener);

      await eventManager.emit(planStartEvent);

      expect(planStartListener).toHaveBeenCalledTimes(1);
      expect(planErrorListener).not.toHaveBeenCalled();
    });

    it("should call multiple listeners for the same event type", async () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const event = createSystemEvent(SystemEventType.PLAN_COMPLETE, {
        layout: {
          id: "root",
          node_type: "Container",
          props: null,
          bindings: null,
          events: null,
          children: null,
        },
        executionTimeMs: 100,
      });

      eventManager.on(SystemEventType.PLAN_COMPLETE, listener1);
      eventManager.on(SystemEventType.PLAN_COMPLETE, listener2);
      await eventManager.emit(event);

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener1).toHaveBeenCalledWith(event);
      expect(listener2).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledWith(event);
    });

    it("should allow unregistering a listener", async () => {
      const listener = vi.fn();
      const event = createSystemEvent(SystemEventType.RENDER_START, {
        layout: {
          id: "root",
          node_type: "Container",
          props: null,
          bindings: null,
          events: null,
          children: null,
        },
      });

      const unregister = eventManager.on(
        SystemEventType.RENDER_START,
        listener
      );
      unregister(); // Unregister immediately

      await eventManager.emit(event);

      expect(listener).not.toHaveBeenCalled();
    });

    it("should handle emitting an event with no listeners", async () => {
      const event = createSystemEvent(SystemEventType.DATA_FETCH_START, {
        tableName: "users",
        query: {},
      });

      await expect(eventManager.emit(event)).resolves.toBeUndefined();
    });

    it("should correctly pass event payload to typed listeners", async () => {
      const mockPlannerInput: PlannerInput = {
        schema: { test: "schema" },
        goal: "goal",
        history: [],
        userContext: null,
      };
      const listener = vi.fn() as SystemEventHook<PlanStartEvent>;
      const eventToEmit: PlanStartEvent = {
        type: SystemEventType.PLAN_START,
        timestamp: Date.now(),
        plannerInput: mockPlannerInput,
      };

      eventManager.on(SystemEventType.PLAN_START, listener);
      await eventManager.emit(eventToEmit);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: SystemEventType.PLAN_START,
          plannerInput: mockPlannerInput,
        })
      );
    });
  });
});
