export default function AuditLog() {
  return (
    <div className="max-w-2xl mx-auto p-8">
      <h2 className="text-xl font-bold mb-4">Audit Log</h2>
      <p className="text-sm leading-6 text-muted-foreground">
        Planned chronological log for administrative actions: approvals, rejections,
        overrides, imports, and other changes that affect published guidance. Demo
        reviewers can use this page to understand the governance trail Systemfehler
        intends to expose.
      </p>
    </div>
  );
}
