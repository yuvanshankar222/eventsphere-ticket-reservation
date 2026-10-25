import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Pure business logic calculation tests for ticket inventory invariants
 * Invariant: availableQuantity + heldQuantity + soldQuantity = totalQuantity
 * Invariant: heldQuantity >= 0, soldQuantity >= 0, availableQuantity >= 0
 * Invariant: soldQuantity + heldQuantity <= totalQuantity
 */

function calculateAvailable(total: number, sold: number, held: number): number {
  return total - sold - held;
}

function canAllocate(total: number, sold: number, held: number, requested: number): boolean {
  if (requested <= 0) return false;
  const available = calculateAvailable(total, sold, held);
  return available >= requested;
}

function allocateInventory(total: number, sold: number, held: number, requested: number) {
  if (!canAllocate(total, sold, held, requested)) {
    throw new Error('Insufficient Inventory');
  }
  const newHeld = held + requested;
  assert.ok(sold + newHeld <= total, 'Capacity invariant violated');
  return {
    total,
    sold,
    held: newHeld,
    available: total - sold - newHeld,
  };
}

function confirmInventory(total: number, sold: number, held: number, quantity: number) {
  assert.ok(held >= quantity, 'Cannot confirm more tickets than currently held');
  const newHeld = held - quantity;
  const newSold = sold + quantity;
  assert.ok(newSold + newHeld <= total, 'Capacity invariant violated after confirmation');
  return {
    total,
    sold: newSold,
    held: newHeld,
    available: total - newSold - newHeld,
  };
}

function releaseHeldInventory(total: number, sold: number, held: number, quantity: number) {
  assert.ok(held >= quantity, 'Cannot release more held tickets than are currently held');
  const newHeld = Math.max(0, held - quantity);
  return {
    total,
    sold,
    held: newHeld,
    available: total - sold - newHeld,
  };
}

test('inventory invariant: initial allocation', () => {
  const total = 100;
  let sold = 0;
  let held = 0;

  assert.equal(calculateAvailable(total, sold, held), 100);

  // Allocate 10 tickets
  const afterHold = allocateInventory(total, sold, held, 10);
  assert.equal(afterHold.held, 10);
  assert.equal(afterHold.available, 90);
  assert.equal(afterHold.total, afterHold.sold + afterHold.held + afterHold.available);
});

test('inventory invariant: confirmation converts held to sold', () => {
  const total = 50;
  const sold = 10;
  const held = 5;

  const confirmed = confirmInventory(total, sold, held, 5);
  assert.equal(confirmed.sold, 15);
  assert.equal(confirmed.held, 0);
  assert.equal(confirmed.available, 35);
  assert.equal(confirmed.total, confirmed.sold + confirmed.held + confirmed.available);
});

test('inventory invariant: release expired hold returns to available', () => {
  const total = 50;
  const sold = 15;
  const held = 5;

  const released = releaseHeldInventory(total, sold, held, 5);
  assert.equal(released.sold, 15);
  assert.equal(released.held, 0);
  assert.equal(released.available, 35);
  assert.equal(released.total, released.sold + released.held + released.available);
});

test('oversell prevention: rejects reservation exceeding available inventory', () => {
  const total = 10;
  const sold = 8;
  const held = 1; // Only 1 available

  assert.equal(canAllocate(total, sold, held, 2), false);
  assert.throws(() => allocateInventory(total, sold, held, 2), /Insufficient Inventory/);
});

test('purchase limit validation per attendee', () => {
  const purchaseLimit = 4;
  const existingHoldsAndBookings = 3;
  const requested = 2;

  const isAllowed = existingHoldsAndBookings + requested <= purchaseLimit;
  assert.equal(isAllowed, false);
});
