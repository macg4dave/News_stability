# Simple, composable design

These are project rules. They express our preference for small, cohesive code;
they are not claimed as mandatory rules of the Go language.

## Understand behavior before adding code

Before extending a function, read the whole function and its call sites. State
what it actually does: inputs, outputs, side effects, invariants, failure paths,
and who owns its state. Trace the user action through HTTP handling, upstream
calls, and response presentation. Check the whole flow after the change.

Ask whether the new behavior belongs there, whether existing code already does
it, and whether a simpler replacement can remove branches. Do not keep appending
flags, conditions, callbacks, and parameters to an increasingly vague function.

## Cohesion over size limits

- Give each function one explainable purpose. Split when responsibilities or
  reasons to change diverge, not at an arbitrary line count.
- Keep orchestration readable: it should show the sequence of work without
  burying unrelated parsing, transport, storage, and presentation decisions.
- Group code by responsibility. A single binary is fine; a giant handler,
  global application object, or catch-all package is not.
- Keep related operations together. Combine tiny wrappers when they obscure the
  behavior; merge duplicated logic once a shared meaning is established.
- Prefer explicit data flow and ordinary function calls. Avoid hidden globals,
  registries, service locators, and speculative extension frameworks.
- Introduce abstraction only for a present need. Do not create an interface,
  factory, generic helper, or package for every concrete type.
- Keep dependencies one-way and APIs small. A feature should be removable
  without editing many unrelated areas. Avoid circular responsibilities.
- Delete replaced paths, unused exports, stale options, duplicate tests, and
  obsolete documentation as part of the change. Do not leave parallel solutions.
- Do not create microservices, a database, or a job system without a demonstrated
  reader requirement. NewsBlur already provides the underlying news service.

## Review questions

Can a reader explain the flow without jumping through many wrappers? Does each
name match what the function really does? Can the new code be tested, reused,
combined, or deleted without unrelated changes? Did we simplify the existing
logic, or merely add another branch? Would fewer concepts solve the same problem?
