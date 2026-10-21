import assert from "node:assert/strict";
import test from "node:test";
import { ActionStatus, AutonomyLevel } from "@/app/generated/prisma/enums";
import { allActionsResolved, conditionOrder, requiresConfirmation, taskActions } from "@/lib/experiment";

test("cada condição usa as mesmas três ações, na mesma ordem", () => {
  assert.deepEqual(conditionOrder, [AutonomyLevel.LOW, AutonomyLevel.MEDIUM, AutonomyLevel.HIGH]);
  assert.deepEqual(taskActions.map((action) => action.key), ["add_focus_block", "move_lunch", "resolve_conflict"]);
});

test("baixa autonomia pede aprovação para todas as ações", () => {
  for (const action of taskActions) assert.equal(requiresConfirmation(AutonomyLevel.LOW, action.key), true);
});

test("média autonomia confirma apenas a resolução do conflito", () => {
  assert.equal(requiresConfirmation(AutonomyLevel.MEDIUM, "add_focus_block"), false);
  assert.equal(requiresConfirmation(AutonomyLevel.MEDIUM, "move_lunch"), false);
  assert.equal(requiresConfirmation(AutonomyLevel.MEDIUM, "resolve_conflict"), true);
});

test("alta autonomia executa todas as ações sem confirmação", () => {
  for (const action of taskActions) assert.equal(requiresConfirmation(AutonomyLevel.HIGH, action.key), false);
});

test("ações rejeitadas encerram a proposta sem contar como executadas", () => {
  assert.equal(allActionsResolved([{ status: ActionStatus.EXECUTED }, { status: ActionStatus.REJECTED }]), true);
  assert.equal(allActionsResolved([{ status: ActionStatus.EXECUTED }, { status: ActionStatus.PENDING }]), false);
});
