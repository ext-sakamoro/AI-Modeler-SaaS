import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">AI Modeler</h1>
        <nav className="flex gap-4">
          <Link href="/auth/login" className="text-sm text-muted-foreground hover:text-foreground">
            Sign In
          </Link>
          <Link
            href="/auth/register"
            className="text-sm bg-primary text-primary-foreground px-4 py-2 rounded-md hover:opacity-90"
          >
            Get Started
          </Link>
        </nav>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="max-w-3xl text-center space-y-6">
          <h2 className="text-5xl font-bold tracking-tight">
            Don&apos;t send polygons.
            <br />
            <span className="text-primary">Send the law of shapes.</span>
          </h2>
          <p className="text-xl text-muted-foreground">
            Cloud-native 3D modeling powered by ALICE-SDF. Describe shapes in natural language,
            build with 126 SDF node types, and export to 15 formats — all in your browser.
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/auth/register"
              className="bg-primary text-primary-foreground px-6 py-3 rounded-lg text-lg font-medium hover:opacity-90"
            >
              Start Modeling
            </Link>
            <Link
              href="/dashboard/editor"
              className="border border-border px-6 py-3 rounded-lg text-lg font-medium hover:bg-accent"
            >
              Try the Editor
            </Link>
          </div>
        </div>

        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl w-full">
          <FeatureCard
            title="Text-to-3D"
            description="Describe any shape in natural language and get a precise SDF model instantly via Claude, Gemini, or OpenAI."
          />
          <FeatureCard
            title="126 SDF Nodes"
            description="72 primitives, 24 CSG operations, 7 transforms, and 23 modifiers — combine them visually or via API."
          />
          <FeatureCard
            title="15 Export Formats"
            description="OBJ, GLB, FBX, USD, STL, 3MF, Nanite, WGSL shaders and more — from a single SDF definition."
          />
        </div>
      </main>

      <footer className="border-t border-border px-6 py-4 text-center text-sm text-muted-foreground">
        AI Modeler SaaS — Powered by ALICE-SDF v1.1.0 — AGPL-3.0 + Commercial License
      </footer>
    </div>
  );
}

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="border border-border rounded-lg p-6 space-y-2">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
