import { Card } from '@/components/ui/card';

export default function AdminQuality() {
  return (
    <div className="max-w-2xl mx-auto p-8">
      <Card className="p-6 mb-4">
        <h2 className="text-xl font-bold mb-2">Quality Assurance</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Planned quality dashboard for spotting weak entries, stale sources, missing
          translations, and low evidence scores. Reviewers will use this page to
          prioritize cleanup work before content is shown more broadly.
        </p>
      </Card>
    </div>
  );
}
