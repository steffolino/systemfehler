export function Header() {
  return (
    <header className="border-b bg-background">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Systemfehler</h1>
            <p className="text-sm text-muted-foreground">
              Admin Panel - Data Quality Validation
            </p>
          </div>
          <div className="text-sm text-muted-foreground">
            v0.1.0
          </div>
        </div>
      </div>
    </header>
  );
}
