import { Card } from '@/components/ui/card';

export default function AdminModeration() {
  return (
    <div className="max-w-2xl mx-auto p-8">
      <Card className="p-6 mb-4">
        <h2 className="text-xl font-bold mb-2">Moderation Queue</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Planned review workspace for incoming crawler candidates, content changes, and
          editor decisions. Reviewers will use this page to compare proposed updates,
          accept useful entries, reject noisy sources, and leave notes that explain the
          decision trail.
        </p>
      </Card>
    </div>
  );
}
