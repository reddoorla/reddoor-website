/**
 * The local stand-in for maintenance's report API, used by edit-save.spec.ts
 * (W1). Shared by the Playwright config, which starts the stub and points the
 * dev server at it, and by the spec, which seeds it.
 *
 * Off when E2E_AUDIT_TOKEN is set: that run is pointed at a real maintenance
 * deploy by its own environment, and the stub must not replace it.
 */
const port = Number(process.env.EDIT_STUB_PORT || 5197);

export const EDIT_STUB = {
  enabled: !process.env.E2E_AUDIT_TOKEN,
  port,
  url: `http://127.0.0.1:${port}`,
  editKey: "smoke-edit-key",
  editToken: "smoke-edit-token",
};
